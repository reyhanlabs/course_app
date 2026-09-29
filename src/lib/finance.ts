import { effectiveStatus } from './billing';
import type { Invoice, Payment } from '../types';

export function lastMonths(current: string, count: number): string[] {
  const [y, m] = current.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Pendapatan = pembayaran TERVERIFIKASI menurut tanggal bayar, dipisah per jenis tagihan. */
export function revenueByMonth(payments: Payment[], months: string[]) {
  return months.map((month) => {
    const rows = payments.filter((p) => p.status === 'verified' && p.paymentDate.startsWith(month));
    const perSession = rows.filter((p) => p.billingType === 'PER_SESSION').reduce((s, p) => s + p.amount, 0);
    const monthly = rows.filter((p) => p.billingType === 'MONTHLY').reduce((s, p) => s + p.amount, 0);
    return { month, perSession, monthly, total: perSession + monthly };
  });
}

export function outstandingSummary(invoices: Invoice[], today: string) {
  const open = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partially_paid');
  const overdue = open.filter((i) => effectiveStatus(i, today) === 'overdue');
  return {
    open,
    overdue,
    outstanding: open.reduce((s, i) => s + i.outstandingAmount, 0),
    overdueAmount: overdue.reduce((s, i) => s + i.outstandingAmount, 0),
  };
}
