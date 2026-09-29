import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { MoneyInput } from '../components/MoneyInput';
import { PaymentFormModal } from '../components/PaymentFormModal';
import { ShareActions } from '../components/ShareActions';
import { Badge, Button, buttonClass, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { effectiveStatus } from '../lib/billing';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateWithDay, formatMonth, formatRupiah, todayISO } from '../lib/format';
import { billingTypeLabels, invoiceStatusLabels, paymentMethodLabels, paymentStatusLabels } from '../lib/labels';
import { addManualItem, cancelInvoice, deleteDraft, getInvoice, issueInvoice, listItems, removeItem, updateDraft } from '../services/invoices';
import { getParent } from '../services/parents';
import { listPaymentsOfInvoice, rejectPayment, verifyPayment } from '../services/payments';
import { getFinanceSettings, getInstitutionSettings } from '../services/settings';
import type { Invoice, InvoiceItem, Parent, Payment } from '../types';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const { data, error, reload } = useAsync(async () => {
    const invoice = await getInvoice(id);
    if (!invoice) throw new Error('Tagihan tidak ditemukan.');
    const [items, payments, finance, institution] = await Promise.all([
      listItems(id),
      listPaymentsOfInvoice(id),
      getFinanceSettings(),
      getInstitutionSettings(),
    ]);
    const parents = isAdmin ? (await Promise.all(invoice.parentIds.map(getParent))).filter((p): p is Parent => p !== null) : [];
    return { invoice, items, payments, finance, institution, parents };
  }, [id, isAdmin]);

  const [editOpen, setEditOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirm, setConfirm] = useState<'issue' | 'delete' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<InvoiceItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Payment | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { invoice, items, payments, finance, institution, parents } = data;
  const shown = effectiveStatus(invoice, todayISO());
  const st = invoiceStatusLabels[shown];
  const isDraft = invoice.status === 'draft';
  const canPay = invoice.status === 'unpaid' || invoice.status === 'partially_paid';
  const pendingSum = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const contact = parents.find((p) => p.whatsapp || p.phone) ?? parents[0];
  const printLink = `${window.location.origin}/invoices/${invoice.id}/print`;
  const shareMessage = [
    `Yth. Bapak/Ibu ${contact?.fullName ?? ''},`.trim(),
    `Tagihan ${institution.name || 'kursus'} untuk ${invoice.studentName}:`,
    `No. ${invoice.invoiceNumber}, periode ${formatMonth(invoice.periodStart.slice(0, 7))}`,
    `Total ${formatRupiah(invoice.total)}, sisa ${formatRupiah(invoice.outstandingAmount)}, jatuh tempo ${formatDate(invoice.dueDate)}.`,
    finance.paymentInstructions ? `\n${finance.paymentInstructions}` : '',
    '\nTerima kasih.',
  ].join('\n');

  return (
    <>
      <Link to="/invoices" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Tagihan
      </Link>
      <PageHeader
        title={invoice.invoiceNumber ?? 'Draft tagihan'}
        description={`${invoice.studentName}${invoice.className ? `, ${invoice.className}` : ''} · ${billingTypeLabels[invoice.billingType]} · ${formatMonth(invoice.periodStart.slice(0, 7))}`}
        actions={
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            {isAdmin && isDraft && (
              <>
                <Button variant="ghost" onClick={() => setConfirm('delete')}>
                  Hapus draft
                </Button>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Ubah
                </Button>
                <Button onClick={() => setConfirm('issue')}>Terbitkan</Button>
              </>
            )}
            {isAdmin && canPay && (
              <>
                {invoice.paidAmount === 0 && (
                  <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                    Batalkan tagihan
                  </Button>
                )}
                <Button onClick={() => setPayOpen(true)}>Catat pembayaran</Button>
              </>
            )}
            {!isDraft && (
              <Link to={`/invoices/${invoice.id}/print`} className={buttonClass('secondary')}>
                <Printer className="h-4 w-4" /> Cetak / PDF
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['Total', formatRupiah(invoice.total)],
          ['Dibayar', formatRupiah(invoice.paidAmount)],
          ['Sisa', invoice.status === 'cancelled' ? '-' : formatRupiah(invoice.outstandingAmount)],
          ['Jatuh tempo', formatDate(invoice.dueDate)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-100 bg-white p-4">
            <p className="text-sm text-ink-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {invoice.status === 'cancelled' && (
        <p className="mb-4 rounded-lg bg-ink-100 px-4 py-3 text-sm">Dibatalkan: {invoice.cancelReason}. Sesi di tagihan ini bisa ditagihkan ulang.</p>
      )}
      {isAdmin && !isDraft && invoice.status !== 'cancelled' && (
        <Panel title="Kirim ke orang tua" className="mb-6">
          <div className="p-4">
            <ShareActions
              link={printLink}
              subject={`Tagihan ${invoice.invoiceNumber} - ${invoice.studentName}`}
              message={shareMessage}
              whatsapp={contact?.whatsapp || contact?.phone || null}
              email={parents.find((p) => p.email)?.email ?? null}
            />
            <p className="mt-2 text-xs text-ink-500">
              Membuka WhatsApp/email dengan pesan siap kirim. Tautan bisa dibuka orang tua setelah portal orang tua aktif (Fase 4).
            </p>
          </div>
        </Panel>
      )}

      <Panel
        title="Rincian"
        className="mb-6"
        actions={
          isAdmin &&
          isDraft && (
            <Button variant="secondary" onClick={() => setItemOpen(true)}>
              Tambah item
            </Button>
          )
        }
      >
        {items.length === 0 ? (
          <EmptyState title="Belum ada item" />
        ) : (
          <Table head={['Keterangan', 'Jumlah', 'Harga', 'Subtotal', ...(isAdmin && isDraft ? [''] : [])]}>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2">
                  {i.sessionId ? (
                    <Link to={`/sessions/${i.sessionId}`} className="text-brand-600 hover:underline">
                      Sesi {i.sessionDate ? formatDateWithDay(i.sessionDate) : ''}
                    </Link>
                  ) : (
                    i.description
                  )}
                </td>
                <td className="px-4 py-2">{i.quantity}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(i.unitPrice)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(i.amount)}</td>
                {isAdmin && isDraft && (
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" aria-label="Hapus item" onClick={() => setRemoveTarget(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </Table>
        )}
        <dl className="ml-auto max-w-xs space-y-1 px-4 py-3 text-sm">
          <Row label="Subtotal" value={formatRupiah(invoice.subtotal)} />
          {invoice.discount > 0 && <Row label="Potongan" value={`− ${formatRupiah(invoice.discount)}`} />}
          {invoice.additionalFee > 0 && <Row label={invoice.additionalFeeLabel || 'Biaya tambahan'} value={formatRupiah(invoice.additionalFee)} />}
          <Row label="Total" value={formatRupiah(invoice.total)} strong />
        </dl>
        {invoice.notes && <p className="border-t border-ink-100 px-4 py-3 text-sm text-ink-700">Catatan: {invoice.notes}</p>}
      </Panel>

      <Panel title="Pembayaran">
        {payments.length === 0 ? (
          <EmptyState title="Belum ada pembayaran" />
        ) : (
          <Table head={['Nomor', 'Tanggal', 'Metode', 'Nominal', 'Status', '']}>
            {payments.map((p) => {
              const ps = paymentStatusLabels[p.status];
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-2">{p.paymentNumber || <span className="text-ink-500">Dari orang tua</span>}</td>
                  <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-2">
                    {paymentMethodLabels[p.paymentMethod]}
                    {p.referenceNumber && <span className="block text-xs text-ink-500">{p.referenceNumber}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(p.amount)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={ps.tone}>{ps.label}</Badge>
                    {p.rejectReason && <span className="block text-xs text-ink-500">{p.rejectReason}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {p.attachmentUrl && (
                      <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="mr-2 text-sm text-brand-600 hover:underline">
                        Bukti
                      </a>
                    )}
                    {p.status === 'verified' && (
                      <Link to={`/receipts/${p.id}`} className="text-sm text-brand-600 hover:underline">
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
      </Panel>

      {isAdmin && (
        <>
          <DraftEditModal open={editOpen} invoice={invoice} onClose={() => setEditOpen(false)} onSaved={reload} />
          <ItemModal open={itemOpen} invoice={invoice} onClose={() => setItemOpen(false)} onSaved={reload} />
          <PaymentFormModal
            open={payOpen}
            invoice={invoice}
            pendingSum={pendingSum}
            methods={finance.paymentMethods}
            onClose={() => setPayOpen(false)}
            onSaved={reload}
          />
          <ConfirmDialog
            open={confirm === 'issue'}
            title="Terbitkan tagihan"
            message="Tagihan akan diberi nomor, isinya dikunci, dan bisa dilihat orang tua. Untuk koreksi setelah terbit, batalkan lalu buat ulang."
            confirmLabel="Terbitkan"
            onConfirm={async () => {
              await issueInvoice(invoice);
              reload();
            }}
            onClose={() => setConfirm(null)}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            title="Hapus draft"
            message="Draft dan itemnya dihapus. Sesi di dalamnya bisa ditagihkan lagi."
            confirmLabel="Hapus"
            danger
            onConfirm={async () => {
              await deleteDraft(invoice);
              navigate('/invoices');
            }}
            onClose={() => setConfirm(null)}
          />
          <ConfirmDialog
            open={removeTarget !== null}
            title="Hapus item"
            message={<>Hapus <strong>{removeTarget?.description}</strong> dari draft?</>}
            confirmLabel="Hapus"
            danger
            onConfirm={async () => {
              if (removeTarget) await removeItem(invoice, removeTarget);
              reload();
            }}
            onClose={() => setRemoveTarget(null)}
          />
          <ConfirmDialog
            open={verifyTarget !== null}
            title="Verifikasi pembayaran"
            message={
              <>
                Pastikan {formatRupiah(verifyTarget?.amount ?? 0)} sudah benar-benar diterima. Saldo tagihan akan berkurang dan kuitansi
                terbit. Tindakan ini tidak bisa dibatalkan.
              </>
            }
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
          <ReasonModal
            open={cancelOpen}
            title="Batalkan tagihan"
            label="Alasan pembatalan"
            confirmLabel="Batalkan tagihan"
            onConfirm={async (reason) => {
              await cancelInvoice(invoice, reason);
              reload();
            }}
            onClose={() => setCancelOpen(false)}
          />
        </>
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-ink-100 pt-1 text-base font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ReasonModal({
  open,
  title,
  label,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Kembali
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} required>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <FormError message={error} />
    </Modal>
  );
}

function DraftEditModal({ open, invoice, onClose, onSaved }: { open: boolean; invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ discount: 0, additionalFee: 0, additionalFeeLabel: '', dueDate: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm({
        discount: invoice.discount,
        additionalFee: invoice.additionalFee,
        additionalFeeLabel: invoice.additionalFeeLabel,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
      });
      setError(null);
    }
  }, [open, invoice]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateDraft(invoice, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Ubah draft"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="draft-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="draft-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Potongan">
            <MoneyInput value={form.discount} onChange={(n) => setForm({ ...form, discount: n })} />
          </Field>
          <Field label="Biaya tambahan">
            <MoneyInput value={form.additionalFee} onChange={(n) => setForm({ ...form, additionalFee: n })} />
          </Field>
        </div>
        <Field label="Nama biaya tambahan">
          <input className="input" value={form.additionalFeeLabel} onChange={(e) => setForm({ ...form, additionalFeeLabel: e.target.value })} />
        </Field>
        <Field label="Jatuh tempo" required>
          <input className="input sm:w-48" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label="Catatan di invoice">
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}

function ItemModal({ open, invoice, onClose, onSaved }: { open: boolean; invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ description: '', quantity: 1, unitPrice: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm({ description: '', quantity: 1, unitPrice: 0 });
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addManualItem(invoice, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Tambah item"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="item-form" loading={busy}>
            Tambah
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Keterangan" required>
          <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Buku Grade 1" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Jumlah" required>
            <input className="input" type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Harga satuan" required className="col-span-2">
            <MoneyInput value={form.unitPrice} onChange={(n) => setForm({ ...form, unitPrice: n })} required />
          </Field>
        </div>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
