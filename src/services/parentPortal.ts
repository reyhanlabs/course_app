import { collection, doc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { applyPayment } from '../lib/billing';
import { todayISO } from '../lib/format';
import { db, storage } from '../lib/firebase';
import type { Invoice, Payment, Receipt, UserProfile } from '../types';
import { listDocs } from './db';
import type { PaymentInput } from './payments';
import { safeFileName } from './storage';
import { notifyAdmins } from './notifications';
import { formatRupiah } from '../lib/format';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

/**
 * Query portal orang tua. Semua memakai filter parentUids array-contains uid
 * karena itulah yang diperiksa Security Rules.
 */
export async function listMyInvoices(uid: string): Promise<Invoice[]> {
  const rows = await listDocs<Invoice>('invoices', where('parentUids', 'array-contains', uid));
  return rows.filter((i) => i.status !== 'draft').sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

export async function listMyPayments(uid: string): Promise<Payment[]> {
  const rows = await listDocs<Payment>('payments', where('parentUids', 'array-contains', uid));
  return rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

export async function listMyReceipts(uid: string): Promise<Receipt[]> {
  const rows = await listDocs<Receipt>('receipts', where('parentUids', 'array-contains', uid));
  return rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

/**
 * Orang tua mengirim bukti bayar. Tercatat sebagai "menunggu verifikasi";
 * saldo tagihan baru berubah setelah admin memverifikasi.
 */
export async function submitPaymentProof(invoice: Invoice, input: PaymentInput, file: File | null, pendingSum: number, profile: UserProfile) {
  if (invoice.status !== 'unpaid' && invoice.status !== 'partially_paid') throw new Error('Tagihan ini tidak sedang menunggu pembayaran.');
  if (!file) throw new Error('Lampirkan foto atau PDF bukti transfer.');
  if (!input.paymentDate || input.paymentDate > todayISO()) throw new Error('Tanggal bayar tidak valid.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran bukti maksimal 10 MB.');
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') throw new Error('Bukti harus berupa foto atau PDF.');
  const amount = Math.floor(Number(input.amount));
  applyPayment({ total: invoice.total, paidAmount: invoice.paidAmount + pendingSum }, amount);

  const path = `payment-proofs/${profile.id}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);

  await setDoc(doc(collection(db, 'payments')), {
    paymentNumber: '',
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
    attachmentUrl: url,
    attachmentPath: path,
    status: 'pending',
    createdBy: profile.id,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: serverTimestamp(),
  });
  await notifyAdmins({
    title: `Bukti bayar dari orang tua ${invoice.studentName}`,
    body: `${formatRupiah(amount)} untuk ${invoice.invoiceNumber}. Perlu diverifikasi.`,
    link: '/payments?status=pending',
  });
}
