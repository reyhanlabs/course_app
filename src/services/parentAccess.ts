import { doc, serverTimestamp, updateDoc, where, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { BillingProfile, Invoice, InvoiceItem, Parent, Payment, Receipt, Student } from '../types';
import { getDocById, listDocs } from './db';

/**
 * Akses orang tua di Security Rules bergantung pada field yang disalin:
 * - users/{uid}.childIds & childClassIds  → jadwal, sesi, absensi, PR, perkembangan
 * - parentUids di dokumen keuangan        → tagihan, pembayaran, kuitansi, tarif
 * Fungsi di sini menyelaraskannya setelah relasi orang tua / kelas berubah.
 */

/** Menghitung ulang anak & kelas anak untuk akun-akun orang tua. */
export async function syncParentUsers(uids: (string | null | undefined)[]) {
  const unique = [...new Set(uids.filter((u): u is string => Boolean(u)))];
  for (const uid of unique) {
    const children = await listDocs<Student>('students', where('parentUids', 'array-contains', uid));
    await updateDoc(doc(db, 'users', uid), {
      childIds: children.map((c) => c.id),
      childClassIds: [...new Set(children.map((c) => c.currentClassId).filter((id): id is string => Boolean(id)))],
      updatedAt: serverTimestamp(),
    });
  }
}

/** Menyalin parentUids siswa ke semua dokumen keuangannya (kecuali draft & tagihan batal). */
export async function syncStudentFinanceParents(studentId: string) {
  const student = await getDocById<Student>('students', studentId);
  if (!student) return;
  const uids = student.parentUids;
  const [invoices, payments, receipts, profiles] = await Promise.all([
    listDocs<Invoice>('invoices', where('studentId', '==', studentId)),
    listDocs<Payment>('payments', where('studentId', '==', studentId)),
    listDocs<Receipt>('receipts', where('studentId', '==', studentId)),
    listDocs<BillingProfile>('billingProfiles', where('studentId', '==', studentId)),
  ]);
  const issued = invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');
  const items = (
    await Promise.all(issued.map((i) => listDocs<InvoiceItem>('invoiceItems', where('invoiceId', '==', i.id))))
  ).flat();

  const same = (a: string[] = [], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const refs: DocumentReference[] = [
    ...issued.filter((i) => !same(i.parentUids, uids)).map((i) => doc(db, 'invoices', i.id)),
    ...items.filter((i) => !same(i.parentUids, uids)).map((i) => doc(db, 'invoiceItems', i.id)),
    ...payments.filter((p) => !same(p.parentUids, uids)).map((p) => doc(db, 'payments', p.id)),
    ...receipts.filter((r) => !same(r.parentUids, uids)).map((r) => doc(db, 'receipts', r.id)),
    ...profiles.filter((p) => !same(p.parentUids, uids)).map((p) => doc(db, 'billingProfiles', p.id)),
  ];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.update(ref, { parentUids: uids }));
    await batch.commit();
  }
  return refs.length;
}

/** Tombol perbaikan di menu Orang Tua: menyelaraskan semua akses orang tua. */
export async function syncAllParentAccess() {
  const [parents, students] = await Promise.all([listDocs<Parent>('parents'), listDocs<Student>('students')]);
  await syncParentUsers(parents.map((p) => p.userId));
  let updated = 0;
  for (const s of students) {
    // parentUids siswa dibangun ulang dari parentIds (sumber kebenaran relasi).
    const expected = parents.filter((p) => s.parentIds.includes(p.id) && p.userId).map((p) => p.userId as string);
    const current = s.parentUids ?? [];
    if (expected.length !== current.length || expected.some((u) => !current.includes(u))) {
      await updateDoc(doc(db, 'students', s.id), { parentUids: expected, updatedAt: serverTimestamp() });
    }
    updated += (await syncStudentFinanceParents(s.id)) ?? 0;
  }
  await syncParentUsers(parents.map((p) => p.userId));
  return { parents: parents.filter((p) => p.userId).length, documents: updated };
}
