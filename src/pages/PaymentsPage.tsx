import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProfile } from '../auth/AuthContext';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatRupiah, matchesSearch } from '../lib/format';
import { paymentMethodLabels, paymentStatusLabels } from '../lib/labels';
import { listPayments, rejectPayment, verifyPayment } from '../services/payments';
import type { Payment, PaymentStatus } from '../types';
import { ReasonModal } from './InvoiceDetailPage';

export function PaymentsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as PaymentStatus | '';
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(listPayments, []);
  const [verifyTarget, setVerifyTarget] = useState<Payment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);

  const rows = (data ?? []).filter(
    (p) => (!status || p.status === status) && (!month || p.paymentDate.startsWith(month)) && matchesSearch(search, p.studentName, p.invoiceNumber, p.paymentNumber, p.referenceNumber),
  );
  const total = rows.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Pembayaran" description="Pembayaran dicatat dari halaman tagihan. Hanya pembayaran terverifikasi yang mengurangi saldo tagihan." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa, nomor, referensi" />
            <select
              className="input sm:w-52"
              value={status}
              onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true })}
              aria-label="Status"
            >
              <option value="">Semua status</option>
              {Object.entries(paymentStatusLabels).map(([v, { label }]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <input type="month" className="input sm:w-44" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan bayar" />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Tidak ada pembayaran" />
          ) : (
            <Table head={['Nomor', 'Tanggal', 'Siswa', 'Tagihan', 'Metode', 'Nominal', 'Status', '']}>
              {rows.map((p) => {
                const st = paymentStatusLabels[p.status];
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-2">{p.paymentNumber || <span className="text-ink-500">Dari orang tua</span>}</td>
                    <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-2">{p.studentName}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Link to={`/invoices/${p.invoiceId}`} className="text-brand-600 hover:underline">
                        {p.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {paymentMethodLabels[p.paymentMethod]}
                      {p.referenceNumber && <span className="block text-xs text-ink-500">{p.referenceNumber}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(p.amount)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {p.attachmentUrl && (
                        <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="mr-2 text-brand-600 hover:underline">
                          Bukti
                        </a>
                      )}
                      {p.status === 'verified' && (
                        <Link to={`/receipts/${p.id}`} className="text-brand-600 hover:underline">
                          Kuitansi
                        </Link>
                      )}
                      {isAdmin && p.status === 'pending' && (
                        <>
                          <Button variant="ghost" onClick={() => setRejectTarget(p)}>
                            Tolak
                          </Button>
                          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setVerifyTarget(p)}>
                            Verifikasi
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">Total terverifikasi pada filter ini: {formatRupiah(total)}</p>
        </Panel>
      )}
      <ConfirmDialog
        open={verifyTarget !== null}
        title="Verifikasi pembayaran"
        message={<>Pastikan {formatRupiah(verifyTarget?.amount ?? 0)} sudah diterima. Saldo tagihan berkurang dan kuitansi terbit.</>}
        confirmLabel="Verifikasi"
        onConfirm={async () => {
          if (verifyTarget) await verifyPayment(verifyTarget.id);
          reload();
        }}
        onClose={() => setVerifyTarget(null)}
      />
      <ReasonModal
        open={rejectTarget !== null}
        title="Tolak pembayaran"
        label="Alasan penolakan"
        confirmLabel="Tolak"
        onConfirm={async (reason) => {
          if (rejectTarget) await rejectPayment(rejectTarget, reason);
          reload();
        }}
        onClose={() => setRejectTarget(null)}
      />
    </>
  );
}
