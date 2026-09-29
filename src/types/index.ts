import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'teacher' | 'parent' | 'owner';
export type ActiveStatus = 'active' | 'inactive';

/** users/{uid} — id dokumen = Firebase Auth uid */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  parentId: string | null;
  teacherId: string | null;
  /** Hanya untuk guru: kelas yang diajar. Dipakai Security Rules. */
  classIds: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'suspended';
export type Gender = 'male' | 'female' | '';

/** students/{studentId} */
export interface Student {
  id: string;
  fullName: string;
  nickname: string;
  photoUrl: string | null;
  photoPath: string | null;
  gender: Gender;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  school: string;
  schoolGrade: string;
  address: string;
  /** YYYY-MM-DD */
  startDate: string;
  currentLevelId: string | null;
  currentClassId: string | null;
  /** Salinan nama kelas agar orang tua bisa melihat nama kelas tanpa akses ke koleksi classes. */
  currentClassName: string | null;
  status: StudentStatus;
  notes: string;
  /** id dokumen parents yang terhubung */
  parentIds: string[];
  /** uid akun login orang tua yang terhubung — dipakai Security Rules */
  parentUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type StudentInput = Pick<
  Student,
  | 'fullName'
  | 'nickname'
  | 'gender'
  | 'dateOfBirth'
  | 'school'
  | 'schoolGrade'
  | 'address'
  | 'startDate'
  | 'currentLevelId'
  | 'status'
  | 'notes'
>;

/** parents/{parentId} */
export interface Parent {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  relationship: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ParentInput = Pick<
  Parent,
  'fullName' | 'phone' | 'whatsapp' | 'email' | 'address' | 'relationship'
>;

/** teachers/{teacherId} */
export interface Teacher {
  id: string;
  userId: string | null;
  fullName: string;
  photoUrl: string | null;
  photoPath: string | null;
  phone: string;
  email: string;
  address: string;
  specialization: string;
  status: ActiveStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TeacherInput = Pick<
  Teacher,
  'fullName' | 'phone' | 'email' | 'address' | 'specialization' | 'status'
>;

/** levels/{levelId} */
export interface Level {
  id: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type LevelInput = Pick<Level, 'name' | 'description'>;

/** classes/{classId} */
export interface CourseClass {
  id: string;
  className: string;
  levelId: string;
  teacherId: string | null;
  /** uid akun guru — dipakai Security Rules */
  teacherUid: string | null;
  /** Diisi mulai Fase 2 (manajemen ruangan) */
  roomId: string | null;
  /** 0 = tanpa batas */
  capacity: number;
  status: ActiveStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ClassInput = Pick<CourseClass, 'className' | 'levelId' | 'teacherId' | 'capacity' | 'status'>;

/** classEnrollments/{id} — riwayat kelas siswa, tidak pernah ditimpa/dihapus */
export interface ClassEnrollment {
  id: string;
  studentId: string;
  classId: string;
  /** Nama kelas saat siswa masuk (snapshot untuk laporan historis) */
  className: string;
  levelId: string;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'ended';
  note: string;
  createdBy: string;
  createdAt?: Timestamp;
}
