import { collection, doc, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import {
  computeMonthlyItems,
  computePerSessionItems,
  computeTotals,
  profileForPeriod,
  type DraftItem,
} from '../lib/billing';
import { addDays, monthRange, todayISO } from '../lib/format';
import { db } from '../lib/firebase';
import type { Attendance, BillingProfile, BillingType, Invoice, InvoiceItem, Payment, Student } from '../types';
import { addAuditLog } from './audit';
import { listAllProfiles } from './billingProfiles';
import { readCounter } from './counters';
import { currentUid, getDocById, listDocs, required } from './db';
import { listSessionsInRange } from './sessions';
import { getFinanceSettings } from './settings';
import { notifyUsers } from './notifications';
import { formatRupiah } from '../lib/format';

const COL = 'invoices';
const ITEMS = 'invoiceItems';

export async function listInvoices(): Promise<Invoice[]> {
  const rows = await listDocs<Invoice>(COL);
  return rows.sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.studentName.localeCompare(b.studentName, 'id'));
}

export const getInvoice = (id: string) => getDocById<Invoice>(COL, id);

export async function listItems(invoiceId: string): Promise<InvoiceItem[]> {
  const rows = await listDocs<InvoiceItem>(ITEMS, where('invoiceId', '==', invoiceId));
  return rows.sort((a, b) => a.order - b.order);
}

export async function listInvoicesOfStudent(studentId: string): Promise<Invoice[]> {
  const rows = await listDocs<Invoice>(COL, where('studentId', '==', studentId));
  return rows.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

// ------------------------------------------------------------------
// Pembuatan tagihan
// ------------------------------------------------------------------

export interface PreviewRow {
  student: Student;
  billingType: BillingType | null;
  items: DraftItem[];
  discount: number;
  additionalFee: number;
  additionalFeeLabel: string;
  subtotal: number;
  total: number;
  warnings: string[];
  skipReason: string | null;
}

/**
 * Menghitung calon tagihan satu bulan untuk semua siswa, TANPA menyimpan apa pun.
 * PER_SESSION: sesi selesai → absensi → aturan billable → tarif pada tanggal sesi.
 * MONTHLY: tarif tetap, satu tagihan per bulan.
 */
export async function previewInvoices(month: string): Promise<PreviewRow[]> {
  const { from, to } = monthRange(month);
  const today = todayISO();
  const [students, profiles, sessions, attendance, invoices, sessionItems, finance] = await Promise.all([
    listDocs<Student>('students'),
    listAllProfiles(),
    listSessionsInRange(from, to, null),
    listDocs<Attendance>('attendance', where('date', '>=', from), where('date', '<=', to)),
    listDocs<Invoice>(COL),
    listDocs<InvoiceItem>(ITEMS, where('sessionDate', '>=', from), where('sessionDate', '<=', to)),
    getFinanceSettings(),
  ]);

  const liveInvoiceIds = new Set(invoices.filter((i) => i.status !== 'cancelled').map((i) => i.id));
  const billed = new Map<string, Set<string>>();
  for (const item of sessionItems) {
    if (!item.sessionId || !liveInvoiceIds.has(item.invoiceId)) continue;
    billed.set(item.studentId, (billed.get(item.studentId) ?? new Set()).add(item.sessionId));
  }
  const group = <T,>(rows: T[], key: (r: T) => string) => {
    const map = new Map<string, T[]>();
    for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
    return map;
  };
  const profilesByStudent = group<BillingProfile>(profiles, (p) => p.studentId);
  const attendanceByStudent = group<Attendance>(attendance, (a) => a.studentId);

  const rows: PreviewRow[] = [];
  for (const student of [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'))) {
    const versions = profilesByStudent.get(student.id) ?? [];
    const base = { student, items: [] as DraftItem[], discount: 0, additionalFee: 0, additionalFeeLabel: '', subtotal: 0, total: 0, warnings: [] as string[] };
    const version = profileForPeriod(versions, from, to);
    if (!version) {
      if (student.status === 'active') rows.push({ ...base, billingType: null, skipReason: 'Belum ada tarif. Atur di menu Tarif.' });
      continue;
    }
    const row: PreviewRow = {
      ...base,
      billingType: version.billingType,
      discount: version.discount,
      additionalFee: version.additionalFee,
      additionalFeeLabel: version.additionalFeeLabel,
      skipReason: null,
    };

    if (version.billingType === 'MONTHLY') {
      const dup = invoices.find(
        (i) => i.studentId === student.id && i.status !== 'cancelled' && i.billingType === 'MONTHLY' && i.periodStart <= to && i.periodEnd >= from,
      );
      if (dup) row.skipReason = `Sudah ada tagihan bulanan ${dup.invoiceNumber ?? '(draft)'}.`;
      else row.items = computeMonthlyItems(version, month);
    } else {
      const r = computePerSessionItems({
        versions,
        sessions,
        attendance: attendanceByStudent.get(student.id) ?? [],
        billedSessionIds: billed.get(student.id) ?? new Set(),
        rules: finance.billingRules,
        from,
        to,
      });
      row.items = r.items;
      if (r.notBillable.length) row.warnings.push(`${r.notBillable.length} sesi tidak ditagih sesuai aturan absensi`);
      if (r.alreadyBilled) row.warnings.push(`${r.alreadyBilled} sesi sudah ada di tagihan lain`);
      const pending = sessions.filter((s) => s.classId === student.currentClassId && s.status === 'scheduled' && s.date <= today).length;
      if (pending) row.warnings.push(`${pending} sesi kelasnya belum diabsen`);
      if (row.items.length === 0) row.skipReason = 'Tidak ada sesi yang bisa ditagih pada bulan ini.';
    }
    if (!row.skipReason) Object.assign(row, computeTotals(row.items, row.discount, row.additionalFee));
    rows.push(row);
  }
  return rows;
}

/** Menyimpan hasil preview sebagai DRAFT (belum bernomor, belum terlihat orang tua). */
export async function createDraftInvoices(rows: PreviewRow[], month: string) {
  const { from, to } = monthRange(month);
  const finance = await getFinanceSettings();
  const uid = currentUid();
  let created = 0;
  for (const row of rows) {
    if (row.skipReason || !row.billingType) continue;
    const batch = writeBatch(db);
    const invRef = doc(collection(db, COL));
    batch.set(invRef, {
      invoiceNumber: null,
      studentId: row.student.id,
      studentName: row.student.fullName,
      parentIds: row.student.parentIds,
      parentUids: [],
      classId: row.student.currentClassId,
      className: row.student.currentClassName,
      billingType: row.billingType,
      periodStart: from,
      periodEnd: to,
      subtotal: row.subtotal,
      discount: row.discount,
      additionalFee: row.additionalFee,
      additionalFeeLabel: row.additionalFeeLabel,
      total: row.total,
      paidAmount: 0,
      outstandingAmount: row.total,
      dueDate: addDays(todayISO(), finance.defaultDueDays),
      status: 'draft',
      notes: '',
      createdBy: uid,
      issuedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    row.items.forEach((item, order) => {
      batch.set(doc(collection(db, ITEMS)), { ...item, invoiceId: invRef.id, studentId: row.student.id, order, parentUids: [] });
    });
    addAuditLog(batch, {
      action: 'invoice_created',
      module: 'invoices',
      recordId: invRef.id,
      newData: { studentId: row.student.id, billingType: row.billingType, periodStart: from, total: row.total, items: row.items.length },
    });
    await batch.commit();
    created += 1;
  }
  return created;
}

// ------------------------------------------------------------------
// Mengubah draft
// ------------------------------------------------------------------

function assertDraft(invoice: Invoice) {
  if (invoice.status !== 'draft') throw new Error('Hanya tagihan draft yang bisa diubah. Batalkan dan buat ulang jika perlu.');
}

function toMoney(n: number, label: string) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label} tidak valid.`);
  return v;
}

export async function updateDraft(
  invoice: Invoice,
  patch: { discount: number; additionalFee: number; additionalFeeLabel: string; dueDate: string; notes: string },
) {
  assertDraft(invoice);
  if (!patch.dueDate) throw new Error('Jatuh tempo wajib diisi.');
  const items = await listItems(invoice.id);
  const discount = toMoney(patch.discount, 'Diskon');
  const additionalFee = toMoney(patch.additionalFee, 'Biaya tambahan');
  const totals = computeTotals(items, discount, additionalFee);
  const batch = writeBatch(db);
  batch.update(doc(db, COL, invoice.id), {
    discount,
    additionalFee,
    additionalFeeLabel: patch.additionalFeeLabel.trim() || 'Biaya tambahan',
    dueDate: patch.dueDate,
    notes: patch.notes.trim(),
    ...totals,
    outstandingAmount: totals.total,
    updatedAt: serverTimestamp(),
  });
  addAuditLog(batch, {
    action: 'invoice_edited',
    module: 'invoices',
    recordId: invoice.id,
    oldData: { discount: invoice.discount, additionalFee: invoice.additionalFee, total: invoice.total, dueDate: invoice.dueDate },
    newData: { discount, additionalFee, total: totals.total, dueDate: patch.dueDate },
  });
  await batch.commit();
}

export async function addManualItem(invoice: Invoice, input: { description: string; quantity: number; unitPrice: number }) {
  assertDraft(invoice);
  const description = required(input.description, 'Keterangan');
  const quantity = Math.floor(Number(input.quantity));
  if (!quantity || quantity < 1) throw new Error('Jumlah minimal 1.');
  const unitPrice = toMoney(input.unitPrice, 'Harga');
  const items = await listItems(invoice.id);
  const newItem = { description, quantity, unitPrice, amount: quantity * unitPrice, sessionId: null, sessionDate: null };
  const totals = computeTotals([...items, newItem], invoice.discount, invoice.additionalFee);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, ITEMS)), {
    ...newItem,
    invoiceId: invoice.id,
    studentId: invoice.studentId,
    order: items.reduce((m, i) => Math.max(m, i.order), -1) + 1,
    parentUids: [],
  });
  batch.update(doc(db, COL, invoice.id), { ...totals, outstandingAmount: totals.total, updatedAt: serverTimestamp() });
  addAuditLog(batch, { action: 'invoice_edited', module: 'invoices', recordId: invoice.id, newData: { addedItem: description, amount: newItem.amount } });
  await batch.commit();
}

export async function removeItem(invoice: Invoice, item: InvoiceItem) {
  assertDraft(invoice);
  const items = (await listItems(invoice.id)).filter((i) => i.id !== item.id);
  const totals = computeTotals(items, invoice.discount, invoice.additionalFee);
  const batch = writeBatch(db);
  batch.delete(doc(db, ITEMS, item.id));
  batch.update(doc(db, COL, invoice.id), { ...totals, outstandingAmount: totals.total, updatedAt: serverTimestamp() });
  addAuditLog(batch, { action: 'invoice_edited', module: 'invoices', recordId: invoice.id, oldData: { removedItem: item.description, amount: item.amount } });
  await batch.commit();
}

export async function deleteDraft(invoice: Invoice) {
  assertDraft(invoice);
  const items = await listItems(invoice.id);
  const batch = writeBatch(db);
  items.forEach((i) => batch.delete(doc(db, ITEMS, i.id)));
  batch.delete(doc(db, COL, invoice.id));
  await batch.commit();
}

// ------------------------------------------------------------------
// Terbit & batal
// ------------------------------------------------------------------

/** Memberi nomor invoice, mengunci isi, dan membuatnya terlihat oleh orang tua. */
export async function issueInvoice(invoice: Invoice) {
  assertDraft(invoice);
  if (invoice.dueDate < todayISO()) throw new Error('Jatuh tempo sudah lewat. Ubah jatuh tempo terlebih dahulu.');
  const [items, finance] = await Promise.all([listItems(invoice.id), getFinanceSettings()]);
  if (items.length === 0 && invoice.additionalFee === 0) throw new Error('Tagihan masih kosong.');
  const invRef = doc(db, COL, invoice.id);
  let notify: { uids: string[]; number: string; total: number } | null = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    const inv = snap.data() as Invoice | undefined;
    if (!inv || inv.status !== 'draft') throw new Error('Tagihan ini sudah tidak berstatus draft.');
    const studentSnap = await tx.get(doc(db, 'students', invoice.studentId));
    const student = studentSnap.data() as Student | undefined;
    const counter = await readCounter(tx, 'invoice', todayISO());
    const invoiceNumber = counter.number(finance.invoicePrefix);
    const parentUids = student?.parentUids ?? [];
    tx.update(invRef, {
      invoiceNumber,
      status: inv.total === 0 ? 'paid' : 'unpaid',
      paidAmount: 0,
      outstandingAmount: inv.total,
      parentUids,
      parentIds: student?.parentIds ?? inv.parentIds,
      issuedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    items.forEach((i) => tx.update(doc(db, ITEMS, i.id), { parentUids }));
    counter.commit();
    addAuditLog(tx, { action: 'invoice_issued', module: 'invoices', recordId: invoice.id, newData: { invoiceNumber, total: inv.total } });
    notify = { uids: parentUids, number: invoiceNumber, total: inv.total };
  });
  const n = notify as { uids: string[]; number: string; total: number } | null;
  if (n && n.total > 0) {
    await notifyUsers(n.uids, {
      title: `Tagihan baru ${invoice.studentName}`,
      body: `${n.number}: ${formatRupiah(n.total)}, jatuh tempo ${invoice.dueDate.split('-').reverse().join('/')}`,
      link: '/p/invoices',
    });
  }
}

/** Hanya tagihan yang belum menerima pembayaran terverifikasi yang bisa dibatalkan. */
export async function cancelInvoice(invoice: Invoice, reason: string) {
  if (!reason.trim()) throw new Error('Alasan pembatalan wajib diisi.');
  const pending = await listDocs<Payment>('payments', where('invoiceId', '==', invoice.id), where('status', '==', 'pending'));
  if (pending.length) throw new Error('Masih ada pembayaran menunggu verifikasi. Verifikasi atau tolak terlebih dahulu.');
  const invRef = doc(db, COL, invoice.id);
  await runTransaction(db, async (tx) => {
    const inv = (await tx.get(invRef)).data() as Invoice | undefined;
    if (!inv) throw new Error('Tagihan tidak ditemukan.');
    if (inv.status === 'draft') throw new Error('Draft cukup dihapus, tidak perlu dibatalkan.');
    if (inv.status === 'cancelled') throw new Error('Tagihan sudah dibatalkan.');
    if (inv.paidAmount > 0) throw new Error('Tagihan yang sudah menerima pembayaran tidak bisa dibatalkan.');
    tx.update(invRef, { status: 'cancelled', cancelReason: reason.trim(), outstandingAmount: 0, updatedAt: serverTimestamp() });
    addAuditLog(tx, {
      action: 'invoice_cancelled',
      module: 'invoices',
      recordId: invoice.id,
      oldData: { status: inv.status, total: inv.total },
      newData: { status: 'cancelled', reason: reason.trim() },
    });
  });
}
