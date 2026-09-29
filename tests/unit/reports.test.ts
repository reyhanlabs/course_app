import { describe, expect, it } from 'vitest';
import { attendanceReport, outstandingReport, revenueReport, toCsv, type ReportFilters } from '../../src/lib/reports';
import type { Attendance, Invoice, Payment } from '../../src/types';

const f: ReportFilters = { from: '2026-10-01', to: '2026-10-31', classId: '', levelId: '', billingType: '', paymentStatus: '', search: '' };

describe('Laporan', () => {
  it('absensi: terlambat dihitung hadir', () => {
    const att = (status: Attendance['status'], date: string) => ({ id: date, sessionId: date, classId: 'c', studentId: 'john', studentName: 'John', date, status, checkInTime: '', notes: '', recordedBy: 'x' }) as Attendance;
    const r = attendanceReport({ attendance: [att('present', '2026-10-01'), att('late', '2026-10-08'), att('absent', '2026-10-15'), att('present', '2026-09-30')], classes: [] }, f);
    expect(r.rows[0]).toMatchObject({ total: 3, present: 1, late: 1, absent: 1, rate: 67 });
  });

  it('pendapatan: hanya pembayaran terverifikasi, dipisah per jenis', () => {
    const pay = (amount: number, status: Payment['status'], billingType: Payment['billingType']) =>
      ({ amount, status, billingType, paymentDate: '2026-10-05' }) as Payment;
    const r = revenueReport({ payments: [pay(350_000, 'verified', 'MONTHLY'), pay(150_000, 'verified', 'PER_SESSION'), pay(999, 'pending', 'MONTHLY')] }, f);
    expect(r.totals).toMatchObject({ perSession: 150_000, monthly: 350_000, total: 500_000 });
  });

  it('tunggakan: hanya belum lunas, dengan hari terlambat', () => {
    const inv = (status: Invoice['status'], dueDate: string) =>
      ({ status, dueDate, periodStart: '2026-10-01', billingType: 'MONTHLY', total: 500_000, paidAmount: 300_000, outstandingAmount: 200_000, studentName: 'A', invoiceNumber: 'INV' }) as Invoice;
    const r = outstandingReport({ invoices: [inv('partially_paid', '2026-10-10'), inv('paid', '2026-10-10'), inv('draft', '2026-10-10')] }, f, '2026-10-15');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ daysLate: 5, outstanding: 200_000 });
  });

  it('CSV memakai ; dan BOM, tanggal DD/MM/YYYY', () => {
    const csv = toCsv({ columns: [{ key: 'd', label: 'Tanggal', type: 'date' }, { key: 'n', label: 'Nama; lengkap', type: 'text' }], rows: [{ d: '2026-10-05', n: 'A "B"' }] });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('05/10/2026;"A ""B"""');
    expect(csv).toContain('"Nama; lengkap"');
  });
});
