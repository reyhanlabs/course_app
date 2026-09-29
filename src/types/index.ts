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
  /** Hanya untuk orang tua: anak & kelas anak. Dipelihara services/parentAccess.ts, dipakai Security Rules. */
  childIds?: string[];
  childClassIds?: string[];
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
  /** Snapshot nama siswa (dipakai guru untuk daftar hadir historis). Data Fase 1 bisa belum punya. */
  studentName?: string;
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

// ===================== FASE 2: AKADEMIK =====================

/** rooms/{roomId} */
export interface Room {
  id: string;
  name: string;
  capacity: number;
  status: ActiveStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type RoomInput = Pick<Room, 'name' | 'capacity' | 'status'>;

/** 1 = Senin … 7 = Minggu (ISO) */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** schedules/{scheduleId} — rencana mingguan berulang */
export interface Schedule {
  id: string;
  classId: string;
  teacherId: string | null;
  roomId: string | null;
  dayOfWeek: DayOfWeek;
  /** HH:MM */
  startTime: string;
  endTime: string;
  /** menit */
  duration: number;
  status: ActiveStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type ScheduleInput = Pick<Schedule, 'classId' | 'teacherId' | 'roomId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'status'>;

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

/**
 * sessions/{sessionId} — pertemuan yang benar-benar terjadi pada tanggal tertentu.
 * Sesi dari jadwal memakai id `${scheduleId}_${date}` agar tidak pernah dobel.
 * Field billable/billingRate ditambahkan di Fase 3.
 */
export interface Session {
  id: string;
  classId: string;
  scheduleId: string | null;
  teacherId: string | null;
  roomId: string | null;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  lessonId: string | null;
  status: SessionStatus;
  notes: string;
  cancelReason?: string;
  completedAt?: Timestamp | null;
  completedBy?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

/** attendance/{sessionId}_{studentId} */
export interface Attendance {
  id: string;
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  date: string;
  status: AttendanceStatus;
  /** HH:MM, opsional */
  checkInTime: string;
  notes: string;
  recordedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** semesters/{id} — Level → Semester */
export interface Semester {
  id: string;
  levelId: string;
  name: string;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** lessons/{id} — Level → Semester → Week → Lesson */
export interface Lesson {
  id: string;
  levelId: string;
  semesterId: string;
  weekNumber: number;
  title: string;
  objective: string;
  vocabulary: string;
  grammar: string;
  speaking: string;
  listening: string;
  reading: string;
  writing: string;
  activities: string;
  homework: string;
  teachingNotes: string;
  /** menit */
  duration: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type LessonInput = Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>;

export type MaterialType = 'pdf' | 'image' | 'audio' | 'video' | 'worksheet' | 'document' | 'url';

/** materials/{id} — file di Storage, metadata di Firestore */
export interface Material {
  id: string;
  title: string;
  description: string;
  type: MaterialType;
  /** URL unduhan (file) atau URL eksternal (type = url) */
  storageUrl: string;
  storagePath: string | null;
  fileName: string | null;
  levelId: string | null;
  lessonId: string | null;
  topic: string;
  skill: string;
  createdBy: string;
  createdByName: string;
  /** Materi yang boleh dilihat orang tua di portal */
  visibleToParents?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** homework/{id} */
export interface Homework {
  id: string;
  classId: string;
  lessonId: string | null;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  status: 'active' | 'closed';
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type HomeworkInput = Pick<Homework, 'classId' | 'lessonId' | 'title' | 'description' | 'assignedDate' | 'dueDate' | 'status'>;

export const SKILLS = [
  'speaking',
  'listening',
  'reading',
  'writing',
  'vocabulary',
  'grammar',
  'pronunciation',
  'participation',
] as const;
export type Skill = (typeof SKILLS)[number];
/** 1–5, null = tidak dinilai */
export type SkillScores = Partial<Record<Skill, number | null>>;

/** studentProgress/{id} — setiap penilaian disimpan sebagai riwayat, tidak pernah diubah */
export interface ProgressRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  /** YYYY-MM-DD */
  assessedAt: string;
  scores: SkillScores;
  notes: string;
  recordedBy: string;
  recordedByName: string;
  createdAt?: Timestamp;
}

// ===================== FASE 3: KEUANGAN =====================
// Semua nominal dalam Rupiah bulat (integer), tanpa desimal.

export type BillingType = 'PER_SESSION' | 'MONTHLY';

/**
 * billingProfiles/{id} — BERVERSI. Perubahan tarif = versi lama ditutup
 * (effectiveUntil) dan versi baru dibuat. Versi lama tidak pernah diubah isinya,
 * sehingga tagihan bulan lalu tetap memakai tarif lama.
 */
export interface BillingProfile {
  id: string;
  studentId: string;
  studentName: string;
  billingType: BillingType;
  sessionRate: number;
  monthlyRate: number;
  /** Potongan per tagihan */
  discount: number;
  /** Biaya tambahan per tagihan (mis. biaya materi) */
  additionalFee: number;
  additionalFeeLabel: string;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  /** YYYY-MM-DD inklusif, null = masih berlaku */
  effectiveUntil: string | null;
  status: 'active' | 'ended';
  notes: string;
  parentUids: string[];
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type BillingProfileInput = Pick<
  BillingProfile,
  'billingType' | 'sessionRate' | 'monthlyRate' | 'discount' | 'additionalFee' | 'additionalFeeLabel' | 'effectiveFrom' | 'notes'
>;

/** Status yang disimpan. "overdue" dihitung saat ditampilkan (lihat effectiveStatus). */
export type StoredInvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
export type InvoiceStatus = StoredInvoiceStatus | 'overdue';

/** invoices/{id} */
export interface Invoice {
  id: string;
  /** Diberikan saat diterbitkan; null selama draft */
  invoiceNumber: string | null;
  studentId: string;
  studentName: string;
  parentIds: string[];
  parentUids: string[];
  classId: string | null;
  className: string | null;
  billingType: BillingType;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  discount: number;
  additionalFee: number;
  additionalFeeLabel: string;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  status: StoredInvoiceStatus;
  notes: string;
  cancelReason?: string;
  createdBy: string;
  issuedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** invoiceItems/{id} */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  studentId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  /** Terisi untuk tagihan PER_SESSION: sesi nyata yang ditagihkan */
  sessionId: string | null;
  sessionDate: string | null;
  order: number;
  /** Diisi saat tagihan diterbitkan (draft tidak terlihat orang tua) */
  parentUids: string[];
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'ewallet' | 'other';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

/** payments/{id} */
export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  parentUids: string[];
  billingType: BillingType;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;
  attachmentUrl: string | null;
  attachmentPath: string | null;
  status: PaymentStatus;
  rejectReason?: string;
  createdBy: string;
  verifiedBy: string | null;
  verifiedAt: Timestamp | null;
  createdAt?: Timestamp;
}

/** receipts/{paymentId} — dibuat otomatis saat pembayaran diverifikasi */
export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  parentUids: string[];
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  previousBalance: number;
  remainingBalance: number;
  invoiceStatus: StoredInvoiceStatus;
  issuedBy: string;
  issuedAt?: Timestamp;
}

export interface BillingRules {
  present: boolean;
  late: boolean;
  absent: boolean;
  excused: boolean;
}

/** settings/institution */
export interface InstitutionSettings {
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  logoUrl: string | null;
  logoPath: string | null;
}

/** settings/finance */
export interface FinanceSettings {
  defaultSessionRate: number;
  defaultMonthlyRate: number;
  invoicePrefix: string;
  receiptPrefix: string;
  paymentPrefix: string;
  /** Jatuh tempo = tanggal terbit + N hari */
  defaultDueDays: number;
  billingRules: BillingRules;
  paymentMethods: PaymentMethod[];
  /** Ditampilkan di invoice, mis. nomor rekening */
  paymentInstructions: string;
}

// ===================== FASE 4: PORTAL ORANG TUA =====================

/** homeworkSubmissions/{homeworkId}_{studentId} — satu jawaban per siswa per PR (bisa diganti) */
export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  classId: string;
  studentId: string;
  studentName: string;
  note: string;
  fileUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  status: 'submitted' | 'reviewed';
  feedback: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt?: Timestamp;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Timestamp | null;
}

// ===================== FASE 5: KOMUNIKASI =====================

export type AnnouncementAudience = 'all' | 'parents' | 'teachers';

/** announcements/{id} */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  /** Kosong = semua kelas. Filter tampilan saja, bukan batas keamanan. */
  classIds: string[];
  pinned: boolean;
  published: boolean;
  publishedAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type AnnouncementInput = Pick<Announcement, 'title' | 'body' | 'audience' | 'classIds' | 'pinned' | 'published'>;

/** notifications/{id} — untuk satu pengguna (userId) atau satu peran (targetRole = admin) */
export interface AppNotification {
  id: string;
  userId: string | null;
  targetRole: 'admin' | null;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdBy: string;
  createdAt?: Timestamp;
}

/** settings/academic */
export interface AcademicSettings {
  academicYear: string;
  semester: string;
  /** menit */
  defaultClassDuration: number;
}
