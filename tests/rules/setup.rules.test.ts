/**
 * Test setup admin pertama dari aplikasi.
 * Jalankan: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-kursus-setup', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

const ctx = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@t.id` }).firestore();
const profile = (uid: string, role = 'admin') => ({ email: `${uid}@t.id`, displayName: uid, role, active: true, parentId: null, teacherId: null, classIds: [] });

function setupBatch(uid: string, role = 'admin') {
  const db = ctx(uid);
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid), profile(uid, role));
  b.set(doc(db, 'system', 'setup'), { adminUid: uid });
  return b.commit();
}

describe('Setup admin pertama', () => {
  it('siapa pun bisa mengecek status setup tanpa login', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'system', 'setup')));
  });
  it('pengguna pertama bisa menjadikan dirinya admin', async () => {
    await assertSucceeds(setupBatch('alice'));
  });
  it('setelah setup, orang lain tidak bisa mengulang', async () => {
    await assertSucceeds(setupBatch('alice'));
    await assertFails(setupBatch('mallory'));
  });
  it('tidak bisa membuat profil admin tanpa penanda setup, atau untuk uid lain', async () => {
    await assertFails(setDoc(doc(ctx('alice'), 'users', 'alice'), profile('alice')));
    const db = ctx('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'users', 'bob'), profile('bob'));
    b.set(doc(db, 'system', 'setup'), { adminUid: 'alice' });
    await assertFails(b.commit());
  });
  it('penanda setup tidak bisa diubah atau dihapus', async () => {
    await assertSucceeds(setupBatch('alice'));
    await assertFails(setDoc(doc(ctx('alice'), 'system', 'setup'), { adminUid: 'x' }));
  });
});
