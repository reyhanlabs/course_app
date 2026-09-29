import { doc, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sortByText, todayISO } from '../lib/format';
import type { Attendance, AttendanceStatus, ClassEnrollment, Session, Student } from '../types';
import { currentUid, listDocs } from './db';

const COL = 'attendance';

export const attendanceId = (sessionId: string, studentId: string) => `${sessionId}_${studentId}`;

/** classId wajib ikut di query agar lolos Security Rules untuk guru. */
export function listAttendanceOfSession(session: Session) {
  return listDocs<Attendance>(COL, where('classId', '==', session.classId), where('sessionId', '==', session.id));
}

/** Composite index: attendance classId + date */
export function listAttendanceOfClass(classId: string, from: string, to: string) {
  return listDocs<Attendance>(COL, where('classId', '==', classId), where('date', '>=', from), where('date', '<=', to));
}

/** Admin & owner */
export async function listAttendanceOfStudent(studentId: string) {
  const rows = await listDocs<Attendance>(COL, where('studentId', '==', studentId));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export interface RosterEntry {
  studentId: string;
  studentName: string;
}

/**
 * Siswa yang terdaftar di kelas PADA TANGGAL sesi (berdasarkan riwayat kelas),
 * bukan sekadar siswa kelas saat ini — penting untuk sesi lampau.
 */
export async function getRoster(session: Session): Promise<RosterEntry[]> {
  const [enrollments, current] = await Promise.all([
    listDocs<ClassEnrollment>('classEnrollments', where('classId', '==', session.classId)),
    listDocs<Student>('students', where('currentClassId', '==', session.classId)),
  ]);
  const names = new Map(current.map((s) => [s.id, s.fullName]));
  const onDate = enrollments.filter(
    (e) => e.startDate <= session.date && (e.endDate === null || e.endDate > session.date),
  );
  const unique = new Map<string, RosterEntry>();
  for (const e of onDate) {
    unique.set(e.studentId, { studentId: e.studentId, studentName: e.studentName ?? names.get(e.studentId) ?? 'Siswa' });
  }
  return sortByText([...unique.values()], (r) => r.studentName);
}

export interface AttendanceEntry extends RosterEntry {
  status: AttendanceStatus;
  checkInTime: string;
  notes: string;
}

/** Menyimpan absensi seluruh kelas + menandai sesi selesai, dalam satu batch. */
export async function saveAttendance(session: Session, entries: AttendanceEntry[], existing: Attendance[]) {
  if (session.status === 'cancelled') throw new Error('Sesi yang dibatalkan tidak bisa diabsen.');
  if (session.date > todayISO()) throw new Error('Absensi baru bisa diisi pada hari sesi berlangsung.');
  if (entries.length === 0) throw new Error('Tidak ada siswa di kelas ini pada tanggal sesi.');
  const uid = currentUid();
  const existingIds = new Set(existing.map((a) => a.id));
  const batch = writeBatch(db);
  for (const e of entries) {
    const id = attendanceId(session.id, e.studentId);
    const data = {
      sessionId: session.id,
      classId: session.classId,
      studentId: e.studentId,
      studentName: e.studentName,
      date: session.date,
      status: e.status,
      checkInTime: e.status === 'present' || e.status === 'late' ? e.checkInTime : '',
      notes: e.notes.trim(),
      recordedBy: uid,
      updatedAt: serverTimestamp(),
    };
    if (existingIds.has(id)) batch.update(doc(db, COL, id), data);
    else batch.set(doc(db, COL, id), { ...data, createdAt: serverTimestamp() });
  }
  batch.update(doc(db, 'sessions', session.id), {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedBy: uid,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Hadir & terlambat dihitung hadir. */
export function isPresent(status: AttendanceStatus) {
  return status === 'present' || status === 'late';
}
