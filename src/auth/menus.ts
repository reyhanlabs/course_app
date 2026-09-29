import {
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
  Receipt,
  School,
  Settings,
  Tags,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types';

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
}
export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

/** Menu per peran, dikelompokkan. Hanya fitur yang benar-benar berfungsi yang tampil. */
export const MENUS: Record<Role, MenuSection[]> = {
  admin: [
    { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }, { to: '/announcements', label: 'Pengumuman', icon: Megaphone }] },
    {
      title: 'Data',
      items: [
        { to: '/students', label: 'Siswa', icon: GraduationCap },
        { to: '/parents', label: 'Orang Tua', icon: UsersRound },
        { to: '/teachers', label: 'Guru', icon: Users },
        { to: '/levels', label: 'Level', icon: Layers },
        { to: '/classes', label: 'Kelas', icon: School },
        { to: '/rooms', label: 'Ruangan', icon: DoorOpen },
      ],
    },
    {
      title: 'Akademik',
      items: [
        { to: '/schedules', label: 'Jadwal', icon: CalendarDays },
        { to: '/sessions', label: 'Sesi', icon: CalendarCheck },
        { to: '/attendance', label: 'Absensi', icon: ClipboardCheck },
        { to: '/curriculum', label: 'Kurikulum', icon: BookMarked },
        { to: '/materials', label: 'Materi', icon: FolderOpen },
        { to: '/homework', label: 'PR', icon: NotebookPen },
        { to: '/progress', label: 'Perkembangan', icon: TrendingUp },
      ],
    },
    {
      title: 'Keuangan',
      items: [
        { to: '/finance', label: 'Ringkasan', icon: Wallet },
        { to: '/billing', label: 'Tarif', icon: Tags },
        { to: '/invoices', label: 'Tagihan', icon: FileText },
        { to: '/payments', label: 'Pembayaran', icon: Banknote },
        { to: '/receipts', label: 'Kuitansi', icon: Receipt },
      ],
    },
    {
      title: 'Sistem',
      items: [
        { to: '/reports', label: 'Laporan', icon: BarChart3 },
        { to: '/users', label: 'Pengguna', icon: UserCog },
        { to: '/audit-logs', label: 'Log Aktivitas', icon: History },
        { to: '/settings', label: 'Pengaturan', icon: Settings },
      ],
    },
  ],
  teacher: [
    {
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/announcements', label: 'Pengumuman', icon: Megaphone },
        { to: '/my-classes', label: 'Kelas Saya', icon: School },
        { to: '/schedules', label: 'Jadwal', icon: CalendarDays },
        { to: '/sessions', label: 'Sesi', icon: CalendarCheck },
        { to: '/attendance', label: 'Absensi', icon: ClipboardCheck },
        { to: '/curriculum', label: 'Kurikulum', icon: BookMarked },
        { to: '/materials', label: 'Materi', icon: FolderOpen },
        { to: '/homework', label: 'PR', icon: NotebookPen },
        { to: '/progress', label: 'Perkembangan', icon: TrendingUp },
      ],
    },
  ],
  parent: [
    {
      items: [
        { to: '/my-children', label: 'Ringkasan', icon: LayoutDashboard },
        { to: '/announcements', label: 'Pengumuman', icon: Megaphone },
      ],
    },
    {
      title: 'Belajar',
      items: [
        { to: '/p/schedule', label: 'Jadwal', icon: CalendarDays },
        { to: '/p/attendance', label: 'Absensi', icon: ClipboardCheck },
        { to: '/p/lessons', label: 'Pelajaran', icon: BookOpen },
        { to: '/p/materials', label: 'Materi', icon: FolderOpen },
        { to: '/p/homework', label: 'PR', icon: NotebookPen },
        { to: '/p/progress', label: 'Perkembangan', icon: TrendingUp },
      ],
    },
    {
      title: 'Pembayaran',
      items: [
        { to: '/p/invoices', label: 'Tagihan', icon: FileText },
        { to: '/p/payments', label: 'Pembayaran', icon: Banknote },
        { to: '/p/receipts', label: 'Kuitansi', icon: Receipt },
      ],
    },
  ],
  owner: [
    {
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/announcements', label: 'Pengumuman', icon: Megaphone },
        { to: '/students', label: 'Siswa', icon: GraduationCap },
        { to: '/classes', label: 'Kelas', icon: School },
        { to: '/attendance', label: 'Absensi', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Laporan',
      items: [
        { to: '/reports?group=academic', label: 'Laporan Akademik', icon: BarChart3 },
        { to: '/reports?group=finance', label: 'Laporan Keuangan', icon: BarChart3 },
      ],
    },
    {
      title: 'Keuangan',
      items: [
        { to: '/finance', label: 'Pendapatan', icon: Wallet },
        { to: '/invoices?status=unpaid', label: 'Tunggakan', icon: FileText },
        { to: '/payments', label: 'Pembayaran', icon: Banknote },
      ],
    },
  ],
};
