/**
 * Test Security Rules Fase 3: keuangan.
 * Jalankan: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (role: string, extra: Record<string, unknown> = {}) => ({ email: `${role}@t.id`, displayName: role, role, active: true, parentId: null, teacherId: null, classIds: [], ...extra });
const invoice = (status: string, parentUids: string[], extra: Record<string, unknown> = {}) => ({
  studentId: 'john', studentName: 'John', parentUids, status, total: 500000, paidAmount: 0, outstandingAmount: 500000, billingType: 'MONTHLY', ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kursus-phase3', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), user('admin'));
    await setDoc(doc(db, 'users/owner1'), user('owner'));
    await setDoc(doc(db, 'users/teacherA'), user('teacher', { classIds: ['classA'] }));
    await setDoc(doc(db, 'users/parentP'), user('parent'));
    await setDoc(doc(db, 'users/parentQ'), user('parent'));
    await setDoc(doc(db, 'invoices/invP'), invoice('unpaid', ['parentP']));
    // Draft selalu dibuat dengan parentUids kosong (diisi saat terbit).
    await setDoc(doc(db, 'invoices/invPdraft'), invoice('draft', []));
    await setDoc(doc(db, 'invoices/invQ'), invoice('unpaid', ['parentQ'], { studentId: 'david' }));
    await setDoc(doc(db, 'payments/payV'), { invoiceId: 'invP', parentUids: ['parentP'], status: 'verified', amount: 300000 });
    await setDoc(doc(db, 'payments/payPending'), { invoiceId: 'invP', parentUids: ['parentP'], status: 'pending', amount: 100000 });
    await setDoc(doc(db, 'receipts/payV'), { invoiceId: 'invP', parentUids: ['parentP'], amount: 300000 });
    await setDoc(doc(db, 'counters/invoice-202610'), { next: 5 });
  });
});

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();

describe('Keuangan: orang tua hanya melihat miliknya (TEST 6)', () => {
  it('orang tua membaca tagihan, pembayaran, dan kuitansi anaknya', async () => {
    await assertSucceeds(getDoc(doc(dbAs('parentP'), 'invoices/invP')));
    await assertSucceeds(getDocs(query(collection(dbAs('parentP'), 'payments'), where('parentUids', 'array-contains', 'parentP'))));
    await assertSucceeds(getDoc(doc(dbAs('parentP'), 'receipts/payV')));
  });
  it('orang tua tidak bisa membaca tagihan/pembayaran/kuitansi orang lain', async () => {
    await assertFails(getDoc(doc(dbAs('parentQ'), 'invoices/invP')));
    await assertFails(getDoc(doc(dbAs('parentQ'), 'payments/payV')));
    await assertFails(getDoc(doc(dbAs('parentQ'), 'receipts/payV')));
    await assertFails(getDocs(collection(dbAs('parentP'), 'invoices')));
  });
  it('orang tua tidak melihat draft (parentUids kosong sampai terbit)', async () => {
    await assertFails(getDoc(doc(dbAs('parentP'), 'invoices/invPdraft')));
  });
  it('orang tua tidak bisa mengubah tagihan', async () => {
    await assertFails(updateDoc(doc(dbAs('parentP'), 'invoices/invP'), { status: 'paid' }));
  });
});

describe('Keuangan: guru tidak punya akses', () => {
  it('guru tidak bisa membaca data keuangan apa pun', async () => {
    await assertFails(getDoc(doc(dbAs('teacherA'), 'invoices/invP')));
    await assertFails(getDocs(collection(dbAs('teacherA'), 'payments')));
    await assertFails(getDocs(collection(dbAs('teacherA'), 'billingProfiles')));
  });
});

describe('Keuangan: integritas', () => {
  it('owner hanya membaca', async () => {
    await assertSucceeds(getDoc(doc(dbAs('owner1'), 'invoices/invP')));
    await assertFails(updateDoc(doc(dbAs('owner1'), 'invoices/invP'), { status: 'cancelled' }));
  });
  it('tagihan terbit tidak bisa dihapus, draft bisa', async () => {
    await assertFails(deleteDoc(doc(dbAs('admin1'), 'invoices/invP')));
    await assertSucceeds(deleteDoc(doc(dbAs('admin1'), 'invoices/invPdraft')));
  });
  it('tagihan baru harus draft', async () => {
    await assertFails(setDoc(doc(dbAs('admin1'), 'invoices/x'), invoice('paid', [])));
    await assertSucceeds(setDoc(doc(dbAs('admin1'), 'invoices/y'), invoice('draft', [])));
  });
  it('paidAmount tidak boleh melebihi total', async () => {
    await assertFails(updateDoc(doc(dbAs('admin1'), 'invoices/invP'), { paidAmount: 600000 }));
  });
  it('pembayaran terverifikasi dan kuitansi tidak bisa diubah', async () => {
    await assertFails(updateDoc(doc(dbAs('admin1'), 'payments/payV'), { amount: 1 }));
    await assertSucceeds(updateDoc(doc(dbAs('admin1'), 'payments/payPending'), { status: 'rejected' }));
    await assertFails(updateDoc(doc(dbAs('admin1'), 'receipts/payV'), { amount: 1 }));
  });
  it('penomoran hanya bisa diakses admin', async () => {
    await assertFails(getDoc(doc(dbAs('owner1'), 'counters/invoice-202610')));
    await assertSucceeds(getDoc(doc(dbAs('admin1'), 'counters/invoice-202610')));
  });
});
