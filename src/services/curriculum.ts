import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Lesson, LessonInput, Semester } from '../types';
import { countDocs, getDocById, listDocs, required } from './db';

export async function listSemesters(levelId: string): Promise<Semester[]> {
  const rows = await listDocs<Semester>('semesters', where('levelId', '==', levelId));
  return rows.sort((a, b) => a.order - b.order);
}

export async function saveSemester(id: string | null, levelId: string, name: string, existing: Semester[]) {
  const clean = required(name, 'Nama semester');
  if (id) {
    await updateDoc(doc(db, 'semesters', id), { name: clean, updatedAt: serverTimestamp() });
  } else {
    const order = existing.reduce((m, s) => Math.max(m, s.order), 0) + 1;
    await addDoc(collection(db, 'semesters'), { levelId, name: clean, order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function deleteSemester(semester: Semester) {
  const lessons = await countDocs('lessons', where('semesterId', '==', semester.id));
  if (lessons > 0) throw new Error('Hapus atau pindahkan semua pelajaran di semester ini terlebih dahulu.');
  await deleteDoc(doc(db, 'semesters', semester.id));
}

export async function listLessonsOfLevel(levelId: string): Promise<Lesson[]> {
  const rows = await listDocs<Lesson>('lessons', where('levelId', '==', levelId));
  return rows.sort((a, b) => a.weekNumber - b.weekNumber || a.title.localeCompare(b.title));
}

export const getLesson = (id: string) => getDocById<Lesson>('lessons', id);

export async function saveLesson(id: string | null, input: LessonInput) {
  if (!input.semesterId) throw new Error('Semester wajib dipilih.');
  const week = Math.floor(Number(input.weekNumber));
  if (!week || week < 1) throw new Error('Minggu ke- harus angka 1 atau lebih.');
  const data = {
    ...input,
    title: required(input.title, 'Judul pelajaran'),
    weekNumber: week,
    duration: Math.max(0, Math.floor(Number(input.duration) || 0)),
    updatedAt: serverTimestamp(),
  };
  if (id) await updateDoc(doc(db, 'lessons', id), data);
  else await addDoc(collection(db, 'lessons'), { ...data, createdAt: serverTimestamp() });
}

export async function deleteLesson(lesson: Lesson) {
  const used = await countDocs('sessions', where('lessonId', '==', lesson.id));
  if (used > 0) throw new Error(`Pelajaran ini sudah dipakai di ${used} sesi, jadi tidak bisa dihapus.`);
  await deleteDoc(doc(db, 'lessons', lesson.id));
}
