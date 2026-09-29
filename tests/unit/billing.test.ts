import { describe, expect, it } from 'vitest';
import {
  applyPayment,
  computeMonthlyItems,
  computePerSessionItems,
  computeTotals,
  DEFAULT_BILLING_RULES,
  effectiveStatus,
  normalizeWhatsApp,
  profileForPeriod,
} from '../../src/lib/billing';
import type { AttendanceStatus, BillingProfile } from '../../src/types';

type V = Pick<BillingProfile, 'billingType' | 'sessionRate' | 'monthlyRate' | 'discount' | 'additionalFee' | 'additionalFeeLabel' | 'effectiveFrom' | 'effectiveUntil'>;
const version = (p: Partial<V>): V => ({
  billingType: 'PER_SESSION',
  sessionRate: 50_000,
  monthlyRate: 0,
  discount: 0,
  additionalFee: 0,
  additionalFeeLabel: '',
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  ...p,
});

function makeSessions(dates: string[], status: 'completed' | 'scheduled' | 'cancelled' = 'completed') {
  return dates.map((date, i) => ({ id: `s${i}_${date}`, date, status, startTime: '15:00' }));
}
function attend(sessions: { id: string; date: string }[], statuses: AttendanceStatus[]) {
  return sessions.map((s, i) => ({ sessionId: s.id, date: s.date, status: statuses[i] }));
}

describe('Spesifikasi #24 — contoh per sesi', () => {
  it('Hadir, Hadir, Absen, Hadir → 3 × Rp50.000 = Rp150.000, dan sesi yang ditagih terlihat', () => {
    const sessions = makeSessions(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    const r = computePerSessionItems({
      versions: [version({})],
      sessions,
      attendance: attend(sessions, ['present', 'present', 'absent', 'present']),
      billedSessionIds: new Set(),
      rules: DEFAULT_BILLING_RULES,
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(r.items.map((i) => i.sessionDate)).toEqual(['2026-09-07', '2026-09-14', '2026-09-28']);
    expect(computeTotals(r.items, 0, 0).total).toBe(150_000);
    expect(r.notBillable).toEqual([{ date: '2026-09-21', status: 'absent' }]);
  });
});

describe('TEST 1 — PER_SESSION Rp50.000 × 7 sesi billable', () => {
  it('menghasilkan Rp350.000', () => {
    const dates = ['01', '03', '08', '10', '15', '17', '22', '24', '29'].map((d) => `2026-10-${d}`);
    const sessions = makeSessions(dates);
    // 7 billable (hadir/terlambat), 1 absen, 1 izin
    const statuses: AttendanceStatus[] = ['present', 'late', 'present', 'absent', 'present', 'excused', 'present', 'present', 'late'];
    const r = computePerSessionItems({
      versions: [version({})],
      sessions,
      attendance: attend(sessions, statuses),
      billedSessionIds: new Set(),
      rules: DEFAULT_BILLING_RULES,
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(r.items).toHaveLength(7);
    expect(computeTotals(r.items, 0, 0).total).toBe(350_000);
  });

  it('aturan billable bisa diubah admin (mis. Izin ikut ditagih)', () => {
    const sessions = makeSessions(['2026-10-01', '2026-10-08']);
    const r = computePerSessionItems({
      versions: [version({})],
      sessions,
      attendance: attend(sessions, ['present', 'excused']),
      billedSessionIds: new Set(),
      rules: { ...DEFAULT_BILLING_RULES, excused: true },
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(r.items).toHaveLength(2);
  });

  it('sesi yang belum selesai, dibatalkan, atau sudah ditagih tidak ikut', () => {
    const done = makeSessions(['2026-10-01', '2026-10-08']);
    const cancelled = makeSessions(['2026-10-15'], 'cancelled');
    const scheduled = makeSessions(['2026-10-22'], 'scheduled');
    const all = [...done, ...cancelled, ...scheduled];
    const r = computePerSessionItems({
      versions: [version({})],
      sessions: all,
      attendance: attend(all, ['present', 'present', 'present', 'present']),
      billedSessionIds: new Set([done[0].id]),
      rules: DEFAULT_BILLING_RULES,
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(r.items.map((i) => i.sessionId)).toEqual([done[1].id]);
    expect(r.alreadyBilled).toBe(1);
  });
});

describe('TEST 2 — MONTHLY Rp350.000 dengan 8 sesi', () => {
  it('tetap Rp350.000, tidak dipengaruhi jumlah sesi', () => {
    const v = version({ billingType: 'MONTHLY', monthlyRate: 350_000 });
    const items = computeMonthlyItems(v, '2026-10');
    expect(computeTotals(items, v.discount, v.additionalFee).total).toBe(350_000);
    // Sesi/absensi tidak dipakai sama sekali untuk MONTHLY:
    const perSession = computePerSessionItems({
      versions: [v],
      sessions: makeSessions(Array.from({ length: 8 }, (_, i) => `2026-10-${String(i * 3 + 1).padStart(2, '0')}`)),
      attendance: [],
      billedSessionIds: new Set(),
      rules: DEFAULT_BILLING_RULES,
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(perSession.items).toHaveLength(0);
  });

  it('spesifikasi #25: 350.000 + biaya materi 50.000 − diskon 25.000 = 375.000', () => {
    const v = version({ billingType: 'MONTHLY', monthlyRate: 350_000, additionalFee: 50_000, discount: 25_000 });
    expect(computeTotals(computeMonthlyItems(v, '2026-09'), v.discount, v.additionalFee).total).toBe(375_000);
  });
});

describe('TEST 3 & 4 — pembayaran parsial', () => {
  it('500.000 dibayar 300.000 → sisa 200.000, PARTIALLY PAID; lalu 200.000 → PAID, sisa 0', () => {
    const first = applyPayment({ total: 500_000, paidAmount: 0 }, 300_000);
    expect(first).toMatchObject({ previousBalance: 500_000, paidAmount: 300_000, outstandingAmount: 200_000, status: 'partially_paid' });
    const second = applyPayment({ total: 500_000, paidAmount: first.paidAmount }, 200_000);
    expect(second).toMatchObject({ previousBalance: 200_000, paidAmount: 500_000, outstandingAmount: 0, status: 'paid' });
  });

  it('menolak pembayaran melebihi sisa atau nol', () => {
    expect(() => applyPayment({ total: 500_000, paidAmount: 300_000 }, 200_001)).toThrow();
    expect(() => applyPayment({ total: 500_000, paidAmount: 0 }, 0)).toThrow();
  });
});

describe('TEST 5 — perubahan harga tidak mengubah tagihan lama', () => {
  const versions = [
    version({ sessionRate: 50_000, effectiveFrom: '2026-09-01', effectiveUntil: '2026-09-30' }),
    version({ sessionRate: 60_000, effectiveFrom: '2026-10-01', effectiveUntil: null }),
  ];
  const run = (dates: string[], from: string, to: string) => {
    const sessions = makeSessions(dates);
    return computePerSessionItems({
      versions,
      sessions,
      attendance: attend(sessions, dates.map(() => 'present' as const)),
      billedSessionIds: new Set(),
      rules: DEFAULT_BILLING_RULES,
      from,
      to,
    });
  };

  it('September memakai Rp50.000/sesi', () => {
    const r = run(['2026-09-07', '2026-09-14'], '2026-09-01', '2026-09-30');
    expect(r.items.every((i) => i.unitPrice === 50_000)).toBe(true);
  });
  it('Oktober memakai Rp60.000/sesi', () => {
    const r = run(['2026-10-05', '2026-10-12'], '2026-10-01', '2026-10-31');
    expect(r.items.every((i) => i.unitPrice === 60_000)).toBe(true);
  });
  it('periode yang melewati perubahan harga memberi harga per tanggal sesi', () => {
    const r = run(['2026-09-28', '2026-10-05'], '2026-09-15', '2026-10-15');
    expect(r.items.map((i) => i.unitPrice)).toEqual([50_000, 60_000]);
  });
  it('profileForPeriod memilih versi di awal periode', () => {
    expect(profileForPeriod(versions, '2026-09-01', '2026-09-30')?.sessionRate).toBe(50_000);
    expect(profileForPeriod(versions, '2026-10-01', '2026-10-31')?.sessionRate).toBe(60_000);
  });
});

describe('Lain-lain', () => {
  it('overdue dihitung dari jatuh tempo', () => {
    expect(effectiveStatus({ status: 'unpaid', dueDate: '2026-10-10' }, '2026-10-11')).toBe('overdue');
    expect(effectiveStatus({ status: 'paid', dueDate: '2026-10-10' }, '2026-10-11')).toBe('paid');
  });
  it('nomor WhatsApp dinormalisasi', () => {
    expect(normalizeWhatsApp('0812-3456-7890')).toBe('6281234567890');
  });
});
