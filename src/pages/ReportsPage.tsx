import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, monthRange, currentMonth, todayISO } from '../lib/format';
import { billingTypeLabels, paymentStatusLabels } from '../lib/labels';
import { formatCell, toCsv, type ReportFilters } from '../lib/reports';
import { listClasses } from '../services/classes';
import { listLevels } from '../services/levels';
import { buildReport, REPORTS, type ReportKind } from '../services/reports';
import { getInstitutionSettings } from '../services/settings';
import type { BillingType, PaymentStatus } from '../types';

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const group = params.get('group') as 'academic' | 'finance' | null;
  const available = REPORTS.filter((r) => !group || r.group === group);
  const kind = (available.find((r) => r.kind === params.get('kind'))?.kind ?? available[0].kind) as ReportKind;
  const def = REPORTS.find((r) => r.kind === kind)!;

  const month = monthRange(currentMonth());
  const [filters, setFilters] = useState<ReportFilters>({
    from: month.from,
    to: month.to,
    classId: '',
    levelId: '',
    billingType: '',
    paymentStatus: '',
    search: '',
  });
  const lookups = useAsync(() => Promise.all([listClasses(), listLevels(), getInstitutionSettings()]), []);
  // Pencarian teks difilter di browser; filter lain memicu pemuatan ulang.
  const { search, ...serverFilters } = filters;
  const report = useAsync(() => buildReport(kind, { ...filters, search: '' }), [kind, JSON.stringify(serverFilters)]);
  const shown = useMemo(() => {
    if (!report.data) return null;
    if (!search.trim() || !def.filters.includes('search')) return report.data;
    const q = search.trim().toLowerCase();
    return { ...report.data, rows: report.data.rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))), totals: undefined };
  }, [report.data, search, def.filters]);

  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const [classes, levels, institution] = lookups.data ?? [[], [], null];
  const has = (k: string) => def.filters.includes(k as never);

  const summary = [
    has('dates') ? `Periode ${formatDate(filters.from)} – ${formatDate(filters.to)}` : null,
    has('class') && filters.classId ? `Kelas ${classes.find((c) => c.id === filters.classId)?.className}` : null,
    has('level') && filters.levelId ? `Level ${levels.find((l) => l.id === filters.levelId)?.name}` : null,
    has('billingType') && filters.billingType ? billingTypeLabels[filters.billingType] : null,
    has('paymentStatus') && filters.paymentStatus ? paymentStatusLabels[filters.paymentStatus].label : null,
    has('search') && search ? `Cari "${search}"` : null,
  ].filter(Boolean);

  function downloadCsv() {
    if (!shown) return;
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${def.title.toLowerCase().replace(/\s+/g, '-')}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={group === 'finance' ? 'Laporan Keuangan' : group === 'academic' ? 'Laporan Akademik' : 'Laporan'}
          actions={
            <>
              <Button variant="secondary" onClick={downloadCsv} disabled={!shown || shown.rows.length === 0}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button onClick={() => window.print()} disabled={!shown} title="Pilih 'Simpan sebagai PDF' di jendela cetak">
                <Printer className="h-4 w-4" /> Cetak / PDF
              </Button>
            </>
          }
        />
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Jenis laporan">
          {available.map((r) => (
            <button
              key={r.kind}
              role="tab"
              aria-selected={r.kind === kind}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('kind', r.kind);
                setParams(next, { replace: true });
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium',
                r.kind === kind ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
              )}
            >
              {r.title.replace('Laporan ', '')}
            </button>
          ))}
        </div>
        <Panel className="mb-4">
          <div className="flex flex-wrap items-end gap-2 p-4">
            {has('dates') && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Dari</span>
                  <input type="date" className="input" value={filters.from} onChange={(e) => e.target.value && set('from', e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-700">Sampai</span>
                  <input type="date" className="input" value={filters.to} onChange={(e) => e.target.value && set('to', e.target.value)} />
                </label>
              </>
            )}
            {has('class') && (
              <select className="input sm:w-44" value={filters.classId} onChange={(e) => set('classId', e.target.value)} aria-label="Kelas">
                <option value="">Semua kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className}
                  </option>
                ))}
              </select>
            )}
            {has('level') && (
              <select className="input sm:w-44" value={filters.levelId} onChange={(e) => set('levelId', e.target.value)} aria-label="Level">
                <option value="">Semua level</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            {has('billingType') && (
              <select className="input sm:w-40" value={filters.billingType} onChange={(e) => set('billingType', e.target.value as BillingType | '')} aria-label="Jenis tagihan">
                <option value="">Semua jenis</option>
                <option value="PER_SESSION">Per sesi</option>
                <option value="MONTHLY">Bulanan</option>
              </select>
            )}
            {has('paymentStatus') && (
              <select className="input sm:w-48" value={filters.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value as PaymentStatus | '')} aria-label="Status pembayaran">
                <option value="">Semua status</option>
                {Object.entries(paymentStatusLabels).map(([v, { label }]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {has('search') && <SearchInput value={search} onChange={(v) => set('search', v)} placeholder="Cari siswa / nomor" />}
          </div>
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">{def.description}</p>
        </Panel>
      </div>

      {/* Kop hanya muncul saat dicetak */}
      <div className="mb-4 hidden print:block">
        <p className="text-lg font-bold">{institution?.name}</p>
        <p className="text-xl font-bold">{def.title}</p>
        <p className="text-sm">{summary.join(' · ') || 'Semua data'}</p>
        <p className="text-xs text-ink-500">Dicetak {formatDate(todayISO())}</p>
      </div>

      {report.error ? (
        <ErrorState message={report.error} onRetry={report.reload} />
      ) : !shown || report.loading ? (
        <LoadingState label="Menyusun laporan…" />
      ) : shown.rows.length === 0 ? (
        <Panel>
          <EmptyState title="Tidak ada data untuk filter ini" />
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white print:overflow-visible print:border-0">
          <table className="w-full text-left text-sm print:text-[10px]">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs font-semibold text-ink-500">
              <tr>
                {shown.columns.map((c) => (
                  <th key={c.key} className={cn('whitespace-nowrap px-3 py-2', c.type !== 'text' && 'text-right')}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.rows.map((row, i) => (
                <tr key={i}>
                  {shown.columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-1.5', c.type !== 'text' && 'whitespace-nowrap text-right')}>
                      {formatCell(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {shown.totals && (
              <tfoot className="border-t-2 border-ink-200 font-semibold">
                <tr>
                  {shown.columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2', c.type !== 'text' && 'whitespace-nowrap text-right')}>
                      {shown.totals![c.key] !== undefined ? formatCell(shown.totals![c.key], c.type) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}
