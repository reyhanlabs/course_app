import { addDoc, collection, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { timeToMinutes, timesOverlap } from '../lib/format';
import { dayLabels } from '../lib/labels';
import type { CourseClass, Room, Schedule, ScheduleInput, Teacher } from '../types';
import { getDocById, listDocs } from './db';
import { perClass } from './scope';

const COL = 'schedules';

function sortSchedules(rows: Schedule[]) {
  return rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

/** Admin & owner */
export async function listSchedules(): Promise<Schedule[]> {
  return sortSchedules(await listDocs<Schedule>(COL));
}

/** Guru: hanya kelasnya sendiri */
export async function listSchedulesOfClasses(classIds: string[]): Promise<Schedule[]> {
  return sortSchedules(await perClass(classIds, (id) => listDocs<Schedule>(COL, where('classId', '==', id))));
}

/**
 * Menyimpan jadwal setelah memastikan tidak ada bentrok guru, ruangan,
 * atau kelas pada hari & jam yang sama (hanya jadwal aktif yang dicek).
 */
export async function saveSchedule(id: string | null, input: ScheduleInput) {
  if (!input.classId) throw new Error('Kelas wajib dipilih.');
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new Error('Jam mulai dan jam selesai wajib diisi.');
  }
  const duration = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
  if (duration <= 0) throw new Error('Jam selesai harus setelah jam mulai.');

  const courseClass = await getDocById<CourseClass>('classes', input.classId);
  if (!courseClass) throw new Error('Kelas tidak ditemukan.');

  if (input.status === 'active') {
    const all = await listSchedules();
    const clashes = all.filter(
      (s) =>
        s.id !== id &&
        s.status === 'active' &&
        s.dayOfWeek === input.dayOfWeek &&
        timesOverlap(s.startTime, s.endTime, input.startTime, input.endTime),
    );
    const when = (s: Schedule) => `${dayLabels[s.dayOfWeek]} ${s.startTime}–${s.endTime}`;
    const className = async (s: Schedule) => (await getDocById<CourseClass>('classes', s.classId))?.className ?? 'kelas lain';

    const classClash = clashes.find((s) => s.classId === input.classId);
    if (classClash) throw new Error(`Bentrok kelas: ${courseClass.className} sudah punya jadwal ${when(classClash)}.`);

    const teacherClash = input.teacherId ? clashes.find((s) => s.teacherId === input.teacherId) : undefined;
    if (teacherClash) {
      const t = await getDocById<Teacher>('teachers', input.teacherId!);
      throw new Error(`Bentrok guru: ${t?.fullName ?? 'Guru ini'} sudah mengajar ${await className(teacherClash)} pada ${when(teacherClash)}.`);
    }

    const roomClash = input.roomId ? clashes.find((s) => s.roomId === input.roomId) : undefined;
    if (roomClash) {
      const r = await getDocById<Room>('rooms', input.roomId!);
      throw new Error(`Bentrok ruangan: ${r?.name ?? 'Ruangan ini'} dipakai ${await className(roomClash)} pada ${when(roomClash)}.`);
    }
  }

  const data = {
    classId: input.classId,
    teacherId: input.teacherId || null,
    roomId: input.roomId || null,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    duration,
    status: input.status,
    updatedAt: serverTimestamp(),
  };
  if (id) await updateDoc(doc(db, COL, id), data);
  else await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
}
