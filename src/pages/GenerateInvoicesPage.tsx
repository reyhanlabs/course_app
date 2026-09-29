import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, FormError, LoadingState, PageHeader, Panel, Table } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { currentMonth, formatDate, formatMonth, formatRupiah } from '../lib/format';
import { billingTypeLabels } from '../lib/labels';
import { createDraftInvoices, previewInvoices, type PreviewRow } from '../services/invoices';

export function GenerateInvoicesPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function calculate() {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const result = await previewInvoices(month);
      setRows(result);
      setSelected(new Set(result.filter((r) => !r.skipReason).map((r) => r.student.id)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!rows) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createDraftInvoices(rows.filter((r) => selected.has(r.student.id)), month);
      navigate(`/invoices?month=${month}&status=draft`);
    } catch (e) {
      setCreateError(errorMessage(e));
      setCreating(false);
    }
  }

  const billable = (rows ?? []).filter((r) => !r.skipReason);
  const chosenTotal = billable.filter((r) => selected.has(r.student.id)).reduce((s, r) => s + r.total, 0);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Link to="/invoices" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Tagihan
      </Link>
      <PageHeader
        title="Buat tagihan"
        description="Per sesi: dihitung dari sesi selesai yang dihadiri, dengan tarif pada tanggal sesi. Bulanan: tarif tetap. Hasilnya berupa draft yang bisa diperiksa sebelum diterbitkan."
      />
      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-700">Periode</span>
            <input type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
          <Button onClick={calculate} loading={loading}>
            Hitung tagihan {formatMonth(month)}
          </Button>
        </div>
      </Panel>

      {error && <ErrorState message={error} onRetry={calculate} />}
      {loading && <LoadingState label="Menghitung dari sesi, absensi, dan tarif…" />}
      {rows && (
        <Panel
          title={`Hasil perhitungan ${formatMonth(month)}`}
          actions={
            <Button onClick={create} loading={creating} disabled={selected.size === 0}>
              Buat {selected.size} draft ({formatRupiah(chosenTotal)})
            </Button>
          }
        >
          {rows.length === 0 ? (
            <EmptyState title="Tidak ada siswa aktif" />
          ) : (
            <Table head={['', 'Siswa', 'Jenis', 'Rincian', 'Total', 'Catatan']}>
              {rows.map((r) => (
                <tr key={r.student.id} className={r.skipReason ? 'text-ink-400' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${r.student.fullName}`}
                      disabled={Boolean(r.skipReason)}
                      checked={selected.has(r.student.id)}
                      onChange={() => toggle(r.student.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.student.fullName}</td>
                  <td className="px-4 py-3">{r.billingType ? billingTypeLabels[r.billingType] : '-'}</td>
                  <td className="px-4 py-3">
                    {r.skipReason ? (
                      '-'
                    ) : r.billingType === 'PER_SESSION' ? (
                      <>
                        {r.items.length} sesi
                        <span className="block text-xs text-ink-500">{r.items.map((i) => formatDate(i.sessionDate).slice(0, 5)).join(', ')}</span>
                      </>
                    ) : (
                      formatRupiah(r.subtotal)
                    )}
                    {!r.skipReason && (r.discount > 0 || r.additionalFee > 0) && (
                      <span className="block text-xs text-ink-500">
                        {r.discount > 0 && `potongan ${formatRupiah(r.discount)} `}
                        {r.additionalFee > 0 && `+ ${r.additionalFeeLabel} ${formatRupiah(r.additionalFee)}`}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{r.skipReason ? '-' : formatRupiah(r.total)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.skipReason ? (
                      <span>{r.skipReason}</span>
                    ) : (
                      r.warnings.map((w) => (
                        <Badge key={w} tone="amber">
                          {w}
                        </Badge>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <div className="px-4 pb-3">
            <FormError message={createError} />
          </div>
        </Panel>
      )}
    </>
  );
}
