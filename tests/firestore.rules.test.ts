/**
 * Test Security Rules Fase 1 (TEST 6 & TEST 7 dari spesifikasi + eskalasi peran).
 * Jalankan: npm run test:rules   (butuh firebase-tools & Java untuk emulator)
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

const user = (role: string, extra: Record<string, unknown> = {}) => ({
  email: `${role}@test.id`,
  displayName: role,
  role,
  active: true,
  parentId: null,
  teacherId: null,
  classIds: [],
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kursus-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), user('admin'));
    await setDoc(doc(db, 'users/owner1'), user('owner'));
    await setDoc(doc(db, 'users/inactiveAdmin'), user('admin', { active: false }));
    await setDoc(doc(db, 'users/teacherA'), user('teacher', { teacherId: 'tA', classIds: ['classA'] }));
    await setDoc(doc(db, 'users/teacherB'), user('teacher', { teacherId: 'tB', classIds: ['classB'] }));
    await setDoc(doc(db, 'users/parentP'), user('parent', { parentId: 'pP' }));
    await setDoc(doc(db, 'users/parentQ'), user('parent', { parentId: 'pQ' }));

    await setDoc(doc(db, 'parents/pP'), { fullName: 'Parent P', userId: 'parentP' });
    await setDoc(doc(db, 'parents/pQ'), { fullName: 'Parent Q', userId: 'parentQ' });

    await setDoc(doc(db, 'classes/classA'), { className: 'Grade 1 A', teacherId: 'tA', teacherUid: 'teacherA', status: 'active' });
    await setDoc(doc(db, 'classes/classB'), { className: 'Grade 2 A', teacherId: 'tB', teacherUid: 'teacherB', status: 'active' });

    // Parent P punya dua anak (John & Mary). Anak lain milik Parent Q.
    await setDoc(doc(db, 'students/john'), { fullName: 'John', currentClassId: 'classA', parentIds: ['pP'], parentUids: ['parentP'] });
    await setDoc(doc(db, 'students/mary'), { fullName: 'Mary', currentClassId: 'classB', parentIds: ['pP'], parentUids: ['parentP'] });
    await setDoc(doc(db, 'students/david'), { fullName: 'David', currentClassId: 'classB', parentIds: ['pQ'], parentUids: ['parentQ'] });

    await setDoc(doc(db, 'classEnrollments/e1'), { studentId: 'john', classId: 'classA', status: 'active' });
    await setDoc(doc(db, 'classEnrollments/e2'), { studentId: 'david', classId: 'classB', status: 'active' });
  });
});

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();

describe('TEST 6 — orang tua dengan dua anak', () => {
  it('melihat kedua anaknya', async () => {
    const snap = await assertSucceeds(
      getDocs(query(collection(dbAs('parentP'), 'students'), where('parentUids', 'array-contains', 'parentP'))),
    );
    if (snap.size !== 2) throw new Error(`Diharapkan 2 anak, dapat ${snap.size}`);
  });

  it('tidak bisa membaca siswa lain', async () => {
    await assertFails(getDoc(doc(dbAs('parentP'), 'students/david')));
  });

  it('tidak bisa membaca seluruh koleksi siswa', async () => {
    await assertFails(getDocs(collection(dbAs('parentP'), 'students')));
  });

  it('tidak bisa membaca data orang tua lain, hanya dirinya', async () => {
    await assertSucceeds(getDoc(doc(dbAs('parentP'), 'parents/pP')));
    await assertFails(getDoc(doc(dbAs('parentP'), 'parents/pQ')));
  });

  it('tidak bisa mengubah data anak', async () => {
    await assertFails(updateDoc(doc(dbAs('parentP'), 'students/john'), { fullName: 'Hacked' }));
  });
});

describe('TEST 7 — guru Class A tidak bisa mengakses Class B', () => {
  it('membaca kelasnya sendiri', async () => {
    await assertSucceeds(getDoc(doc(dbAs('teacherA'), 'classes/classA')));
    await assertSucceeds(getDocs(query(collection(dbAs('teacherA'), 'classes'), where('teacherUid', '==', 'teacherA'))));
  });

  it('tidak bisa membaca Class B', async () => {
    await assertFails(getDoc(doc(dbAs('teacherA'), 'classes/classB')));
    await assertFails(getDocs(collection(dbAs('teacherA'), 'classes')));
  });

  it('hanya membaca siswa di kelasnya', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('teacherA'), 'students'), where('currentClassId', '==', 'classA'))));
    await assertSucceeds(getDoc(doc(dbAs('teacherA'), 'students/john')));
    await assertFails(getDocs(query(collection(dbAs('teacherA'), 'students'), where('currentClassId', '==', 'classB'))));
    await assertFails(getDoc(doc(dbAs('teacherA'), 'students/david')));
  });

  it('hanya membaca riwayat kelas miliknya', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('teacherA'), 'classEnrollments'), where('classId', '==', 'classA'))));
    await assertFails(getDocs(query(collection(dbAs('teacherA'), 'classEnrollments'), where('classId', '==', 'classB'))));
  });

  it('tidak bisa membaca data orang tua', async () => {
    await assertFails(getDoc(doc(dbAs('teacherA'), 'parents/pP')));
  });
});

describe('Peran & akun', () => {
  it('guru tidak bisa menaikkan perannya sendiri atau menambah kelas', async () => {
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'users/teacherA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(dbAs('teacherA'), 'users/teacherA'), { classIds: ['classA', 'classB'] }));
  });

  it('pengguna bisa membaca profilnya sendiri tapi tidak profil orang lain', async () => {
    await assertSucceeds(getDoc(doc(dbAs('parentP'), 'users/parentP')));
    await assertFails(getDoc(doc(dbAs('parentP'), 'users/parentQ')));
  });

  it('admin nonaktif kehilangan akses', async () => {
    await assertFails(getDocs(collection(dbAs('inactiveAdmin'), 'students')));
  });

  it('owner bisa membaca siswa & kelas tapi tidak bisa mengubah', async () => {
    await assertSucceeds(getDocs(collection(dbAs('owner1'), 'students')));
    await assertSucceeds(getDocs(collection(dbAs('owner1'), 'classes')));
    await assertFails(updateDoc(doc(dbAs('owner1'), 'students/john'), { fullName: 'X' }));
  });

  it('admin punya akses penuh ke data Fase 1', async () => {
    await assertSucceeds(getDocs(collection(dbAs('admin1'), 'parents')));
    await assertSucceeds(updateDoc(doc(dbAs('admin1'), 'students/john'), { nickname: 'Jo' }));
  });

  it('pengguna tanpa login ditolak', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'levels')));
  });
});
