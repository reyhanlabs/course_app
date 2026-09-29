import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText } from '../lib/format';
import type { ClassEnrollment, CourseClass, Parent, Student, StudentInput } from '../types';
import { addAuditLog } from './audit';
import { countDocs, currentUid, getDocById, listDocs, required } from './db';
import { uploadPhoto } from './storage';

const COL = 'students';

export async function listStudents(): Promise<Student[]> {
  return sortByText(await listDocs<Student>(COL), (s) => s.fullName);
}

export const getStudent = (id: string) => getDocById<Student>(COL, id);

/** Query ini juga dipakai guru: Security Rules mengizinkan jika classId termasuk kelas guru. */
export async function listStudentsInClass(classId: string): Promise<Student[]> {
  return sortByText(await listDocs<Student>(COL, where('currentClassId', '==', classId)), (s) => s.fullName);
}

export const countStudentsInClass = (classId: string) =>
  countDocs(COL, where('currentClassId', '==', classId));

/** Dipakai portal orang tua. */
export async function listStudentsOfParentUser(uid: string): Promise<Student[]> {
  return sortByText(await listDocs<Student>(COL, where('parentUids', 'array-contains', uid)), (s) => s.fullName);
}

export async function listStudentsOfParent(parentId: string): Promise<Student[]> {
  return sortByText(await listDocs<Student>(COL, where('parentIds', 'array-contains', parentId)), (s) => s.fullName);
}

function cleanInput(input: StudentInput) {
  return {
    fullName: required(input.fullName, 'Nama lengkap'),
    nickname: input.nickname.trim(),
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    school: input.school.trim(),
    schoolGrade: input.schoolGrade.trim(),
    address: input.address.trim(),
    startDate: input.startDate,
    currentLevelId: input.currentLevelId || null,
    status: input.status,
    notes: input.notes.trim(),
  };
}

export async function createStudent(input: StudentInput): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...cleanInput(input),
    photoUrl: null,
    photoPath: null,
    currentClassId: null,
    currentClassName: null,
    parentIds: [],
    parentUids: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Level siswa yang sudah punya kelas mengikuti level kelas, jadi tidak diubah di sini. */
export async function updateStudent(student: Student, input: StudentInput) {
  const data = cleanInput(input);
  if (student.currentClassId) data.currentLevelId = student.currentLevelId;
  await updateDoc(doc(db, COL, student.id), { ...data, updatedAt: serverTimestamp() });
}

export async function setStudentPhoto(studentId: string, oldPath: string | null, file: File) {
  const { url, path } = await uploadPhoto('students', studentId, file, oldPath);
  await updateDoc(doc(db, COL, studentId), { photoUrl: url, photoPath: path, updatedAt: serverTimestamp() });
}

// ---------------- Kelas & riwayat kelas ----------------

export async function listEnrollmentsOfStudent(studentId: string): Promise<ClassEnrollment[]> {
  const rows = await listDocs<ClassEnrollment>('classEnrollments', where('studentId', '==', studentId));
  return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * Memindahkan siswa ke kelas lain (atau mengeluarkan jika newClassId = null).
 * Riwayat lama ditutup dengan endDate, tidak ditimpa — penting untuk laporan
 * akademik dan keuangan historis.
 */
export async function changeStudentClass(
  studentId: string,
  newClassId: string | null,
  effectiveDate: string,
  note: string,
) {
  if (!effectiveDate) throw new Error('Tanggal efektif wajib diisi.');
  const student = await getStudent(studentId);
  if (!student) throw new Error('Siswa tidak ditemukan.');
  if (student.currentClassId === newClassId) throw new Error('Siswa sudah berada di kelas tersebut.');

  let newClass: CourseClass | null = null;
  if (newClassId) {
    newClass = await getDocById<CourseClass>('classes', newClassId);
    if (!newClass) throw new Error('Kelas tujuan tidak ditemukan.');
    if (newClass.status !== 'active') throw new Error('Kelas tujuan tidak aktif.');
    if (newClass.capacity > 0) {
      const count = await countStudentsInClass(newClassId);
      if (count >= newClass.capacity) {
        throw new Error(`Kelas ${newClass.className} sudah penuh (kapasitas ${newClass.capacity} siswa).`);
      }
    }
  }

  const activeEnrollments = await listDocs<ClassEnrollment>(
    'classEnrollments',
    where('studentId', '==', studentId),
    where('status', '==', 'active'),
  );
  for (const e of activeEnrollments) {
    if (e.startDate > effectiveDate) {
      throw new Error('Tanggal efektif tidak boleh lebih awal dari tanggal masuk kelas sebelumnya.');
    }
  }

  const batch = writeBatch(db);
  for (const e of activeEnrollments) {
    batch.update(doc(db, 'classEnrollments', e.id), { status: 'ended', endDate: effectiveDate });
  }
  if (newClass) {
    batch.set(doc(collection(db, 'classEnrollments')), {
      studentId,
      classId: newClass.id,
      className: newClass.className,
      levelId: newClass.levelId,
      startDate: effectiveDate,
      endDate: null,
      status: 'active',
      note: note.trim(),
      createdBy: currentUid(),
      createdAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, COL, studentId), {
    currentClassId: newClass?.id ?? null,
    currentClassName: newClass?.className ?? null,
    currentLevelId: newClass ? newClass.levelId : student.currentLevelId,
    updatedAt: serverTimestamp(),
  });
  addAuditLog(batch, {
    action: 'student_class_changed',
    module: 'students',
    recordId: studentId,
    oldData: { classId: student.currentClassId, className: student.currentClassName },
    newData: { classId: newClass?.id ?? null, className: newClass?.className ?? null, effectiveDate, note: note.trim() },
  });
  await batch.commit();
}

// ---------------- Relasi orang tua ----------------

export async function linkParent(studentId: string, parent: Parent) {
  await updateDoc(doc(db, COL, studentId), {
    parentIds: arrayUnion(parent.id),
    ...(parent.userId ? { parentUids: arrayUnion(parent.userId) } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function unlinkParent(studentId: string, parent: Parent) {
  await updateDoc(doc(db, COL, studentId), {
    parentIds: arrayRemove(parent.id),
    ...(parent.userId ? { parentUids: arrayRemove(parent.userId) } : {}),
    updatedAt: serverTimestamp(),
  });
}
