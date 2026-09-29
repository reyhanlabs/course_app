import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatRupiah, matchesSearch } from '../lib/format';
import { paymentMethodLabels } from '../lib/labels';
import { listReceipts } from '../services/payments';

export function ReceiptsPage() {
  const { data, loading, error, reload } = useAsync(listReceipts, []);
  const [search, setSearch] = useState('');
  const rows = (data ?? []).filter((r) => matchesSearch(search, r.studentName, r.receiptNumber, r.invoiceNumber));
  return (
    <>
      <PageHeader title="Kuitansi" description="Kuitansi terbit otomatis saat pembayaran diverifikasi." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="border-b border-ink-100 p-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa atau nomor" />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Belum ada kuitansi" />
          ) : (
            <Table head={['Nomor', 'Tanggal bayar', 'Siswa', 'Tagihan', 'Metode', 'Nominal', 'Sisa']}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link to={`/receipts/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                      {r.receiptNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatDate(r.paymentDate)}</td>
                  <td className="px-4 py-2">{r.studentName}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.invoiceNumber}</td>
                  <td className="px-4 py-2">{paymentMethodLabels[r.paymentMethod]}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(r.remainingBalance)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
    </>
  );
}
