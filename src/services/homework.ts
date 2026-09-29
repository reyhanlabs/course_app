import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Homework, HomeworkInput, UserProfile } from '../types';
import { listDocs, required } from './db';
import { perClass } from './scope';
import { deleteFile, uploadFile } from './storage';
import { notifyUsers } from './notifications';
import type { Student } from '../types';

const COL = 'homework';
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function listHomeworkOfClasses(classIds: string[]): Promise<Homework[]> {
  const rows = await perClass(classIds, (id) => listDocs<Homework>(COL, where('classId', '==', id)));
  return rows.sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));
}

export async function saveHomework(existing: Homework | null, input: HomeworkInput, file: File | null, profile: UserProfile) {
  if (!input.classId) throw new Error('Kelas wajib dipilih.');
  const title = required(input.title, 'Judul PR');
  if (!input.assignedDate || !input.dueDate) throw new Error('Tanggal diberikan dan batas pengumpulan wajib diisi.');
  if (input.dueDate < input.assignedDate) throw new Error('Batas pengumpulan tidak boleh sebelum tanggal diberikan.');
  if (existing && existing.classId !== input.classId) throw new Error('Kelas PR tidak bisa diubah. Buat PR baru untuk kelas lain.');

  const ref = existing ? doc(db, COL, existing.id) : doc(collection(db, COL));
  let attachment = {
    attachmentUrl: existing?.attachmentUrl ?? null,
    attachmentPath: existing?.attachmentPath ?? null,
    attachmentName: existing?.attachmentName ?? null,
  };
  if (file) {
    const up = await uploadFile('homework', ref.id, file, MAX_ATTACHMENT_BYTES);
    attachment = { attachmentUrl: up.url, attachmentPath: up.path, attachmentName: up.name };
  }
  const data = {
    classId: input.classId,
    lessonId: input.lessonId || null,
    title,
    description: input.description.trim(),
    assignedDate: input.assignedDate,
    dueDate: input.dueDate,
    status: input.status,
    ...attachment,
    updatedAt: serverTimestamp(),
  };
  if (existing) {
    await updateDoc(ref, data);
    if (file && existing.attachmentPath) await deleteFile(existing.attachmentPath);
  } else {
    await setDoc(ref, { ...data, createdBy: profile.id, createdByName: profile.displayName, createdAt: serverTimestamp() });
    if (data.status === 'active') {
      const students = await listDocs<Student>('students', where('currentClassId', '==', data.classId)).catch(() => [] as Student[]);
      await notifyUsers(
        students.flatMap((s) => s.parentUids),
        { title: `PR baru: ${title}`, body: `Batas pengumpulan ${data.dueDate.split('-').reverse().join('/')}`, link: '/p/homework' },
      );
    }
  }
}

export async function deleteHomework(homework: Homework) {
  await deleteFile(homework.attachmentPath);
  await deleteDoc(doc(db, COL, homework.id));
}
