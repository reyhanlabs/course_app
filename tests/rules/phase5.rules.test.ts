/**
 * Test Security Rules Fase 5: pengumuman & notifikasi.
 * Jalankan: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (role: string) => ({ email: `${role}@t.id`, displayName: role, role, active: true, parentId: null, teacherId: null, classIds: [] });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kursus-phase5', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const r of ['admin', 'owner', 'teacher', 'parent']) await setDoc(doc(db, `users/${r}1`), user(r));
    await setDoc(doc(db, 'users/parent2'), user('parent'));
    await setDoc(doc(db, 'announcements/aAll'), { title: 'Libur', audience: 'all', published: true, classIds: [] });
    await setDoc(doc(db, 'announcements/aTeachers'), { title: 'Rapat guru', audience: 'teachers', published: true, classIds: [] });
    await setDoc(doc(db, 'announcements/aDraft'), { title: 'Draft', audience: 'all', published: false, classIds: [] });
    await setDoc(doc(db, 'notifications/n1'), { userId: 'parent1', targetRole: null, title: 'Tagihan', read: false, createdBy: 'admin1', createdAt: new Date() });
    await setDoc(doc(db, 'notifications/nAdmin'), { userId: null, targetRole: 'admin', title: 'Bukti bayar', read: false, createdBy: 'parent1', createdAt: new Date() });
  });
});

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();
const note = (by: string, extra: Record<string, unknown> = {}) => ({ userId: 'parent2', targetRole: null, title: 'x', body: '', link: null, read: false, createdBy: by, createdAt: new Date(), ...extra });

describe('Pengumuman', () => {
  it('orang tua membaca pengumuman untuk orang tua yang terbit', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('parent1'), 'announcements'), where('published', '==', true), where('audience', 'in', ['all', 'parents']))));
  });
  it('orang tua tidak membaca pengumuman guru atau draft', async () => {
    await assertFails(getDoc(doc(dbAs('parent1'), 'announcements/aTeachers')));
    await assertFails(getDoc(doc(dbAs('parent1'), 'announcements/aDraft')));
  });
  it('hanya admin yang menulis', async () => {
    await assertFails(setDoc(doc(dbAs('teacher1'), 'announcements/x'), { title: 'x', audience: 'all', published: true, classIds: [] }));
    await assertSucceeds(setDoc(doc(dbAs('admin1'), 'announcements/x'), { title: 'x', audience: 'all', published: true, classIds: [] }));
  });
});

describe('Notifikasi', () => {
  it('penerima membaca & menandai dibaca, orang lain tidak', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs('parent1'), 'notifications'), where('userId', '==', 'parent1'), orderBy('createdAt', 'desc'), limit(20))));
    await assertFails(getDoc(doc(dbAs('parent2'), 'notifications/n1')));
    await assertSucceeds(updateDoc(doc(dbAs('parent1'), 'notifications/n1'), { read: true }));
    await assertFails(updateDoc(doc(dbAs('parent1'), 'notifications/n1'), { title: 'ubah' }));
  });
  it('notifikasi peran admin hanya untuk admin', async () => {
    await assertSucceeds(getDoc(doc(dbAs('admin1'), 'notifications/nAdmin')));
    await assertFails(getDoc(doc(dbAs('parent1'), 'notifications/nAdmin')));
  });
  it('pembuat harus dirinya sendiri, dan tidak bisa menarget peran selain admin', async () => {
    await assertSucceeds(addDoc(collection(dbAs('teacher1'), 'notifications'), note('teacher1')));
    await assertFails(addDoc(collection(dbAs('teacher1'), 'notifications'), note('admin1')));
    await assertFails(addDoc(collection(dbAs('parent1'), 'notifications'), note('parent1', { userId: null, targetRole: 'teacher' })));
  });
});
