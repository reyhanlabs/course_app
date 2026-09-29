import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/errors';
import { formatRupiah, todayISO } from '../lib/format';
import { paymentMethodLabels } from '../lib/labels';
import { recordPayment, type PaymentInput } from '../services/payments';
import type { Invoice, PaymentMethod } from '../types';
import { MoneyInput } from './MoneyInput';
import { Button, Field, FormError, Modal } from './ui';

export function PaymentFormModal({
  open,
  invoice,
  pendingSum,
  methods,
  onClose,
  onSaved,
}: {
  open: boolean;
  invoice: Invoice;
  pendingSum: number;
  methods: PaymentMethod[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const available = invoice.outstandingAmount - pendingSum;
  const [form, setForm] = useState<PaymentInput>({ amount: 0, paymentDate: todayISO(), paymentMethod: 'cash', referenceNumber: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [verifyNow, setVerifyNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ amount: Math.max(0, available), paymentDate: todayISO(), paymentMethod: methods[0] ?? 'cash', referenceNumber: '', notes: '' });
    setFile(null);
    setVerifyNow(true);
    setError(null);
  }, [open, available, methods]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await recordPayment(invoice, form, file, verifyNow);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Catat pembayaran"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="payment-form" loading={busy}>
            {verifyNow ? 'Simpan & terbitkan kuitansi' : 'Simpan (menunggu verifikasi)'}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-700">
          Sisa tagihan <strong>{formatRupiah(invoice.outstandingAmount)}</strong>
          {pendingSum > 0 && <> (termasuk {formatRupiah(pendingSum)} menunggu verifikasi)</>}. Pembayaran sebagian diperbolehkan.
        </p>
        <Field label="Nominal" required>
          <MoneyInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal bayar" required>
            <input className="input" type="date" required max={todayISO()} value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
          </Field>
          <Field label="Metode" required>
            <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabels[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Nomor referensi" hint="Contoh: nomor transfer / ID transaksi e-wallet">
          <input className="input" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
        </Field>
        <Field label="Bukti pembayaran" hint="Foto atau PDF, maksimal 10 MB">
          <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Catatan">
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={verifyNow} onChange={(e) => setVerifyNow(e.target.checked)} />
          <span>
            Langsung verifikasi. Uang sudah diterima/dicek, saldo tagihan langsung berkurang dan kuitansi terbit. Kosongkan jika transfer
            masih perlu dicek di rekening.
          </span>
        </label>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
