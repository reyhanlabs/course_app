import type { CourseClass, UserProfile } from '../types';
import { listClasses, listClassesOfTeacherUser } from './classes';

/**
 * Kelas yang boleh dibuka pengguna ini. Semua query data akademik guru
 * selalu difilter per classId, karena Security Rules memeriksa classId.
 */
export async function listAccessibleClasses(profile: UserProfile): Promise<CourseClass[]> {
  if (profile.role === 'teacher') return listClassesOfTeacherUser(profile.id);
  if (profile.role === 'admin' || profile.role === 'owner') return listClasses();
  return [];
}

/** Menjalankan query per kelas lalu menggabungkan hasilnya. */
export async function perClass<T>(classIds: string[], fn: (classId: string) => Promise<T[]>): Promise<T[]> {
  const parts = await Promise.all(classIds.map(fn));
  return parts.flat();
}
