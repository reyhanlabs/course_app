import type { Timestamp } from 'firebase/firestore';

const pad = (n: number) => String(n).padStart(2, '0');

/** Tanggal selalu ditampilkan DD/MM/YYYY. Tanggal tanpa jam disimpan sebagai string YYYY-MM-DD. */
export function formatDate(value?: string | Date | Timestamp | null): string {
  if (!value) return '-';
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
  }
  const d = value instanceof Date ? value : value.toDate();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Dipakai mulai Fase 3 (keuangan). */
export const formatRupiah = (amount: number) => rupiah.format(amount);

export function sortByText<T>(items: T[], get: (item: T) => string): T[] {
  return [...items].sort((a, b) => get(a).localeCompare(get(b), 'id'));
}

export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

export function ageFromDate(dateOfBirth: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!m) return null;
  const today = new Date();
  let age = today.getFullYear() - Number(m[1]);
  const beforeBirthday =
    today.getMonth() + 1 < Number(m[2]) ||
    (today.getMonth() + 1 === Number(m[2]) && today.getDate() < Number(m[3]));
  if (beforeBirthday) age -= 1;
  return age;
}

// ---------- tanggal & waktu (Fase 2) ----------

function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = parseISO(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** 1 = Senin … 7 = Minggu */
export function isoDayOfWeek(date: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const js = parseISO(date).getDay();
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoDayOfWeek(date));
}

/** "2026-10" → { from: "2026-10-01", to: "2026-10-31" } */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${monthNames[m - 1]} ${y}`;
}

const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
/** "Senin, 05/10/2026" */
export function formatDateWithDay(date: string): string {
  return `${dayNames[isoDayOfWeek(date) - 1]}, ${formatDate(date)}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Rentang [aStart, aEnd) dan [bStart, bEnd) bertumpukan? */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function percent(part: number, total: number): string {
  return total === 0 ? '-' : `${Math.round((part / total) * 100)}%`;
}

export function addMinutes(time: string, minutes: number): string {
  const total = Math.min(timeToMinutes(time) + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
