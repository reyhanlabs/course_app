import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { ClassInput, CourseClass, Teacher } from '../types';
import { addAuditLog } from './audit';
import { getDocById, listDocs, required } from './db';
import { listStudentsInClass } from './students';

const COL = 'classes';

export async function listClasses(): Promise<CourseClass[]> {
  return sortByText(await listDocs<CourseClass>(COL), (c) => c.className);
}

export const getClass = (id: string) => getDocById<CourseClass>(COL, id);

/** Dipakai guru: rules hanya mengizinkan kelas dengan teacherUid miliknya. */
export async function listClassesOfTeacherUser(uid: string): Promise<CourseClass[]> {
  return sortByText(await listDocs<CourseClass>(COL, where('teacherUid', '==', uid)), (c) => c.className);
}

/**
 * Membuat atau mengubah kelas dalam satu batch atomik, termasuk:
 * - sinkronisasi users.classIds guru lama/baru (dipakai Security Rules)
 * - memperbarui nama/level kelas di data siswa aktif bila berubah
 */
export async function saveClass(id: string | null, input: ClassInput): Promise<string> {
  const className = required(input.className, 'Nama kelas');
  if (!input.levelId) throw new Error('Level wajib dipilih.');
  const capacity = Math.max(0, Math.floor(Number(input.capacity) || 0));

  const existing = id ? await getClass(id) : null;
  if (id && !existing) throw new Error('Kelas tidak ditemukan.');

  const all = await listClasses();
  if (all.some((c) => c.id !== id && c.className.toLowerCase() === className.toLowerCase())) {
    throw new Error('Nama kelas sudah dipakai.');
  }

  const newTeacherId = input.teacherId || null;
  const newTeacher = newTeacherId ? await getDocById<Teacher>('teachers', newTeacherId) : null;
  if (newTeacherId && !newTeacher) throw new Error('Guru tidak ditemukan.');

  const classRef = id ? doc(db, COL, id) : doc(collection(db, COL));
  const batch = writeBatch(db);
  const data = {
    className,
    levelId: input.levelId,
    teacherId: newTeacherId,
    teacherUid: newTeacher?.userId ?? null,
    capacity,
    status: input.status,
    updatedAt: serverTimestamp(),
  };

  if (existing) {
    batch.update(classRef, data);
  } else {
    batch.set(classRef, { ...data, roomId: null, createdAt: serverTimestamp() });
  }

  const oldTeacherId = existing?.teacherId ?? null;
  if (oldTeacherId !== newTeacherId) {
    if (oldTeacherId) {
      const oldTeacher = await getDocById<Teacher>('teachers', oldTeacherId);
      if (oldTeacher?.userId) {
        batch.update(doc(db, 'users', oldTeacher.userId), { classIds: arrayRemove(classRef.id), updatedAt: serverTimestamp() });
      }
    }
    if (newTeacher?.userId) {
      batch.update(doc(db, 'users', newTeacher.userId), { classIds: arrayUnion(classRef.id), updatedAt: serverTimestamp() });
    }
    if (existing) {
      addAuditLog(batch, {
        action: 'class_teacher_changed',
        module: 'classes',
        recordId: classRef.id,
        oldData: { teacherId: oldTeacherId },
        newData: { teacherId: newTeacherId },
      });
    }
  }

  if (existing && (existing.className !== className || existing.levelId !== input.levelId)) {
    const students = await listStudentsInClass(classRef.id);
    for (const s of students) {
      batch.update(doc(db, 'students', s.id), {
        currentClassName: className,
        currentLevelId: input.levelId,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
  return classRef.id;
}
