/**
 * Test Security Rules Fase 2: sesi, absensi, perkembangan, PR, materi.
 * Jalankan: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (role: string, extra: Record<string, unknown> = {}) => ({ email: `${role}@t.id`, displayName: role, role, active: true, parentId: null, teacherId: null, classIds: [], ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kursus-phase2', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
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
    await setDoc(doc(db, 'students/john'), { fullName: 'John', currentClassId: 'classA', parentUids: ['parentP'] });
    await setDoc(doc(db, 'students/david'), { fullName: 'David', currentClassId: 'classB', parentUids: [] });
    const session = (classId: string, status = 'scheduled') => ({ classId, date: '2026-10-05', startTime: '15:00', endTime: '16:00', status, topic: '', lessonId: null, notes: '' });
    await setDoc(doc(db, 'sessions/sA'), session('classA'));
    await setDoc(doc(db, 'sessions/sB'), session('classB'));
    await setDoc(doc(db, 'sessions/sAcancelled'), session('classA', 'cancelled'));
    await setDoc(doc(db, 'homework/hB'), { classId: 'classB', title: 'B', createdBy: 'admin1' });
  });
});

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();
const att = (sessionId: string, classId: string, studentId: string, uid: string, status = 'present') => ({
  sessionId, classId, studentId, studentName: studentId, date: '2026-10-05', status, checkInTime: '', notes: '', recordedBy: uid,
});

describe('Sesi', () => {
  it('guru membaca sesi kelasnya saja', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('teacherA'), 'sessions'), where('classId', '==', 'classA'))));
    await assertFails(getDoc(doc(dbAs('teacherA'), 'sessions/sB')));
  });
  it('guru boleh mengisi topik & menyelesaikan sesi, tapi tidak mengubah tanggal atau membatalkan', async () => {
    await assertSucceeds(updateDoc(doc(dbAs('teacherA'), 'sessions/sA'), { topic: 'Greetings', status: 'completed' }));
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'sessions/sA'), { date: '2026-10-06' }));
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'sessions/sA'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'sessions/sAcancelled'), { status: 'completed' }));
  });
  it('orang tua tanpa anak di kelas itu tidak bisa membaca sesi', async () => {
    await assertFails(getDoc(doc(dbAs('parentP'), 'sessions/sA')));
  });
});

describe('Absensi', () => {
  it('guru mengabsen siswa di sesi kelasnya', async () => {
    await assertSucceeds(setDoc(doc(dbAs('teacherA'), 'attendance/sA_john'), att('sA', 'classA', 'john', 'teacherA')));
  });
  it('guru tidak bisa mengabsen sesi kelas lain atau memalsukan classId', async () => {
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/sB_david'), att('sB', 'classB', 'david', 'teacherA')));
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/sB_david'), att('sB', 'classA', 'david', 'teacherA')));
  });
  it('tidak bisa mengabsen sesi batal, status tidak valid, atau id tidak sesuai', async () => {
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/sAcancelled_john'), att('sAcancelled', 'classA', 'john', 'teacherA')));
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/sA_john'), att('sA', 'classA', 'john', 'teacherA', 'bolos')));
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/random'), att('sA', 'classA', 'john', 'teacherA')));
  });
  it('recordedBy harus pengguna itu sendiri', async () => {
    await assertFails(setDoc(doc(dbAs('teacherA'), 'attendance/sA_john'), att('sA', 'classA', 'john', 'admin1')));
  });
  it('owner hanya membaca', async () => {
    await assertFails(setDoc(doc(dbAs('owner1'), 'attendance/sA_john'), att('sA', 'classA', 'john', 'owner1')));
  });
});

describe('Perkembangan siswa (append-only)', () => {
  const rec = (studentId: string, classId: string, uid: string, scores: Record<string, unknown> = { speaking: 4 }) => ({
    studentId, studentName: studentId, classId, assessedAt: '2026-10-05', scores, notes: '', recordedBy: uid, recordedByName: uid,
  });
  it('guru menilai siswa di kelasnya', async () => {
    await assertSucceeds(addDoc(collection(dbAs('teacherA'), 'studentProgress'), rec('john', 'classA', 'teacherA')));
  });
  it('guru tidak bisa menilai siswa kelas lain', async () => {
    await assertFails(addDoc(collection(dbAs('teacherA'), 'studentProgress'), rec('david', 'classA', 'teacherA')));
    await assertFails(addDoc(collection(dbAs('teacherA'), 'studentProgress'), rec('david', 'classB', 'teacherA')));
  });
  it('nilai harus 1–5 dan keterampilan dikenal', async () => {
    await assertFails(addDoc(collection(dbAs('teacherA'), 'studentProgress'), rec('john', 'classA', 'teacherA', { speaking: 9 })));
    await assertFails(addDoc(collection(dbAs('teacherA'), 'studentProgress'), rec('john', 'classA', 'teacherA', { dancing: 3 })));
  });
  it('penilaian lama tidak bisa diubah atau dihapus, bahkan oleh admin', async () => {
    const ref = await addDoc(collection(dbAs('admin1'), 'studentProgress'), rec('john', 'classA', 'admin1'));
    await assertFails(updateDoc(doc(dbAs('admin1'), 'studentProgress', ref.id), { notes: 'ubah' }));
    await assertFails(deleteDoc(doc(dbAs('admin1'), 'studentProgress', ref.id)));
  });
});

describe('PR & materi', () => {
  it('guru tidak bisa membaca atau membuat PR kelas lain', async () => {
    await assertFails(getDoc(doc(dbAs('teacherA'), 'homework/hB')));
    await assertFails(addDoc(collection(dbAs('teacherA'), 'homework'), { classId: 'classB', title: 'x', createdBy: 'teacherA' }));
    await assertSucceeds(addDoc(collection(dbAs('teacherA'), 'homework'), { classId: 'classA', title: 'x', createdBy: 'teacherA' }));
  });
  it('orang tua tidak bisa membaca seluruh materi tanpa filter visibleToParents', async () => {
    await assertFails(getDocs(collection(dbAs('parentP'), 'materials')));
  });
});
