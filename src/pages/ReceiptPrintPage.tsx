import { useParams } from 'react-router-dom';
import { PrintDocument } from '../components/PrintDocument';
import { ShareActions } from '../components/ShareActions';
import { ErrorState, LoadingState } from '../components/ui';
import { useProfile } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatRupiah } from '../lib/format';
import { invoiceStatusLabels, paymentMethodLabels } from '../lib/labels';
import { getInvoice } from '../services/invoices';
import { getParent } from '../services/parents';
import { getReceipt } from '../services/payments';
import { getInstitutionSettings } from '../services/settings';
import type { Parent } from '../types';

export function ReceiptPrintPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const { data, error, reload } = useAsync(async () => {
    const receipt = await getReceipt(id);
    if (!receipt) throw new Error('Kuitansi tidak ditemukan.');
    const [institution, invoice] = await Promise.all([getInstitutionSettings(), getInvoice(receipt.invoiceId)]);
    const parents =
      profile.role === 'admin' && invoice ? (await Promise.all(invoice.parentIds.map(getParent))).filter((p): p is Parent => p !== null) : [];
    return { receipt, institution, invoice, parents };
  }, [id]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { receipt, institution, invoice, parents } = data;
  const contact = parents.find((p) => p.whatsapp || p.phone) ?? parents[0];

  return (
    <>
      {profile.role === 'admin' && (
        <div className="mb-4 print:hidden">
          <ShareActions
            link={`${window.location.origin}/receipts/${receipt.id}`}
            subject={`Kuitansi ${receipt.receiptNumber} - ${receipt.studentName}`}
            message={[
              `Terima kasih, pembayaran ${formatRupiah(receipt.amount)} untuk ${receipt.studentName} sudah kami terima.`,
              `Kuitansi ${receipt.receiptNumber}, tagihan ${receipt.invoiceNumber}.`,
              receipt.remainingBalance > 0 ? `Sisa tagihan: ${formatRupiah(receipt.remainingBalance)}.` : 'Tagihan sudah lunas.',
            ].join('\n')}
            whatsapp={contact?.whatsapp || contact?.phone || null}
            email={parents.find((p) => p.email)?.email ?? null}
          />
        </div>
      )}
      <PrintDocument
        backTo={profile.role === 'parent' ? '/p/receipts' : invoice ? `/invoices/${invoice.id}` : '/receipts'}
        backLabel={profile.role === 'parent' ? 'Kuitansi' : invoice ? 'Detail tagihan' : 'Kuitansi'}
        institution={institution}
        title="KUITANSI"
        meta={[
          ['No.', receipt.receiptNumber],
          ['Tanggal terbit', formatDate(receipt.issuedAt)],
        ]}
        stamp={receipt.remainingBalance === 0 ? 'LUNAS' : undefined}
      >
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 py-6">
          <Item label="Telah diterima dari" value={parents.map((p) => p.fullName).join(' / ') || (profile.role === 'parent' ? profile.displayName : 'Orang tua/wali')} />
          <Item label="Untuk siswa" value={receipt.studentName} />
          <Item label="Pembayaran tagihan" value={receipt.invoiceNumber} />
          <Item label="Tanggal bayar" value={formatDate(receipt.paymentDate)} />
          <Item label="Metode" value={paymentMethodLabels[receipt.paymentMethod]} />
          <Item label="No. pembayaran" value={receipt.paymentNumber} />
        </dl>
        <div className="my-2 rounded-lg border-2 border-ink-900 px-4 py-3 text-center">
          <p className="text-xs text-ink-500">Jumlah dibayar</p>
          <p className="text-3xl font-bold">{formatRupiah(receipt.amount)}</p>
        </div>
        <dl className="ml-auto mt-4 w-72 space-y-1">
          <div className="flex justify-between">
            <dt>Saldo sebelumnya</dt>
            <dd>{formatRupiah(receipt.previousBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Dibayar</dt>
            <dd>− {formatRupiah(receipt.amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-200 pt-1 font-bold">
            <dt>Sisa tagihan</dt>
            <dd>{formatRupiah(receipt.remainingBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Status tagihan</dt>
            <dd>{invoiceStatusLabels[receipt.invoiceStatus].label}</dd>
          </div>
        </dl>
        <div className="mt-12 flex justify-end">
          <div className="w-48 text-center">
            <p className="text-ink-500">Penerima,</p>
            <div className="h-16" />
            <p className="border-t border-ink-300 pt-1">{institution.name || 'Admin'}</p>
          </div>
        </div>
      </PrintDocument>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
