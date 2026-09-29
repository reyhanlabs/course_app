import { Link } from 'react-router-dom';
import { RevenueChart } from '../components/RevenueChart';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, Table } from '../components/ui';
import { AlertCircle, FileText, Hourglass, Wallet } from 'lucide-react';
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
        <StatCard icon={Wallet} tone="amber" label={`Pendapatan ${formatMonth(month)}`} value={formatRupiah(thisMonth.total)} hint={`Per sesi ${formatRupiah(thisMonth.perSession)}, bulanan ${formatRupiah(thisMonth.monthly)}`} />
        <StatCard icon={FileText} tone="blue" label="Belum dibayar" value={formatRupiah(summary.outstanding)} hint={`${summary.open.length} tagihan`} to="/invoices?status=unpaid" />
        <StatCard icon={AlertCircle} tone={summary.overdue.length ? 'red' : 'gray'} label="Terlambat" value={formatRupiah(summary.overdueAmount)} hint={`${summary.overdue.length} tagihan lewat jatuh tempo`} to="/invoices?status=overdue" danger={summary.overdue.length > 0} />
        <StatCard icon={Hourglass} tone="gray" label="Menunggu verifikasi" value={pending.length} hint={formatRupiah(pending.reduce((s, p) => s + p.amount, 0))} to="/payments?status=pending" />
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
                  <Link to={`/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ink-50/70">
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

