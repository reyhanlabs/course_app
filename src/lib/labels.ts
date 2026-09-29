import type { ActiveStatus, AttendanceStatus, BillingType, DayOfWeek, Gender, InvoiceStatus, MaterialType, PaymentMethod, PaymentStatus, Role, SessionStatus, Skill, StudentStatus } from '../types';

export type Tone = 'green' | 'gray' | 'blue' | 'amber' | 'red';

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  teacher: 'Guru',
  parent: 'Orang Tua',
  owner: 'Owner',
};

export const studentStatusLabels: Record<StudentStatus, { label: string; tone: Tone }> = {
  active: { label: 'Aktif', tone: 'green' },
  inactive: { label: 'Tidak aktif', tone: 'gray' },
  graduated: { label: 'Lulus', tone: 'blue' },
  suspended: { label: 'Ditangguhkan', tone: 'amber' },
};

export const activeStatusLabels: Record<ActiveStatus, { label: string; tone: Tone }> = {
  active: { label: 'Aktif', tone: 'green' },
  inactive: { label: 'Tidak aktif', tone: 'gray' },
};

export const genderLabels: Record<Gender, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
  '': '-',
};

export const relationshipOptions = ['Ayah', 'Ibu', 'Wali', 'Kakek/Nenek', 'Lainnya'];

export const dayLabels: Record<DayOfWeek, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

export const sessionStatusLabels: Record<SessionStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'Terjadwal', tone: 'blue' },
  completed: { label: 'Selesai', tone: 'green' },
  cancelled: { label: 'Dibatalkan', tone: 'gray' },
};

export const attendanceStatusLabels: Record<AttendanceStatus, { label: string; short: string; tone: Tone }> = {
  present: { label: 'Hadir', short: 'H', tone: 'green' },
  late: { label: 'Terlambat', short: 'T', tone: 'amber' },
  excused: { label: 'Izin', short: 'I', tone: 'blue' },
  absent: { label: 'Tidak hadir', short: 'A', tone: 'red' },
};

export const materialTypeLabels: Record<MaterialType, string> = {
  pdf: 'PDF',
  image: 'Gambar',
  audio: 'Audio',
  video: 'Video',
  worksheet: 'Worksheet',
  document: 'Dokumen',
  url: 'Tautan',
};

export const skillLabels: Record<Skill, string> = {
  speaking: 'Speaking',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  participation: 'Partisipasi',
};

export const scoreLabels: Record<number, string> = {
  1: 'Perlu banyak bimbingan',
  2: 'Mulai berkembang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat baik',
};

export const billingTypeLabels: Record<BillingType, string> = {
  PER_SESSION: 'Per sesi',
  MONTHLY: 'Bulanan',
};

export const invoiceStatusLabels: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'gray' },
  unpaid: { label: 'Belum dibayar', tone: 'blue' },
  partially_paid: { label: 'Dibayar sebagian', tone: 'amber' },
  paid: { label: 'Lunas', tone: 'green' },
  overdue: { label: 'Terlambat', tone: 'red' },
  cancelled: { label: 'Dibatalkan', tone: 'gray' },
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  bank_transfer: 'Transfer bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
};

export const paymentStatusLabels: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Menunggu verifikasi', tone: 'amber' },
  verified: { label: 'Terverifikasi', tone: 'green' },
  rejected: { label: 'Ditolak', tone: 'red' },
};
