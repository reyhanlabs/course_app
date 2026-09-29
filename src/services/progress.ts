import { addDoc, collection, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayISO } from '../lib/format';
import { SKILLS, type ProgressRecord, type SkillScores, type UserProfile } from '../types';
import { getDocById, listDocs } from './db';
import { notifyUsers } from './notifications';
import type { Student } from '../types';

const COL = 'studentProgress';

function sortNewest(rows: ProgressRecord[]) {
  return rows.sort((a, b) => b.assessedAt.localeCompare(a.assessedAt) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/** Guru & admin (per kelas) */
export async function listProgressOfClass(classId: string) {
  return sortNewest(await listDocs<ProgressRecord>(COL, where('classId', '==', classId)));
}

/** Admin & owner: seluruh riwayat siswa lintas kelas */
export async function listProgressOfStudent(studentId: string) {
  return sortNewest(await listDocs<ProgressRecord>(COL, where('studentId', '==', studentId)));
}

/** Penilaian baru selalu jadi dokumen baru. Penilaian lama tidak pernah diubah. */
export async function createProgress(
  input: { studentId: string; studentName: string; classId: string; assessedAt: string; scores: SkillScores; notes: string },
  profile: UserProfile,
) {
  if (!input.assessedAt) throw new Error('Tanggal penilaian wajib diisi.');
  if (input.assessedAt > todayISO()) throw new Error('Tanggal penilaian tidak boleh di masa depan.');
  const scores: SkillScores = {};
  for (const skill of SKILLS) {
    const v = input.scores[skill];
    scores[skill] = v && v >= 1 && v <= 5 ? Math.round(v) : null;
  }
  if (SKILLS.every((s) => scores[s] === null)) throw new Error('Isi minimal satu nilai keterampilan.');
  await addDoc(collection(db, COL), {
    studentId: input.studentId,
    studentName: input.studentName,
    classId: input.classId,
    assessedAt: input.assessedAt,
    scores,
    notes: input.notes.trim(),
    recordedBy: profile.id,
    recordedByName: profile.displayName,
    createdAt: serverTimestamp(),
  });
  const student = await getDocById<Student>('students', input.studentId).catch(() => null);
  await notifyUsers(student?.parentUids ?? [], {
    title: `Penilaian baru untuk ${input.studentName}`,
    body: input.notes.trim().slice(0, 140) || 'Lihat perkembangan terbaru.',
    link: '/p/progress',
  });
}

export function averageScore(scores: SkillScores): number | null {
  const values = SKILLS.map((s) => scores[s]).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
