/**
 * Logika penagihan murni (tanpa Firebase) supaya bisa diuji otomatis.
 * Lihat tests/unit/billing.test.ts untuk TEST 1–5 dari spesifikasi.
 */
import type {
  Attendance,
  AttendanceStatus,
  BillingProfile,
  BillingRules,
  Invoice,
  InvoiceStatus,
  Session,
  StoredInvoiceStatus,
} from '../types';
import { formatDate, formatMonth } from './format';

export const DEFAULT_BILLING_RULES: BillingRules = { present: true, late: true, absent: false, excused: false };

type ProfileVersion = Pick<BillingProfile, 'billingType' | 'sessionRate' | 'monthlyRate' | 'discount' | 'additionalFee' | 'additionalFeeLabel' | 'effectiveFrom' | 'effectiveUntil'>;

/** Versi tarif yang berlaku pada tanggal tertentu. */
export function profileOn<T extends ProfileVersion>(versions: T[], date: string): T | null {
  return versions.find((p) => p.effectiveFrom <= date && (p.effectiveUntil === null || p.effectiveUntil >= date)) ?? null;
}

/**
 * Versi yang menentukan jenis tagihan, potongan, dan biaya tambahan sebuah periode:
 * versi yang berlaku di awal periode, atau versi pertama yang mulai di dalam periode.
 */
export function profileForPeriod<T extends ProfileVersion>(versions: T[], from: string, to: string): T | null {
  return (
    profileOn(versions, from) ??
    [...versions].filter((p) => p.effectiveFrom >= from && p.effectiveFrom <= to).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ??
    null
  );
}

export function isBillable(status: AttendanceStatus, rules: BillingRules): boolean {
  return rules[status] === true;
}

export interface DraftItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sessionId: string | null;
  sessionDate: string | null;
}

export interface PerSessionInput {
  versions: ProfileVersion[];
  sessions: Pick<Session, 'id' | 'date' | 'status' | 'startTime'>[];
  /** Absensi siswa ini saja */
  attendance: Pick<Attendance, 'sessionId' | 'status' | 'date'>[];
  /** Sesi yang sudah ada di tagihan lain yang tidak dibatalkan */
  billedSessionIds: Set<string>;
  rules: BillingRules;
  from: string;
  to: string;
}

export interface PerSessionResult {
  items: DraftItem[];
  notBillable: { date: string; status: AttendanceStatus }[];
  alreadyBilled: number;
}

/**
 * Sesi nyata → absensi → keputusan billable → item tagihan.
 * Harga tiap sesi diambil dari versi tarif yang berlaku PADA TANGGAL SESI.
 */
export function computePerSessionItems(input: PerSessionInput): PerSessionResult {
  const sessionById = new Map(input.sessions.map((s) => [s.id, s]));
  const result: PerSessionResult = { items: [], notBillable: [], alreadyBilled: 0 };
  const rows = [...input.attendance].sort((a, b) => a.date.localeCompare(b.date));
  for (const a of rows) {
    const s = sessionById.get(a.sessionId);
    if (!s || s.status !== 'completed' || s.date < input.from || s.date > input.to) continue;
    if (input.billedSessionIds.has(s.id)) {
      result.alreadyBilled += 1;
      continue;
    }
    const version = profileOn(input.versions, s.date);
    if (!version || version.billingType !== 'PER_SESSION') continue;
    if (!isBillable(a.status, input.rules)) {
      result.notBillable.push({ date: s.date, status: a.status });
      continue;
    }
    result.items.push({
      description: `Sesi ${formatDate(s.date)} ${s.startTime}`,
      quantity: 1,
      unitPrice: version.sessionRate,
      amount: version.sessionRate,
      sessionId: s.id,
      sessionDate: s.date,
    });
  }
  return result;
}

/** Tagihan bulanan: biaya tetap, tidak dipengaruhi jumlah sesi/absensi. */
export function computeMonthlyItems(version: ProfileVersion, month: string): DraftItem[] {
  return [
    {
      description: `Biaya kursus bulan ${formatMonth(month)}`,
      quantity: 1,
      unitPrice: version.monthlyRate,
      amount: version.monthlyRate,
      sessionId: null,
      sessionDate: null,
    },
  ];
}

export function computeTotals(items: Pick<DraftItem, 'amount'>[], discount: number, additionalFee: number) {
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const total = Math.max(0, subtotal - discount + additionalFee);
  return { subtotal, total };
}

/** Pembayaran parsial / pelunasan. Menolak nominal <= 0 atau melebihi sisa tagihan. */
export function applyPayment(invoice: Pick<Invoice, 'total' | 'paidAmount'>, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Nominal pembayaran harus lebih dari 0.');
  const previousBalance = invoice.total - invoice.paidAmount;
  if (amount > previousBalance) throw new Error(`Nominal melebihi sisa tagihan (${previousBalance}).`);
  const paidAmount = invoice.paidAmount + amount;
  const outstandingAmount = invoice.total - paidAmount;
  const status: StoredInvoiceStatus = outstandingAmount === 0 ? 'paid' : 'partially_paid';
  return { previousBalance, paidAmount, outstandingAmount, status };
}

/** Status yang ditampilkan: tagihan belum lunas yang lewat jatuh tempo = overdue. */
export function effectiveStatus(invoice: Pick<Invoice, 'status' | 'dueDate'>, today: string): InvoiceStatus {
  if ((invoice.status === 'unpaid' || invoice.status === 'partially_paid') && invoice.dueDate < today) return 'overdue';
  return invoice.status;
}

/** Normalisasi nomor WA Indonesia untuk wa.me: 0812… → 62812… */
export function normalizeWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function formatDocNumber(prefix: string, yyyymm: string, n: number): string {
  return `${prefix}/${yyyymm}/${String(n).padStart(4, '0')}`;
}
