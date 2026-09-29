/**
 * Pembangun laporan (murni, tanpa Firebase) + ekspor CSV.
 * Semua laporan menghasilkan bentuk yang sama: kolom + baris + total.
 */
import type { Attendance, BillingType } from '../types';
import type { CourseClass, Invoice, InvoiceItem, Level, Payment, PaymentStatus, ProgressRecord, Session, Student, Teacher } from '../types';
import { effectiveStatus } from './billing';
import { daysBetween, formatDate, formatMonth } from './format';
import { attendanceStatusLabels, billingTypeLabels, invoiceStatusLabels, paymentMethodLabels, paymentStatusLabels, skillLabels, studentStatusLabels } from './labels';
import { SKILLS } from '../types';

export type ColType = 'text' | 'money' | 'date' | 'percent' | 'number';
export interface Column {
  key: string;
  label: string;
  type: ColType;
}
export type Cell = string | number | null;
export interface ReportResult {
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
}

export interface ReportFilters {
  from: string;
  to: string;
  classId: string;
  levelId: string;
  billingType: BillingType | '';
  paymentStatus: PaymentStatus | '';
  search: string;
}

const inRange = (date: string | null | undefined, f: Pick<ReportFilters, 'from' | 'to'>) => !!date && date >= f.from && date <= f.to;
const matches = (q: string, ...v: (string | null | undefined)[]) => !q.trim() || v.some((x) => x?.toLowerCase().includes(q.trim().toLowerCase()));
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null);
const sum = (rows: Record<string, Cell>[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

function tally(rows: Pick<Attendance, 'status'>[]) {
  const c = { present: 0, late: 0, excused: 0, absent: 0 };
  rows.forEach((a) => (c[a.status] += 1));
  const total = rows.length;
  return { ...c, total, rate: pct(c.present + c.late, total) };
}

// ------------------------------------------------------------ Akademik

export function studentReport(d: { students: Student[]; levels: Level[]; attendance: Attendance[]; invoices: Invoice[] }, f: ReportFilters): ReportResult {
  const level = new Map(d.levels.map((l) => [l.id, l.name]));
  const rows = d.students
    .filter((s) => (!f.classId || s.currentClassId === f.classId) && (!f.levelId || s.currentLevelId === f.levelId) && matches(f.search, s.fullName, s.nickname))
    .map((s) => {
      const att = tally(d.attendance.filter((a) => a.studentId === s.id && inRange(a.date, f)));
      const outstanding = d.invoices
        .filter((i) => i.studentId === s.id && (i.status === 'unpaid' || i.status === 'partially_paid'))
        .reduce((x, i) => x + i.outstandingAmount, 0);
      return {
        name: s.fullName,
        className: s.currentClassName ?? '-',
        level: (s.currentLevelId && level.get(s.currentLevelId)) || '-',
        status: studentStatusLabels[s.status].label,
        startDate: s.startDate,
        sessions: att.total,
        rate: att.rate,
        outstanding,
      };
    });
  return {
    columns: [
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'level', label: 'Level', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'startDate', label: 'Mulai', type: 'date' },
      { key: 'sessions', label: 'Sesi diabsen', type: 'number' },
      { key: 'rate', label: 'Kehadiran', type: 'percent' },
      { key: 'outstanding', label: 'Sisa tagihan', type: 'money' },
    ],
    rows,
    totals: { name: `${rows.length} siswa`, outstanding: sum(rows, 'outstanding') },
  };
}

export function classReport(
  d: { classes: CourseClass[]; levels: Level[]; teachers: Teacher[]; students: Student[]; sessions: Session[]; attendance: Attendance[] },
  f: ReportFilters,
): ReportResult {
  const rows = d.classes
    .filter((c) => (!f.classId || c.id === f.classId) && (!f.levelId || c.levelId === f.levelId) && matches(f.search, c.className))
    .map((c) => {
      const sessions = d.sessions.filter((s) => s.classId === c.id && inRange(s.date, f));
      const att = tally(d.attendance.filter((a) => a.classId === c.id && inRange(a.date, f)));
      return {
        name: c.className,
        level: d.levels.find((l) => l.id === c.levelId)?.name ?? '-',
        teacher: d.teachers.find((t) => t.id === c.teacherId)?.fullName ?? '-',
        students: d.students.filter((s) => s.currentClassId === c.id).length,
        capacity: c.capacity || null,
        completed: sessions.filter((s) => s.status === 'completed').length,
        cancelled: sessions.filter((s) => s.status === 'cancelled').length,
        pending: sessions.filter((s) => s.status === 'scheduled').length,
        rate: att.rate,
      };
    });
  return {
    columns: [
      { key: 'name', label: 'Kelas', type: 'text' },
      { key: 'level', label: 'Level', type: 'text' },
      { key: 'teacher', label: 'Guru', type: 'text' },
      { key: 'students', label: 'Siswa', type: 'number' },
      { key: 'capacity', label: 'Kapasitas', type: 'number' },
      { key: 'completed', label: 'Sesi selesai', type: 'number' },
      { key: 'cancelled', label: 'Batal', type: 'number' },
      { key: 'pending', label: 'Belum diabsen', type: 'number' },
      { key: 'rate', label: 'Kehadiran', type: 'percent' },
    ],
    rows,
    totals: { name: `${rows.length} kelas`, students: sum(rows, 'students'), completed: sum(rows, 'completed'), cancelled: sum(rows, 'cancelled') },
  };
}

export function attendanceReport(d: { attendance: Attendance[]; classes: CourseClass[] }, f: ReportFilters): ReportResult {
  const cls = new Map(d.classes.map((c) => [c.id, c.className]));
  const filtered = d.attendance.filter((a) => inRange(a.date, f) && (!f.classId || a.classId === f.classId) && matches(f.search, a.studentName));
  const byStudent = new Map<string, Attendance[]>();
  filtered.forEach((a) => byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), a]));
  const rows = [...byStudent.values()]
    .map((list) => {
      const t = tally(list);
      return {
        name: list[0].studentName,
        className: [...new Set(list.map((a) => cls.get(a.classId) ?? '-'))].join(', '),
        total: t.total,
        present: t.present,
        late: t.late,
        excused: t.excused,
        absent: t.absent,
        rate: t.rate,
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
  const all = tally(filtered);
  return {
    columns: [
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'total', label: 'Sesi', type: 'number' },
      { key: 'present', label: attendanceStatusLabels.present.label, type: 'number' },
      { key: 'late', label: attendanceStatusLabels.late.label, type: 'number' },
      { key: 'excused', label: attendanceStatusLabels.excused.label, type: 'number' },
      { key: 'absent', label: attendanceStatusLabels.absent.label, type: 'number' },
      { key: 'rate', label: 'Kehadiran', type: 'percent' },
    ],
    rows,
    totals: { name: `${rows.length} siswa`, total: all.total, present: all.present, late: all.late, excused: all.excused, absent: all.absent, rate: all.rate },
  };
}

export function progressReport(d: { progress: ProgressRecord[]; classes: CourseClass[] }, f: ReportFilters): ReportResult {
  const cls = new Map(d.classes.map((c) => [c.id, c.className]));
  const filtered = d.progress.filter((p) => inRange(p.assessedAt, f) && (!f.classId || p.classId === f.classId) && matches(f.search, p.studentName));
  const byStudent = new Map<string, ProgressRecord[]>();
  filtered.forEach((p) => byStudent.set(p.studentId, [...(byStudent.get(p.studentId) ?? []), p]));
  const rows = [...byStudent.values()].map((list) => {
    const sorted = [...list].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt));
    const latest = sorted[0];
    const row: Record<string, Cell> = {
      name: latest.studentName,
      className: cls.get(latest.classId) ?? '-',
      count: list.length,
      latestDate: latest.assessedAt,
    };
    const values: number[] = [];
    for (const s of SKILLS) {
      // Nilai terbaru per keterampilan dalam periode
      const v = sorted.find((r) => typeof r.scores[s] === 'number')?.scores[s] ?? null;
      row[s] = v;
      if (typeof v === 'number') values.push(v);
    }
    row.average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
    return row;
  });
  return {
    columns: [
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'count', label: 'Penilaian', type: 'number' },
      { key: 'latestDate', label: 'Terakhir', type: 'date' },
      ...SKILLS.map((s) => ({ key: s, label: skillLabels[s], type: 'number' as ColType })),
      { key: 'average', label: 'Rata-rata', type: 'number' },
    ],
    rows: rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id')),
  };
}

// ------------------------------------------------------------ Keuangan

export function revenueReport(d: { payments: Payment[] }, f: ReportFilters): ReportResult {
  const verified = d.payments.filter((p) => p.status === 'verified' && inRange(p.paymentDate, f) && (!f.billingType || p.billingType === f.billingType));
  const months = [...new Set(verified.map((p) => p.paymentDate.slice(0, 7)))].sort();
  const rows = months.map((m) => {
    const list = verified.filter((p) => p.paymentDate.startsWith(m));
    const per = list.filter((p) => p.billingType === 'PER_SESSION').reduce((s, p) => s + p.amount, 0);
    const mon = list.filter((p) => p.billingType === 'MONTHLY').reduce((s, p) => s + p.amount, 0);
    return { month: formatMonth(m), count: list.length, perSession: per, monthly: mon, total: per + mon };
  });
  return {
    columns: [
      { key: 'month', label: 'Bulan', type: 'text' },
      { key: 'count', label: 'Pembayaran', type: 'number' },
      { key: 'perSession', label: 'Per sesi', type: 'money' },
      { key: 'monthly', label: 'Bulanan', type: 'money' },
      { key: 'total', label: 'Total', type: 'money' },
    ],
    rows,
    totals: { month: 'Total', count: sum(rows, 'count'), perSession: sum(rows, 'perSession'), monthly: sum(rows, 'monthly'), total: sum(rows, 'total') },
  };
}

export function outstandingReport(d: { invoices: Invoice[] }, f: ReportFilters, today: string): ReportResult {
  const rows = d.invoices
    .filter(
      (i) =>
        (i.status === 'unpaid' || i.status === 'partially_paid') &&
        (!f.classId || i.classId === f.classId) &&
        (!f.billingType || i.billingType === f.billingType) &&
        matches(f.search, i.studentName, i.invoiceNumber),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i) => ({
      number: i.invoiceNumber,
      name: i.studentName,
      className: i.className ?? '-',
      period: formatMonth(i.periodStart.slice(0, 7)),
      type: billingTypeLabels[i.billingType],
      dueDate: i.dueDate,
      daysLate: i.dueDate < today ? daysBetween(i.dueDate, today) : 0,
      total: i.total,
      paid: i.paidAmount,
      outstanding: i.outstandingAmount,
      status: invoiceStatusLabels[effectiveStatus(i, today)].label,
    }));
  return {
    columns: [
      { key: 'number', label: 'Nomor', type: 'text' },
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'period', label: 'Periode', type: 'text' },
      { key: 'type', label: 'Jenis', type: 'text' },
      { key: 'dueDate', label: 'Jatuh tempo', type: 'date' },
      { key: 'daysLate', label: 'Hari terlambat', type: 'number' },
      { key: 'total', label: 'Total', type: 'money' },
      { key: 'paid', label: 'Dibayar', type: 'money' },
      { key: 'outstanding', label: 'Sisa', type: 'money' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    totals: { number: `${rows.length} tagihan`, total: sum(rows, 'total'), paid: sum(rows, 'paid'), outstanding: sum(rows, 'outstanding') },
  };
}

export function paymentReport(d: { payments: Payment[] }, f: ReportFilters): ReportResult {
  const rows = d.payments
    .filter(
      (p) =>
        inRange(p.paymentDate, f) &&
        (!f.paymentStatus || p.status === f.paymentStatus) &&
        (!f.billingType || p.billingType === f.billingType) &&
        matches(f.search, p.studentName, p.invoiceNumber, p.paymentNumber),
    )
    .map((p) => ({
      date: p.paymentDate,
      number: p.paymentNumber || '(dari orang tua)',
      name: p.studentName,
      invoice: p.invoiceNumber,
      type: billingTypeLabels[p.billingType],
      method: paymentMethodLabels[p.paymentMethod],
      reference: p.referenceNumber,
      status: paymentStatusLabels[p.status].label,
      amount: p.amount,
    }));
  return {
    columns: [
      { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'number', label: 'Nomor', type: 'text' },
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'invoice', label: 'Tagihan', type: 'text' },
      { key: 'type', label: 'Jenis', type: 'text' },
      { key: 'method', label: 'Metode', type: 'text' },
      { key: 'reference', label: 'Referensi', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'amount', label: 'Nominal', type: 'money' },
    ],
    rows,
    totals: { date: `${rows.length} pembayaran`, amount: sum(rows, 'amount') },
  };
}

/** Sesi yang benar-benar ditagihkan (item invoice PER_SESSION pada tagihan yang tidak batal). */
export function perSessionBillingReport(d: { items: InvoiceItem[]; invoices: Invoice[] }, f: ReportFilters): ReportResult {
  const inv = new Map(d.invoices.map((i) => [i.id, i]));
  const items = d.items.filter((it) => {
    const i = inv.get(it.invoiceId);
    return it.sessionId && inRange(it.sessionDate, f) && i && i.status !== 'cancelled' && (!f.classId || i.classId === f.classId) && matches(f.search, i.studentName);
  });
  const byStudent = new Map<string, InvoiceItem[]>();
  items.forEach((it) => byStudent.set(it.studentId, [...(byStudent.get(it.studentId) ?? []), it]));
  const rows = [...byStudent.values()].map((list) => {
    const invoices = [...new Set(list.map((it) => it.invoiceId))].map((id) => inv.get(id)!);
    const rates = [...new Set(list.map((it) => it.unitPrice))];
    return {
      name: invoices[0].studentName,
      className: invoices[0].className ?? '-',
      sessions: list.length,
      rates: rates.map((r) => r.toLocaleString('id-ID')).join(' / '),
      amount: list.reduce((s, it) => s + it.amount, 0),
      invoices: invoices.map((i) => i.invoiceNumber ?? 'Draft').join(', '),
      status: [...new Set(invoices.map((i) => invoiceStatusLabels[i.status].label))].join(', '),
    };
  });
  return {
    columns: [
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'sessions', label: 'Sesi ditagih', type: 'number' },
      { key: 'rates', label: 'Tarif (Rp)', type: 'text' },
      { key: 'amount', label: 'Jumlah', type: 'money' },
      { key: 'invoices', label: 'Tagihan', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows: rows.sort((a, b) => a.name.localeCompare(b.name, 'id')),
    totals: { name: `${rows.length} siswa`, sessions: sum(rows, 'sessions'), amount: sum(rows, 'amount') },
  };
}

export function monthlyBillingReport(d: { invoices: Invoice[] }, f: ReportFilters, today: string): ReportResult {
  const rows = d.invoices
    .filter(
      (i) =>
        i.billingType === 'MONTHLY' &&
        i.status !== 'draft' &&
        i.status !== 'cancelled' &&
        i.periodStart <= f.to &&
        i.periodEnd >= f.from &&
        (!f.classId || i.classId === f.classId) &&
        matches(f.search, i.studentName),
    )
    .map((i) => ({
      period: formatMonth(i.periodStart.slice(0, 7)),
      number: i.invoiceNumber,
      name: i.studentName,
      className: i.className ?? '-',
      total: i.total,
      paid: i.paidAmount,
      outstanding: i.outstandingAmount,
      status: invoiceStatusLabels[effectiveStatus(i, today)].label,
    }));
  return {
    columns: [
      { key: 'period', label: 'Periode', type: 'text' },
      { key: 'number', label: 'Nomor', type: 'text' },
      { key: 'name', label: 'Siswa', type: 'text' },
      { key: 'className', label: 'Kelas', type: 'text' },
      { key: 'total', label: 'Total', type: 'money' },
      { key: 'paid', label: 'Dibayar', type: 'money' },
      { key: 'outstanding', label: 'Sisa', type: 'money' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    rows,
    totals: { period: `${rows.length} tagihan`, total: sum(rows, 'total'), paid: sum(rows, 'paid'), outstanding: sum(rows, 'outstanding') },
  };
}

// ------------------------------------------------------------ Format & CSV

export function formatCell(value: Cell, type: ColType): string {
  if (value === null || value === undefined || value === '') return '-';
  switch (type) {
    case 'money':
      return `Rp${Number(value).toLocaleString('id-ID')}`;
    case 'date':
      return formatDate(String(value));
    case 'percent':
      return `${value}%`;
    case 'number':
      return Number(value).toLocaleString('id-ID');
    default:
      return String(value);
  }
}

/**
 * CSV dengan pemisah titik koma (;) dan BOM UTF-8 agar langsung rapi di Excel
 * berlocale Indonesia. Nominal ditulis sebagai angka bulat tanpa pemisah ribuan.
 */
export function toCsv(result: ReportResult): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const raw = (value: Cell, type: ColType) => {
    if (value === null || value === undefined) return '';
    if (type === 'date') return formatDate(String(value));
    if (type === 'percent') return `${value}%`;
    return String(value);
  };
  const lines = [result.columns.map((c) => esc(c.label)).join(';')];
  for (const row of result.rows) lines.push(result.columns.map((c) => esc(raw(row[c.key], c.type))).join(';'));
  if (result.totals) lines.push(result.columns.map((c) => esc(raw(result.totals![c.key] ?? null, c.type))).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}
