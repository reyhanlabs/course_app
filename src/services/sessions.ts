import { doc, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addDays, daysBetween, isoDayOfWeek, timeToMinutes, timesOverlap } from '../lib/format';
import type { CourseClass, Schedule, Session } from '../types';
import { getDocById, listDocs } from './db';
import { perClass } from './scope';
import { listSchedules } from './schedules';
import { notifyUsers } from './notifications';
import type { Student } from '../types';

const COL = 'sessions';
const MAX_GENERATE_DAYS = 62;

function sortSessions(rows: Session[]) {
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export const getSession = (id: string) => getDocById<Session>(COL, id);

/**
 * classIds = null → semua kelas (admin/owner).
 * Guru wajib mengirim classIds miliknya (query per kelas + rentang tanggal,
 * memakai composite index sessions: classId + date).
 */
export async function listSessionsInRange(from: string, to: string, classIds: string[] | null): Promise<Session[]> {
  if (classIds === null) {
    return sortSessions(await listDocs<Session>(COL, where('date', '>=', from), where('date', '<=', to)));
  }
  return sortSessions(
    await perClass(classIds, (id) =>
      listDocs<Session>(COL, where('classId', '==', id), where('date', '>=', from), where('date', '<=', to)),
    ),
  );
}

/**
 * Membuat sesi nyata dari jadwal aktif untuk rentang tanggal.
 * Id sesi = `${scheduleId}_${date}`, jadi aman dijalankan berulang (tidak dobel).
 */
export async function generateSessionsFromSchedules(from: string, to: string) {
  if (!from || !to || to < from) throw new Error('Rentang tanggal tidak valid.');
  if (daysBetween(from, to) > MAX_GENERATE_DAYS) throw new Error(`Maksimal ${MAX_GENERATE_DAYS} hari sekali proses.`);

  const [schedules, classes, existing] = await Promise.all([
    listSchedules(),
    listDocs<CourseClass>('classes', where('status', '==', 'active')),
    listSessionsInRange(from, to, null),
  ]);
  const activeClassIds = new Set(classes.map((c) => c.id));
  const existingIds = new Set(existing.map((s) => s.id));
  const active = schedules.filter((s) => s.status === 'active' && activeClassIds.has(s.classId));

  const toCreate: { id: string; schedule: Schedule; date: string }[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const dow = isoDayOfWeek(date);
    for (const s of active) {
      if (s.dayOfWeek !== dow) continue;
      const id = `${s.id}_${date}`;
      if (!existingIds.has(id)) toCreate.push({ id, schedule: s, date });
    }
  }

  for (let i = 0; i < toCreate.length; i += 400) {
    const batch = writeBatch(db);
    for (const { id, schedule, date } of toCreate.slice(i, i + 400)) {
      batch.set(doc(db, COL, id), {
        classId: schedule.classId,
        scheduleId: schedule.id,
        teacherId: schedule.teacherId,
        roomId: schedule.roomId,
        date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        topic: '',
        lessonId: null,
        status: 'scheduled',
        notes: '',
        completedAt: null,
        completedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return { created: toCreate.length, existing: existing.filter((s) => s.scheduleId).length };
}

/** Sesi tambahan/pengganti di luar jadwal rutin. Dicek bentrok dengan sesi lain di tanggal yang sama. */
export async function createExtraSession(input: {
  classId: string;
  teacherId: string | null;
  roomId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
}) {
  if (!input.classId || !input.date) throw new Error('Kelas dan tanggal wajib diisi.');
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) throw new Error('Jam selesai harus setelah jam mulai.');
  const sameDay = await listDocs<Session>(COL, where('date', '==', input.date));
  const clash = sameDay.find(
    (s) =>
      s.status !== 'cancelled' &&
      timesOverlap(s.startTime, s.endTime, input.startTime, input.endTime) &&
      (s.classId === input.classId ||
        (input.teacherId && s.teacherId === input.teacherId) ||
        (input.roomId && s.roomId === input.roomId)),
  );
  if (clash) {
    const what = clash.classId === input.classId ? 'kelas' : input.teacherId && clash.teacherId === input.teacherId ? 'guru' : 'ruangan';
    throw new Error(`Bentrok ${what} dengan sesi lain pada ${clash.startTime}–${clash.endTime} di tanggal yang sama.`);
  }
  const ref = doc(db, COL, `extra_${input.classId}_${input.date}_${input.startTime.replace(':', '')}`);
  await setDoc(ref, {
    ...input,
    topic: input.topic.trim(),
    scheduleId: null,
    lessonId: null,
    status: 'scheduled',
    notes: '',
    completedAt: null,
    completedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Guru & admin: topik, materi pelajaran, catatan. */
export async function updateSessionPlan(session: Session, plan: { topic: string; lessonId: string | null; notes: string }) {
  if (session.status === 'cancelled') throw new Error('Sesi yang dibatalkan tidak bisa diubah.');
  await updateDoc(doc(db, COL, session.id), {
    topic: plan.topic.trim(),
    lessonId: plan.lessonId || null,
    notes: plan.notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

/** Admin saja. Sesi yang sudah selesai (sudah ada absensi) tidak bisa dibatalkan. */
export async function cancelSession(session: Session, reason: string) {
  if (session.status === 'completed') throw new Error('Sesi yang sudah selesai tidak bisa dibatalkan.');
  if (!reason.trim()) throw new Error('Alasan pembatalan wajib diisi.');
  await updateDoc(doc(db, COL, session.id), {
    status: 'cancelled',
    cancelReason: reason.trim(),
    updatedAt: serverTimestamp(),
    completedBy: null,
  });
  const students = await listDocs<Student>('students', where('currentClassId', '==', session.classId)).catch(() => [] as Student[]);
  await notifyUsers(
    students.flatMap((s) => s.parentUids),
    { title: `Kelas ${session.date.split('-').reverse().join('/')} dibatalkan`, body: `${session.startTime}–${session.endTime}: ${reason.trim()}`, link: '/p/schedule' },
  );
}

/** Admin: mengembalikan sesi batal menjadi terjadwal. */
export async function restoreSession(session: Session) {
  await updateDoc(doc(db, COL, session.id), { status: 'scheduled', cancelReason: '', updatedAt: serverTimestamp() });
}
