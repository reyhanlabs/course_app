import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { effectiveStatus } from '../lib/billing';
import { errorMessage } from '../lib/errors';
import { formatDate, formatMonth, formatRupiah, matchesSearch, todayISO } from '../lib/format';
import { billingTypeLabels, invoiceStatusLabels } from '../lib/labels';
import { issueInvoice, listInvoices } from '../services/invoices';
import type { BillingType, InvoiceStatus } from '../types';

export function InvoicesPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: invoices, loading, error, reload } = useAsync(listInvoices, []);
  const [search, setSearch] = useState('');
  const month = params.get('month') ?? '';
  const status = (params.get('status') ?? '') as InvoiceStatus | '';
  const type = (params.get('type') ?? '') as BillingType | '';
  const [issueAllOpen, setIssueAllOpen] = useState(false);
  const today = todayISO();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const months = useMemo(() => [...new Set((invoices ?? []).map((i) => i.periodStart.slice(0, 7)))].sort().reverse(), [invoices]);
  const rows = (invoices ?? [])
    .map((i) => ({ ...i, shown: effectiveStatus(i, today) }))
    .filter(
      (i) =>
        (!month || i.periodStart.startsWith(month)) &&
        (!status || i.shown === status) &&
        (!type || i.billingType === type) &&
        matchesSearch(search, i.studentName, i.invoiceNumber, i.className),
    );
  const drafts = rows.filter((i) => i.status === 'draft');
  const totalOutstanding = rows.filter((i) => i.status !== 'draft' && i.status !== 'cancelled').reduce((s, i) => s + i.outstandingAmount, 0);

  return (
    <>
      <PageHeader
        title="Tagihan"
        actions={
          isAdmin && (
            <>
              {drafts.length > 0 && (
                <Button variant="secondary" onClick={() => setIssueAllOpen(true)}>
                  Terbitkan {drafts.length} draft
                </Button>
              )}
              <Button onClick={() => navigate('/invoices/new')}>
                <Plus className="h-4 w-4" /> Buat tagihan
              </Button>
            </>
          )
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !invoices && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col flex-wrap gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa atau nomor" />
            <select className="input sm:w-44" value={month} onChange={(e) => setParam('month', e.target.value)} aria-label="Periode">
              <option value="">Semua periode</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
            <select className="input sm:w-44" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
              <option value="">Semua status</option>
              {Object.entries(invoiceStatusLabels).map(([v, { label }]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <select className="input sm:w-36" value={type} onChange={(e) => setParam('type', e.target.value)} aria-label="Jenis">
              <option value="">Semua jenis</option>
              <option value="PER_SESSION">Per sesi</option>
              <option value="MONTHLY">Bulanan</option>
            </select>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title={(invoices ?? []).length === 0 ? 'Belum ada tagihan' : 'Tidak ada tagihan yang cocok'}
              description={isAdmin && (invoices ?? []).length === 0 ? 'Atur tarif siswa, lalu klik "Buat tagihan".' : undefined}
            />
          ) : (
            <Table head={['Nomor', 'Siswa', 'Periode', 'Jenis', 'Total', 'Sisa', 'Jatuh tempo', 'Status']}>
              {rows.map((i) => {
                const st = invoiceStatusLabels[i.shown];
                return (
                  <tr key={i.id} className="hover:bg-ink-50/60">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/invoices/${i.id}`} className="font-semibold text-brand-600 hover:underline">
                        {i.invoiceNumber ?? 'Draft'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.studentName}</p>
                      <p className="text-xs text-ink-500">{i.className ?? ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatMonth(i.periodStart.slice(0, 7))}</td>
                    <td className="px-4 py-3">{billingTypeLabels[i.billingType]}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatRupiah(i.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{i.status === 'cancelled' ? '-' : formatRupiah(i.outstandingAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(i.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            {rows.length} tagihan · sisa belum dibayar (tagihan terbit) {formatRupiah(totalOutstanding)}
          </p>
        </Panel>
      )}
      <ConfirmDialog
        open={issueAllOpen}
        title="Terbitkan semua draft"
        message={
          <>
            {drafts.length} draft pada filter ini akan diberi nomor invoice dan bisa dilihat orang tua. Isi draft tidak bisa diubah setelah
            terbit.
          </>
        }
        confirmLabel="Terbitkan"
        onConfirm={async () => {
          const failures: string[] = [];
          for (const d of drafts) {
            try {
              await issueInvoice(d);
            } catch (e) {
              failures.push(`${d.studentName}: ${errorMessage(e)}`);
            }
          }
          reload();
          if (failures.length) throw new Error(`Sebagian gagal. ${failures.join(' · ')}`);
        }}
        onClose={() => setIssueAllOpen(false)}
      />
    </>
  );
}
