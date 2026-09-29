import { Link } from 'react-router-dom';
import { RevenueChart } from '../components/RevenueChart';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Panel, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { lastMonths, outstandingSummary, revenueByMonth } from '../lib/finance';
import { currentMonth, formatDate, formatMonth, formatRupiah, todayISO } from '../lib/format';
import { billingTypeLabels, paymentMethodLabels } from '../lib/labels';
import { listInvoices } from '../services/invoices';
import { listPayments } from '../services/payments';

export function FinancePage() {
  const { data, error, reload } = useAsync(() => Promise.all([listInvoices(), listPayments()]), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [invoices, payments] = data;
  const today = todayISO();
  const month = currentMonth();
  const chart = revenueByMonth(payments, lastMonths(month, 6));
  const thisMonth = chart[chart.length - 1];
  const summary = outstandingSummary(invoices, today);
  const pending = payments.filter((p) => p.status === 'pending');
  const recent = payments.filter((p) => p.status === 'verified').slice(0, 8);
  const topOutstanding = [...summary.open].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);

  return (
    <>
      <PageHeader title="Keuangan" description="Pendapatan dihitung dari pembayaran yang sudah diverifikasi, menurut tanggal bayar." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={`Pendapatan ${formatMonth(month)}`} value={formatRupiah(thisMonth.total)} sub={`Per sesi ${formatRupiah(thisMonth.perSession)} · Bulanan ${formatRupiah(thisMonth.monthly)}`} />
        <Card label="Belum dibayar" value={formatRupiah(summary.outstanding)} sub={`${summary.open.length} tagihan`} to="/invoices?status=unpaid" />
        <Card label="Terlambat" value={formatRupiah(summary.overdueAmount)} sub={`${summary.overdue.length} tagihan lewat jatuh tempo`} to="/invoices?status=overdue" danger={summary.overdue.length > 0} />
        <Card label="Menunggu verifikasi" value={String(pending.length)} sub={formatRupiah(pending.reduce((s, p) => s + p.amount, 0))} to="/payments?status=pending" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Pendapatan 6 bulan terakhir">
          <div className="p-4">
            <RevenueChart data={chart} />
          </div>
        </Panel>
        <Panel title="Tagihan belum lunas (jatuh tempo terdekat)">
          {topOutstanding.length === 0 ? (
            <EmptyState title="Semua tagihan sudah lunas" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {topOutstanding.map((i) => (
                <li key={i.id}>
                  <Link to={`/invoices/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50">
                    <span className="flex-1">
                      <span className="font-medium">{i.studentName}</span>
                      <span className="block text-xs text-ink-500">
                        {i.invoiceNumber} · jatuh tempo {formatDate(i.dueDate)}
                      </span>
                    </span>
                    <span className="font-semibold">{formatRupiah(i.outstandingAmount)}</span>
                    {i.dueDate < today && <Badge tone="red">Terlambat</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Pembayaran terbaru" className="mt-6">
        {recent.length === 0 ? (
          <EmptyState title="Belum ada pembayaran terverifikasi" />
        ) : (
          <Table head={['Tanggal', 'Siswa', 'Tagihan', 'Jenis', 'Metode', 'Nominal']}>
            {recent.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-2">{p.studentName}</td>
                <td className="px-4 py-2">
                  <Link to={`/invoices/${p.invoiceId}`} className="text-brand-600 hover:underline">
                    {p.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{billingTypeLabels[p.billingType]}</td>
                <td className="px-4 py-2">{paymentMethodLabels[p.paymentMethod]}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">{formatRupiah(p.amount)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

function Card({ label, value, sub, to, danger }: { label: string; value: string; sub: string; to?: string; danger?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger ? 'text-rose-700' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{sub}</p>
    </>
  );
  const cls = 'block rounded-xl border border-ink-100 bg-white p-5';
  return to ? (
    <Link to={to} className={`${cls} hover:border-brand-100`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
