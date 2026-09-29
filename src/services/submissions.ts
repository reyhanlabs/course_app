import { doc, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Homework, HomeworkSubmission, Student, UserProfile } from '../types';
import { listDocs } from './db';
import { deleteFile, safeFileName } from './storage';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { getDocById } from './db';
import { notifyUsers } from './notifications';
import type { CourseClass } from '../types';

const COL = 'homeworkSubmissions';
const MAX_BYTES = 20 * 1024 * 1024;

/** Orang tua: semua jawaban anak ini */
export function listSubmissionsOfStudent(studentId: string) {
  return listDocs<HomeworkSubmission>(COL, where('studentId', '==', studentId));
}

/** Guru/admin: jawaban untuk satu PR (classId wajib untuk rules guru) */
export function listSubmissionsOfHomework(homework: Homework) {
  return listDocs<HomeworkSubmission>(COL, where('classId', '==', homework.classId), where('homeworkId', '==', homework.id));
}

/** Mengumpulkan atau mengganti jawaban PR. Satu dokumen per siswa per PR. */
export async function submitHomework(
  homework: Homework,
  student: Student,
  input: { note: string; file: File | null },
  existing: HomeworkSubmission | null,
  profile: UserProfile,
) {
  if (homework.status !== 'active') throw new Error('PR ini sudah ditutup.');
  if (!input.file && !input.note.trim() && !existing?.fileUrl) throw new Error('Unggah file jawaban atau tulis catatan.');
  let file = { fileUrl: existing?.fileUrl ?? null, filePath: existing?.filePath ?? null, fileName: existing?.fileName ?? null };
  if (input.file) {
    if (input.file.size > MAX_BYTES) throw new Error('Ukuran file maksimal 20 MB.');
    const path = `homework-submissions/${homework.id}/${student.id}/${Date.now()}-${safeFileName(input.file.name)}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, input.file, { contentType: input.file.type || 'application/octet-stream' });
    file = { fileUrl: await getDownloadURL(fileRef), filePath: path, fileName: input.file.name };
  }
  await setDoc(doc(db, COL, `${homework.id}_${student.id}`), {
    homeworkId: homework.id,
    classId: homework.classId,
    studentId: student.id,
    studentName: student.fullName,
    note: input.note.trim(),
    ...file,
    status: 'submitted',
    feedback: '',
    submittedBy: profile.id,
    submittedByName: profile.displayName,
    submittedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
  });
  if (input.file && existing?.filePath) await deleteFile(existing.filePath);
  const cls = await getDocById<CourseClass>('classes', homework.classId).catch(() => null);
  await notifyUsers([cls?.teacherUid], {
    title: `Jawaban PR dari ${student.fullName}`,
    body: homework.title,
    link: '/homework',
  });
}

/** Guru/admin memberi umpan balik. */
export async function reviewSubmission(submission: HomeworkSubmission, feedback: string, profile: UserProfile) {
  await updateDoc(doc(db, COL, submission.id), {
    status: 'reviewed',
    feedback: feedback.trim(),
    reviewedBy: profile.id,
    reviewedByName: profile.displayName,
    reviewedAt: serverTimestamp(),
  });
  await notifyUsers([submission.submittedBy], {
    title: `PR ${submission.studentName} sudah dinilai`,
    body: feedback.trim().slice(0, 140) || 'Lihat umpan balik guru.',
    link: '/p/homework',
  });
}
