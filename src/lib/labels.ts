import type { ActiveStatus, Gender, Role, StudentStatus } from '../types';

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
