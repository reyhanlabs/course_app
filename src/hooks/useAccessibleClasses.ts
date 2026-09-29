import { useProfile } from '../auth/AuthContext';
import { listAccessibleClasses } from '../services/scope';
import { useAsync } from './useAsync';

/** Kelas yang bisa dibuka pengguna saat ini (guru: hanya kelasnya). */
export function useAccessibleClasses() {
  const profile = useProfile();
  return useAsync(() => listAccessibleClasses(profile), [profile.id, profile.role, (profile.classIds ?? []).join(',')]);
}
