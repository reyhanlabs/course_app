import { formatMonth, formatRupiah } from '../lib/format';

/** Grafik batang bertumpuk sederhana (tanpa library): Per sesi vs Bulanan. */
export function RevenueChart({ data }: { data: { month: string; perSession: number; monthly: number; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div>
      <div className="flex h-48 items-end gap-3" role="img" aria-label="Grafik pendapatan bulanan">
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-semibold text-ink-700">{d.total ? `${Math.round(d.total / 1000).toLocaleString('id-ID')}rb` : ''}</span>
            <div className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(d.total / max) * 150}px` }} title={`${formatMonth(d.month)}: ${formatRupiah(d.total)}`}>
              <div className="bg-brand-600" style={{ height: `${d.total ? (d.perSession / d.total) * 100 : 0}%` }} />
              <div className="bg-marker" style={{ height: `${d.total ? (d.monthly / d.total) * 100 : 0}%` }} />
            </div>
            <span className="text-[11px] text-ink-500">{formatMonth(d.month).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-ink-700">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-brand-600" /> Per sesi
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-marker" /> Bulanan
        </span>
      </div>
    </div>
  );
}
