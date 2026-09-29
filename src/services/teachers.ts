import { addDoc, collection, doc, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { CourseClass, Teacher, TeacherInput } from '../types';
import { createAuthAccount, isValidEmail, sendSetupEmail } from './accounts';
import { addAuditLog } from './audit';
import { getDocById, listDocs, required } from './db';
import { uploadPhoto } from './storage';

const COL = 'teachers';

export async function listTeachers(): Promise<Teacher[]> {
  return sortByText(await listDocs<Teacher>(COL), (t) => t.fullName);
}

export const getTeacher = (id: string) => getDocById<Teacher>(COL, id);

function cleanInput(input: TeacherInput) {
  const email = input.email.trim().toLowerCase();
  if (email && !isValidEmail(email)) throw new Error('Format email tidak valid.');
  return {
    fullName: required(input.fullName, 'Nama lengkap'),
    phone: input.phone.trim(),
    email,
    address: input.address.trim(),
    specialization: input.specialization.trim(),
    status: input.status,
  };
}

export async function createTeacher(input: TeacherInput): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...cleanInput(input),
    userId: null,
    photoUrl: null,
    photoPath: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTeacher(teacher: Teacher, input: TeacherInput) {
  const data = cleanInput(input);
  if (teacher.userId && data.email !== teacher.email) {
    throw new Error('Guru ini sudah punya akun login, jadi emailnya tidak bisa diubah di sini.');
  }
  await updateDoc(doc(db, COL, teacher.id), { ...data, updatedAt: serverTimestamp() });
}

export async function setTeacherPhoto(teacherId: string, oldPath: string | null, file: File) {
  const { url, path } = await uploadPhoto('teachers', teacherId, file, oldPath);
  await updateDoc(doc(db, COL, teacherId), { photoUrl: url, photoPath: path, updatedAt: serverTimestamp() });
}

/**
 * Membuat akun login guru. Kelas yang sudah diajar disalin ke users.classIds
 * dan classes.teacherUid supaya Security Rules langsung berlaku.
 */
export async function createTeacherAccount(teacher: Teacher) {
  if (teacher.userId) throw new Error('Guru ini sudah punya akun.');
  if (!teacher.email || !isValidEmail(teacher.email)) {
    throw new Error('Isi email guru yang valid terlebih dahulu.');
  }
  const classes = await listDocs<CourseClass>('classes', where('teacherId', '==', teacher.id));
  const uid = await createAuthAccount(teacher.email);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    email: teacher.email,
    displayName: teacher.fullName,
    role: 'teacher',
    active: true,
    parentId: null,
    teacherId: teacher.id,
    classIds: classes.map((c) => c.id),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, COL, teacher.id), { userId: uid, updatedAt: serverTimestamp() });
  for (const c of classes) {
    batch.update(doc(db, 'classes', c.id), { teacherUid: uid, updatedAt: serverTimestamp() });
  }
  addAuditLog(batch, {
    action: 'user_account_created',
    module: 'users',
    recordId: uid,
    newData: { role: 'teacher', teacherId: teacher.id, email: teacher.email },
  });
  await batch.commit();
  await sendSetupEmail(teacher.email);
}
