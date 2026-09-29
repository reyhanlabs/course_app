/**
 * Test Security Rules Fase 4: portal orang tua.
 * Jalankan: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (role: string, extra: Record<string, unknown> = {}) => ({ email: `${role}@t.id`, displayName: role, role, active: true, parentId: null, teacherId: null, classIds: [], ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kursus-phase4', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), user('admin'));
    await setDoc(doc(db, 'users/teacherA'), user('teacher', { classIds: ['classA'] }));
    // Parent P: John (classA) & Mary (classB). Parent Q: David (classB).
    await setDoc(doc(db, 'users/parentP'), user('parent', { childIds: ['john', 'mary'], childClassIds: ['classA', 'classB'] }));
    await setDoc(doc(db, 'users/parentQ'), user('parent', { childIds: ['david'], childClassIds: ['classB'] }));
    await setDoc(doc(db, 'users/parentR'), user('parent', { childIds: ['eve'], childClassIds: ['classC'] }));
    await setDoc(doc(db, 'classes/classA'), { className: 'A', teacherUid: 'teacherA' });
    await setDoc(doc(db, 'classes/classC'), { className: 'C', teacherUid: null });
    await setDoc(doc(db, 'sessions/sA'), { classId: 'classA', date: '2026-10-05', status: 'completed' });
    await setDoc(doc(db, 'sessions/sC'), { classId: 'classC', date: '2026-10-05', status: 'completed' });
    await setDoc(doc(db, 'attendance/sA_john'), { classId: 'classA', studentId: 'john', sessionId: 'sA', status: 'present' });
    await setDoc(doc(db, 'attendance/sC_eve'), { classId: 'classC', studentId: 'eve', sessionId: 'sC', status: 'present' });
    await setDoc(doc(db, 'studentProgress/p1'), { classId: 'classC', studentId: 'eve', scores: {} });
    await setDoc(doc(db, 'homework/hA'), { classId: 'classA', status: 'active', title: 'A' });
    await setDoc(doc(db, 'homework/hAclosed'), { classId: 'classA', status: 'closed', title: 'A2' });
    await setDoc(doc(db, 'materials/mPublic'), { title: 'x', visibleToParents: true });
    await setDoc(doc(db, 'materials/mTeacher'), { title: 'kunci', visibleToParents: false });
    await setDoc(doc(db, 'invoices/invP'), { studentId: 'john', parentUids: ['parentP'], status: 'unpaid', total: 500000, paidAmount: 0, outstandingAmount: 500000, billingType: 'MONTHLY' });
  });
});

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();
const sub = (studentId: string, homeworkId: string, classId: string, by: string) => ({
  homeworkId, classId, studentId, studentName: studentId, note: 'ok', fileUrl: null, filePath: null, fileName: null,
  status: 'submitted', feedback: '', submittedBy: by, submittedByName: by,
});
const payment = (by: string, amount: number, extra: Record<string, unknown> = {}) => ({
  paymentNumber: '', invoiceId: 'invP', invoiceNumber: 'INV/1', studentId: 'john', studentName: 'John', parentUids: ['parentP'],
  billingType: 'MONTHLY', amount, paymentDate: '2026-10-05', paymentMethod: 'bank_transfer', referenceNumber: '', notes: '',
  attachmentUrl: 'x', attachmentPath: 'x', status: 'pending', createdBy: by, verifiedBy: null, verifiedAt: null, ...extra,
});

describe('Portal orang tua: data akademik', () => {
  it('membaca kelas, sesi, absensi anaknya', async () => {
    await assertSucceeds(getDoc(doc(dbAs('parentP'), 'classes/classA')));
    await assertSucceeds(getDocs(query(collection(dbAs('parentP'), 'sessions'), where('classId', '==', 'classA'))));
    await assertSucceeds(getDocs(query(collection(dbAs('parentP'), 'attendance'), where('studentId', '==', 'john'))));
  });
  it('tidak bisa membaca kelas/sesi/absensi/perkembangan anak lain', async () => {
    await assertFails(getDoc(doc(dbAs('parentP'), 'classes/classC')));
    await assertFails(getDocs(query(collection(dbAs('parentP'), 'sessions'), where('classId', '==', 'classC'))));
    await assertFails(getDocs(query(collection(dbAs('parentP'), 'attendance'), where('studentId', '==', 'eve'))));
    await assertFails(getDoc(doc(dbAs('parentP'), 'studentProgress/p1')));
  });
  it('hanya materi yang ditandai untuk orang tua', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('parentP'), 'materials'), where('visibleToParents', '==', true))));
    await assertFails(getDoc(doc(dbAs('parentP'), 'materials/mTeacher')));
  });
  it('orang tua tidak bisa mengubah daftar anaknya sendiri', async () => {
    await assertFails(updateDoc(doc(dbAs('parentP'), 'users/parentP'), { childIds: ['john', 'mary', 'eve'] }));
  });
});

describe('Portal orang tua: PR', () => {
  it('mengumpulkan PR anaknya', async () => {
    await assertSucceeds(setDoc(doc(dbAs('parentP'), 'homeworkSubmissions/hA_john'), sub('john', 'hA', 'classA', 'parentP')));
  });
  it('tidak bisa mengumpulkan untuk anak lain, PR tertutup, atau memalsukan pengirim', async () => {
    await assertFails(setDoc(doc(dbAs('parentQ'), 'homeworkSubmissions/hA_john'), sub('john', 'hA', 'classA', 'parentQ')));
    await assertFails(setDoc(doc(dbAs('parentP'), 'homeworkSubmissions/hAclosed_john'), sub('john', 'hAclosed', 'classA', 'parentP')));
    await assertFails(setDoc(doc(dbAs('parentP'), 'homeworkSubmissions/hA_john'), sub('john', 'hA', 'classA', 'teacherA')));
  });
  it('guru kelas memberi umpan balik, tapi tidak mengubah jawaban', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'homeworkSubmissions/hA_john'), sub('john', 'hA', 'classA', 'parentP')));
    await assertSucceeds(updateDoc(doc(dbAs('teacherA'), 'homeworkSubmissions/hA_john'), { status: 'reviewed', feedback: 'Bagus' }));
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'homeworkSubmissions/hA_john'), { note: 'diubah' }));
  });
});

describe('Portal orang tua: bukti bayar', () => {
  it('mengirim bukti bayar (pending) untuk tagihan anaknya', async () => {
    await assertSucceeds(setDoc(doc(dbAs('parentP'), 'payments/pp1'), payment('parentP', 300000)));
  });
  it('tidak bisa menandai terverifikasi, melebihi sisa, atau untuk tagihan orang lain', async () => {
    await assertFails(setDoc(doc(dbAs('parentP'), 'payments/pp2'), payment('parentP', 300000, { status: 'verified' })));
    await assertFails(setDoc(doc(dbAs('parentP'), 'payments/pp3'), payment('parentP', 600000)));
    await assertFails(setDoc(doc(dbAs('parentQ'), 'payments/pp4'), payment('parentQ', 100000)));
  });
  it('tidak bisa mengubah pembayaran setelah dikirim', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'payments/pp5'), payment('parentP', 100000)));
    await assertFails(updateDoc(doc(dbAs('parentP'), 'payments/pp5'), { amount: 1 }));
  });
});
