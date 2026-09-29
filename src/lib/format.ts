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
