import { collection, doc, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { applyPayment } from '../lib/billing';
import { todayISO } from '../lib/format';
import { db } from '../lib/firebase';
import type { Invoice, Payment, PaymentMethod, Receipt } from '../types';
import { addAuditLog } from './audit';
import { readCounter } from './counters';
import { currentUid, getDocById, listDocs } from './db';
import { getFinanceSettings } from './settings';
import { deleteFile, uploadFile } from './storage';
import { notifyUsers } from './notifications';
import { formatRupiah } from '../lib/format';

export async function listPayments(): Promise<Payment[]> {
  const rows = await listDocs<Payment>('payments');
  return rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || (b.paymentNumber || '').localeCompare(a.paymentNumber || ''));
}

export async function listPaymentsOfInvoice(invoiceId: string): Promise<Payment[]> {
  const rows = await listDocs<Payment>('payments', where('invoiceId', '==', invoiceId));
  return rows.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
}

export async function listReceipts(): Promise<Receipt[]> {
  const rows = await listDocs<Receipt>('receipts');
  return rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.receiptNumber.localeCompare(a.receiptNumber));
}

export const getReceipt = (id: string) => getDocById<Receipt>('receipts', id);
export const getPayment = (id: string) => getDocById<Payment>('payments', id);

export interface PaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;
}

/**
 * Mencatat pembayaran sebagai "pending". Bila verifyNow = true (mis. tunai di
 * meja admin) langsung diverifikasi → saldo tagihan berubah + kuitansi terbit.
 */
export async function recordPayment(invoice: Invoice, input: PaymentInput, file: File | null, verifyNow: boolean) {
  if (invoice.status !== 'unpaid' && invoice.status !== 'partially_paid') {
    throw new Error('Pembayaran hanya bisa dicatat untuk tagihan yang sudah terbit dan belum lunas.');
  }
  if (!input.paymentDate) throw new Error('Tanggal bayar wajib diisi.');
  if (input.paymentDate > todayISO()) throw new Error('Tanggal bayar tidak boleh di masa depan.');
  const amount = Math.floor(Number(input.amount));
  const pending = await listDocs<Payment>('payments', where('invoiceId', '==', invoice.id), where('status', '==', 'pending'));
  const pendingSum = pending.reduce((s, p) => s + p.amount, 0);
  // Validasi termasuk pembayaran yang masih menunggu verifikasi.
  applyPayment({ total: invoice.total, paidAmount: invoice.paidAmount + pendingSum }, amount);

  const finance = await getFinanceSettings();
  const payRef = doc(collection(db, 'payments'));
  const attachment = file ? await uploadFile('payments', payRef.id, file, 10 * 1024 * 1024) : null;
  try {
    await runTransaction(db, async (tx) => {
      const counter = await readCounter(tx, 'payment', todayISO());
      const paymentNumber = counter.number(finance.paymentPrefix);
      tx.set(payRef, {
        paymentNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        parentUids: invoice.parentUids,
        billingType: invoice.billingType,
        amount,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber.trim(),
        notes: input.notes.trim(),
        attachmentUrl: attachment?.url ?? null,
        attachmentPath: attachment?.path ?? null,
        status: 'pending',
        createdBy: currentUid(),
        verifiedBy: null,
        verifiedAt: null,
        createdAt: serverTimestamp(),
      });
      counter.commit();
      addAuditLog(tx, { action: 'payment_created', module: 'payments', recordId: payRef.id, newData: { invoiceId: invoice.id, amount, paymentNumber } });
    });
  } catch (e) {
    await deleteFile(attachment?.path ?? null);
    throw e;
  }
  if (verifyNow) await verifyPayment(payRef.id);
  return payRef.id;
}

/**
 * Verifikasi = satu transaksi: saldo tagihan diperbarui (parsial/lunas),
 * status pembayaran verified, kuitansi bernomor diterbitkan.
 */
export async function verifyPayment(paymentId: string) {
  const finance = await getFinanceSettings();
  const payRef = doc(db, 'payments', paymentId);
  let notify: { uids: string[]; name: string; amount: number; remaining: number } | null = null;
  await runTransaction(db, async (tx) => {
    const pay = (await tx.get(payRef)).data() as Payment | undefined;
    if (!pay) throw new Error('Pembayaran tidak ditemukan.');
    if (pay.status !== 'pending') throw new Error('Pembayaran ini sudah diproses.');
    const invRef = doc(db, 'invoices', pay.invoiceId);
    const inv = (await tx.get(invRef)).data() as Invoice | undefined;
    if (!inv) throw new Error('Tagihan tidak ditemukan.');
    if (inv.status !== 'unpaid' && inv.status !== 'partially_paid') throw new Error('Tagihan ini tidak sedang menunggu pembayaran.');
    const counter = await readCounter(tx, 'receipt', todayISO());
    // Bukti bayar dari orang tua belum bernomor (orang tua tidak boleh akses counter).
    const payCounter = pay.paymentNumber ? null : await readCounter(tx, 'payment', todayISO());
    const paymentNumber = pay.paymentNumber || payCounter!.number(finance.paymentPrefix);

    const result = applyPayment(inv, pay.amount);
    const uid = currentUid();
    const receiptNumber = counter.number(finance.receiptPrefix);
    tx.update(invRef, {
      paidAmount: result.paidAmount,
      outstandingAmount: result.outstandingAmount,
      status: result.status,
      updatedAt: serverTimestamp(),
    });
    tx.update(payRef, { status: 'verified', paymentNumber, verifiedBy: uid, verifiedAt: serverTimestamp() });
    tx.set(doc(db, 'receipts', paymentId), {
      receiptNumber,
      paymentId,
      paymentNumber,
      invoiceId: pay.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      studentId: pay.studentId,
      studentName: pay.studentName,
      parentUids: inv.parentUids,
      amount: pay.amount,
      paymentDate: pay.paymentDate,
      paymentMethod: pay.paymentMethod,
      previousBalance: result.previousBalance,
      remainingBalance: result.outstandingAmount,
      invoiceStatus: result.status,
      issuedBy: uid,
      issuedAt: serverTimestamp(),
    });
    counter.commit();
    payCounter?.commit();
    addAuditLog(tx, {
      action: 'payment_verified',
      module: 'payments',
      recordId: paymentId,
      oldData: { invoicePaid: inv.paidAmount, invoiceStatus: inv.status },
      newData: { invoicePaid: result.paidAmount, invoiceStatus: result.status, receiptNumber },
    });
    notify = { uids: inv.parentUids, name: pay.studentName, amount: pay.amount, remaining: result.outstandingAmount };
  });
  const n = notify as { uids: string[]; name: string; amount: number; remaining: number } | null;
  if (n) {
    await notifyUsers(n.uids, {
      title: `Pembayaran ${n.name} diterima`,
      body: `${formatRupiah(n.amount)} sudah diverifikasi. ${n.remaining > 0 ? `Sisa tagihan ${formatRupiah(n.remaining)}.` : 'Tagihan lunas.'}`,
      link: `/receipts/${paymentId}`,
    });
  }
}

export async function rejectPayment(payment: Payment, reason: string) {
  if (!reason.trim()) throw new Error('Alasan penolakan wajib diisi.');
  const payRef = doc(db, 'payments', payment.id);
  await runTransaction(db, async (tx) => {
    const pay = (await tx.get(payRef)).data() as Payment | undefined;
    if (!pay || pay.status !== 'pending') throw new Error('Pembayaran ini sudah diproses.');
    tx.update(payRef, { status: 'rejected', rejectReason: reason.trim(), verifiedBy: currentUid(), verifiedAt: serverTimestamp() });
    addAuditLog(tx, { action: 'payment_rejected', module: 'payments', recordId: payment.id, newData: { reason: reason.trim(), amount: pay.amount } });
  });
  await notifyUsers(payment.parentUids, {
    title: `Bukti bayar ${payment.studentName} ditolak`,
    body: `${formatRupiah(payment.amount)}: ${reason.trim()}`,
    link: '/p/payments',
  });
}
