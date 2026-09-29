import { where } from 'firebase/firestore';
import { todayISO } from '../lib/format';
import {
  attendanceReport,
  classReport,
  monthlyBillingReport,
  outstandingReport,
  paymentReport,
  perSessionBillingReport,
  progressReport,
  revenueReport,
  studentReport,
  type ReportFilters,
  type ReportResult,
} from '../lib/reports';
import type { Attendance, InvoiceItem, ProgressRecord } from '../types';
import { listClasses } from './classes';
import { listDocs } from './db';
import { listInvoices } from './invoices';
import { listLevels } from './levels';
import { listPayments } from './payments';
import { listSessionsInRange } from './sessions';
import { listStudents } from './students';
import { listTeachers } from './teachers';

export type ReportKind =
  | 'students'
  | 'classes'
  | 'attendance'
  | 'progress'
  | 'revenue'
  | 'outstanding'
  | 'payments'
  | 'perSession'
  | 'monthly';

export type ReportFilterKey = 'dates' | 'class' | 'level' | 'billingType' | 'paymentStatus' | 'search';

export const REPORTS: { kind: ReportKind; group: 'academic' | 'finance'; title: string; description: string; filters: ReportFilterKey[] }[] = [
  { kind: 'students', group: 'academic', title: 'Laporan Siswa', description: 'Data siswa, kehadiran pada periode, dan sisa tagihan.', filters: ['dates', 'class', 'level', 'search'] },
  { kind: 'classes', group: 'academic', title: 'Laporan Kelas', description: 'Jumlah siswa, sesi selesai/batal, dan kehadiran per kelas.', filters: ['dates', 'class', 'level', 'search'] },
  { kind: 'attendance', group: 'academic', title: 'Laporan Absensi', description: 'Rekap hadir, terlambat, izin, dan tidak hadir per siswa.', filters: ['dates', 'class', 'search'] },
  { kind: 'progress', group: 'academic', title: 'Laporan Perkembangan', description: 'Nilai terbaru per keterampilan dalam periode.', filters: ['dates', 'class', 'search'] },
  { kind: 'revenue', group: 'finance', title: 'Laporan Pendapatan', description: 'Pembayaran terverifikasi per bulan, Per sesi vs Bulanan.', filters: ['dates', 'billingType'] },
  { kind: 'outstanding', group: 'finance', title: 'Laporan Tunggakan', description: 'Tagihan belum lunas, urut jatuh tempo (semua periode).', filters: ['class', 'billingType', 'search'] },
  { kind: 'payments', group: 'finance', title: 'Laporan Pembayaran', description: 'Semua pembayaran pada periode.', filters: ['dates', 'paymentStatus', 'billingType', 'search'] },
  { kind: 'perSession', group: 'finance', title: 'Laporan Tagihan Per Sesi', description: 'Sesi yang ditagihkan per siswa (menurut tanggal sesi).', filters: ['dates', 'class', 'search'] },
  { kind: 'monthly', group: 'finance', title: 'Laporan Tagihan Bulanan', description: 'Tagihan bulanan terbit dan status pembayarannya.', filters: ['dates', 'class', 'search'] },
];

/** Memuat hanya data yang dibutuhkan laporan tersebut, lalu menyusunnya. */
export async function buildReport(kind: ReportKind, f: ReportFilters): Promise<ReportResult> {
  const today = todayISO();
  const attendanceInRange = () => listDocs<Attendance>('attendance', where('date', '>=', f.from), where('date', '<=', f.to));
  switch (kind) {
    case 'students': {
      const [students, levels, attendance, invoices] = await Promise.all([listStudents(), listLevels(), attendanceInRange(), listInvoices()]);
      return studentReport({ students, levels, attendance, invoices }, f);
    }
    case 'classes': {
      const [classes, levels, teachers, students, sessions, attendance] = await Promise.all([
        listClasses(),
        listLevels(),
        listTeachers(),
        listStudents(),
        listSessionsInRange(f.from, f.to, null),
        attendanceInRange(),
      ]);
      return classReport({ classes, levels, teachers, students, sessions, attendance }, f);
    }
    case 'attendance': {
      const [attendance, classes] = await Promise.all([attendanceInRange(), listClasses()]);
      return attendanceReport({ attendance, classes }, f);
    }
    case 'progress': {
      const [progress, classes] = await Promise.all([
        listDocs<ProgressRecord>('studentProgress', where('assessedAt', '>=', f.from), where('assessedAt', '<=', f.to)),
        listClasses(),
      ]);
      return progressReport({ progress, classes }, f);
    }
    case 'revenue':
      return revenueReport({ payments: await listPayments() }, f);
    case 'outstanding':
      return outstandingReport({ invoices: await listInvoices() }, f, today);
    case 'payments':
      return paymentReport({ payments: await listPayments() }, f);
    case 'perSession': {
      const [items, invoices] = await Promise.all([
        listDocs<InvoiceItem>('invoiceItems', where('sessionDate', '>=', f.from), where('sessionDate', '<=', f.to)),
        listInvoices(),
      ]);
      return perSessionBillingReport({ items, invoices }, f);
    }
    case 'monthly':
      return monthlyBillingReport({ invoices: await listInvoices() }, f, today);
  }
}
