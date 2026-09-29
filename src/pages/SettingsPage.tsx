import { useEffect, useState, type FormEvent } from 'react';
import { Avatar, Button, ErrorState, Field, FormError, LoadingState, PageHeader, Panel } from '../components/ui';
import { MoneyInput } from '../components/MoneyInput';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { attendanceStatusLabels, paymentMethodLabels } from '../lib/labels';
import {
  getAcademicSettings,
  saveAcademicSettings,
  getFinanceSettings,
  getInstitutionSettings,
  saveFinanceSettings,
  saveInstitutionSettings,
  uploadInstitutionLogo,
} from '../services/settings';
import type { AcademicSettings, AttendanceStatus, FinanceSettings, InstitutionSettings, PaymentMethod } from '../types';

export function SettingsPage() {
  const { data, error, reload } = useAsync(() => Promise.all([getInstitutionSettings(), getFinanceSettings(), getAcademicSettings()]), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  return (
    <>
      <PageHeader title="Pengaturan" description="Data lembaga tampil di invoice dan kuitansi. Pengaturan keuangan dipakai saat membuat tagihan." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <InstitutionForm initial={data[0]} onSaved={reload} />
          <AcademicForm initial={data[2]} onSaved={reload} />
        </div>
        <FinanceForm initial={data[1]} onSaved={reload} />
      </div>
    </>
  );
}

function InstitutionForm({ initial, onSaved }: { initial: InstitutionSettings; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(initial), [initial]);
  const set = (k: keyof InstitutionSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await saveInstitutionSettings(form);
      setMsg('Data lembaga tersimpan.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadInstitutionLogo(file, initial.logoPath);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Lembaga">
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <Avatar name={form.name || 'Logo'} url={initial.logoUrl} size="lg" />
          <Field label="Logo" hint="PNG/JPG, maksimal 2 MB. Langsung tersimpan setelah dipilih.">
            <input className="input" type="file" accept="image/*" disabled={busy} onChange={(e) => onLogo(e.target.files?.[0])} />
          </Field>
        </div>
        <Field label="Nama lembaga" required>
          <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Alamat">
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telepon">
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <input className="input" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy}>
            Simpan data lembaga
          </Button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
        <FormError message={error} />
      </form>
    </Panel>
  );
}

const STATUSES: AttendanceStatus[] = ['present', 'late', 'excused', 'absent'];
const METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'ewallet', 'other'];

function FinanceForm({ initial, onSaved }: { initial: FinanceSettings; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(initial), [initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await saveFinanceSettings(form);
      setMsg('Pengaturan keuangan tersimpan.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Keuangan">
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tarif per sesi (default)">
            <MoneyInput value={form.defaultSessionRate} onChange={(n) => setForm({ ...form, defaultSessionRate: n })} />
          </Field>
          <Field label="Tarif bulanan (default)">
            <MoneyInput value={form.defaultMonthlyRate} onChange={(n) => setForm({ ...form, defaultMonthlyRate: n })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prefix invoice">
            <input className="input" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
          </Field>
          <Field label="Prefix kuitansi">
            <input className="input" value={form.receiptPrefix} onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value })} />
          </Field>
          <Field label="Prefix bayar">
            <input className="input" value={form.paymentPrefix} onChange={(e) => setForm({ ...form, paymentPrefix: e.target.value })} />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-ink-500">Contoh nomor: {form.invoicePrefix || 'INV'}/202610/0001</p>
        <Field label="Jatuh tempo (hari setelah tagihan dibuat)">
          <input className="input sm:w-32" type="number" min={0} value={form.defaultDueDays} onChange={(e) => setForm({ ...form, defaultDueDays: Number(e.target.value) })} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">Aturan tagihan per sesi: status absensi yang ditagih</legend>
          <div className="flex flex-wrap gap-4">
            {STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.billingRules[s]}
                  onChange={(e) => setForm({ ...form, billingRules: { ...form.billingRules, [s]: e.target.checked } })}
                />
                {attendanceStatusLabels[s].label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-500">Berlaku untuk tagihan yang dibuat setelah disimpan. Tagihan lama tidak berubah.</p>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">Metode pembayaran yang diterima</legend>
          <div className="flex flex-wrap gap-4">
            {METHODS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.paymentMethods.includes(m)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      paymentMethods: e.target.checked ? [...form.paymentMethods, m] : form.paymentMethods.filter((x) => x !== m),
                    })
                  }
                />
                {paymentMethodLabels[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Instruksi pembayaran" hint="Tampil di invoice. Contoh: Transfer ke BCA 1234567890 a.n. ...">
          <textarea className="input" rows={3} value={form.paymentInstructions} onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy}>
            Simpan pengaturan keuangan
          </Button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
        <FormError message={error} />
      </form>
    </Panel>
  );
}

function AcademicForm({ initial, onSaved }: { initial: AcademicSettings; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(initial), [initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await saveAcademicSettings(form);
      setMsg('Pengaturan akademik tersimpan.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Akademik">
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tahun ajaran" hint="Contoh: 2026/2027">
            <input className="input" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
          </Field>
          <Field label="Semester berjalan">
            <input className="input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Semester 1" />
          </Field>
        </div>
        <Field label="Durasi kelas default (menit)" hint="Dipakai untuk mengisi jam selesai otomatis di jadwal dan sesi tambahan.">
          <input className="input sm:w-32" type="number" min={15} max={300} value={form.defaultClassDuration} onChange={(e) => setForm({ ...form, defaultClassDuration: Number(e.target.value) })} />
        </Field>
        <p className="text-xs text-ink-500">Level dikelola di menu Level.</p>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={busy}>
            Simpan pengaturan akademik
          </Button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
        <FormError message={error} />
      </form>
    </Panel>
  );
}
