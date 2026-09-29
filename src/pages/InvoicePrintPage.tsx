import { useParams } from 'react-router-dom';
import { useProfile } from '../auth/AuthContext';
import { PrintDocument } from '../components/PrintDocument';
import { ErrorState, LoadingState } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatDateWithDay, formatMonth, formatRupiah } from '../lib/format';
import { billingTypeLabels, invoiceStatusLabels } from '../lib/labels';
import { effectiveStatus } from '../lib/billing';
import { todayISO } from '../lib/format';
import { getInvoice, listItems } from '../services/invoices';
import { getParent } from '../services/parents';
import { getFinanceSettings, getInstitutionSettings } from '../services/settings';
import type { Parent } from '../types';

export function InvoicePrintPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const { data, error, reload } = useAsync(async () => {
    const invoice = await getInvoice(id);
    if (!invoice) throw new Error('Tagihan tidak ditemukan.');
    if (invoice.status === 'draft') throw new Error('Draft belum bisa dicetak. Terbitkan dulu.');
    const [items, institution, finance] = await Promise.all([listItems(id), getInstitutionSettings(), getFinanceSettings()]);
    const parents =
      profile.role === 'admin' ? (await Promise.all(invoice.parentIds.map(getParent))).filter((p): p is Parent => p !== null) : [];
    return { invoice, items, institution, finance, parents };
  }, [id]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { invoice, items, institution, finance, parents } = data;
  const status = effectiveStatus(invoice, todayISO());
  const sessions = items.filter((i) => i.sessionId);
  const others = items.filter((i) => !i.sessionId);

  return (
    <PrintDocument
      backTo={profile.role === 'parent' ? '/p/invoices' : `/invoices/${invoice.id}`}
      backLabel={profile.role === 'parent' ? 'Tagihan' : 'Detail tagihan'}
      institution={institution}
      title="INVOICE"
      meta={[
        ['No.', invoice.invoiceNumber ?? '-'],
        ['Tanggal', formatDate(invoice.issuedAt ?? invoice.createdAt)],
        ['Jatuh tempo', formatDate(invoice.dueDate)],
        ['Status', invoiceStatusLabels[status].label],
      ]}
      stamp={invoice.status === 'paid' ? 'LUNAS' : invoice.status === 'cancelled' ? 'BATAL' : undefined}
    >
      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="text-xs font-semibold text-ink-500">Ditagihkan kepada</p>
          <p className="font-semibold">{parents.map((p) => p.fullName).join(' / ') || (profile.role === 'parent' ? profile.displayName : 'Orang tua/wali')}</p>
          <p>Siswa: {invoice.studentName}</p>
          {invoice.className && <p>Kelas: {invoice.className}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-500">Periode tagihan</p>
          <p className="font-semibold">{formatMonth(invoice.periodStart.slice(0, 7))}</p>
          <p>
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
          </p>
          <p>Jenis: {billingTypeLabels[invoice.billingType]}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-ink-200 bg-ink-50 text-xs">
            <th className="px-2 py-2">Keterangan</th>
            <th className="px-2 py-2 text-center">Jml</th>
            <th className="px-2 py-2 text-right">Harga</th>
            <th className="px-2 py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length > 0 && (
            <tr>
              <td colSpan={4} className="px-2 pt-2 text-xs font-semibold text-ink-500">
                Sesi yang ditagihkan ({sessions.length} sesi)
              </td>
            </tr>
          )}
          {sessions.map((i) => (
            <tr key={i.id} className="border-b border-ink-100">
              <td className="px-2 py-1.5">Sesi {i.sessionDate ? formatDateWithDay(i.sessionDate) : ''}</td>
              <td className="px-2 py-1.5 text-center">{i.quantity}</td>
              <td className="px-2 py-1.5 text-right">{formatRupiah(i.unitPrice)}</td>
              <td className="px-2 py-1.5 text-right">{formatRupiah(i.amount)}</td>
            </tr>
          ))}
          {others.map((i) => (
            <tr key={i.id} className="border-b border-ink-100">
              <td className="px-2 py-1.5">{i.description}</td>
              <td className="px-2 py-1.5 text-center">{i.quantity}</td>
              <td className="px-2 py-1.5 text-right">{formatRupiah(i.unitPrice)}</td>
              <td className="px-2 py-1.5 text-right">{formatRupiah(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-3 w-72 space-y-1">
        <Line label="Subtotal" value={formatRupiah(invoice.subtotal)} />
        {invoice.discount > 0 && <Line label="Potongan" value={`− ${formatRupiah(invoice.discount)}`} />}
        {invoice.additionalFee > 0 && <Line label={invoice.additionalFeeLabel || 'Biaya tambahan'} value={formatRupiah(invoice.additionalFee)} />}
        <Line label="Total" value={formatRupiah(invoice.total)} strong />
        <Line label="Sudah dibayar" value={formatRupiah(invoice.paidAmount)} />
        <Line label="Sisa tagihan" value={formatRupiah(invoice.status === 'cancelled' ? 0 : invoice.outstandingAmount)} strong />
      </dl>

      {(finance.paymentInstructions || invoice.notes) && (
        <section className="mt-6 space-y-3 border-t border-ink-200 pt-4">
          {finance.paymentInstructions && (
            <div>
              <p className="text-xs font-semibold text-ink-500">Cara pembayaran</p>
              <p className="whitespace-pre-line">{finance.paymentInstructions}</p>
            </div>
          )}
          {invoice.notes && (
            <div>
              <p className="text-xs font-semibold text-ink-500">Catatan</p>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </section>
      )}
      <p className="mt-8 text-center text-xs text-ink-500">Terima kasih atas kepercayaan Bapak/Ibu.</p>
    </PrintDocument>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-ink-200 pt-1 font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
