import {
  BookOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  School,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types';

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Menu per peran. Hanya fitur yang sudah benar-benar berfungsi yang tampil.
 * Menu fase berikutnya (Jadwal, Sesi, Absensi, Tagihan, dst.) ditambahkan
 * saat fiturnya selesai — lihat README bagian Roadmap.
 */
export const MENUS: Record<Role, MenuItem[]> = {
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/students', label: 'Siswa', icon: GraduationCap },
    { to: '/parents', label: 'Orang Tua', icon: UsersRound },
    { to: '/teachers', label: 'Guru', icon: Users },
    { to: '/levels', label: 'Level', icon: Layers },
    { to: '/classes', label: 'Kelas', icon: School },
    { to: '/users', label: 'Pengguna', icon: UserCog },
  ],
  teacher: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-classes', label: 'Kelas Saya', icon: School },
  ],
  parent: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-children', label: 'Anak Saya', icon: BookOpen },
  ],
  owner: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/students', label: 'Siswa', icon: GraduationCap },
    { to: '/classes', label: 'Kelas', icon: School },
  ],
};
