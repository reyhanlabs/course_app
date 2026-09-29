import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { History } from 'lucide-react';
import { MoneyInput } from '../components/MoneyInput';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatDate, formatRupiah, matchesSearch, todayISO } from '../lib/format';
import { billingTypeLabels } from '../lib/labels';
import { listAllProfiles, setNewBillingProfile } from '../services/billingProfiles';
import { getFinanceSettings } from '../services/settings';
import { listStudents } from '../services/students';
import type { BillingProfile, BillingProfileInput, BillingType, FinanceSettings, Student } from '../types';

function rateText(p: BillingProfile) {
  return p.billingType === 'PER_SESSION' ? `${formatRupiah(p.sessionRate)} / sesi` : `${formatRupiah(p.monthlyRate)} / bulan`;
}

export function BillingPage() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([listStudents(), listAllProfiles(), getFinanceSettings()]), []);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<BillingType | '' | 'none'>('');
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Student | null>(null);

  const [students, profiles, finance] = data ?? [[], [], null];
  const byStudent = useMemo(() => {
    const map = new Map<string, BillingProfile[]>();
    for (const p of profiles) map.set(p.studentId, [...(map.get(p.studentId) ?? []), p]);
    for (const list of map.values()) list.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return map;
  }, [profiles]);

  const rows = students
    .filter((s) => s.status === 'active' || byStudent.has(s.id))
    .map((s) => ({ student: s, current: byStudent.get(s.id)?.find((p) => p.effectiveUntil === null) ?? null }))
    .filter(
      (r) =>
        matchesSearch(search, r.student.fullName, r.student.currentClassName) &&
        (!typeFilter || (typeFilter === 'none' ? !r.current : r.current?.billingType === typeFilter)),
    );

  return (
    <>
      <PageHeader
        title="Tarif Siswa"
        description="Setiap siswa punya profil tagihan Per sesi atau Bulanan. Mengubah tarif membuat versi baru; tagihan lama tetap memakai tarif lamanya."
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa atau kelas" />
            <select className="input sm:w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as BillingType | '' | 'none')} aria-label="Filter jenis">
              <option value="">Semua jenis</option>
              <option value="PER_SESSION">Per sesi</option>
              <option value="MONTHLY">Bulanan</option>
              <option value="none">Belum ada tarif</option>
            </select>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Tidak ada siswa" />
          ) : (
            <Table head={['Siswa', 'Jenis', 'Tarif', 'Potongan / tambahan', 'Berlaku sejak', '']}>
              {rows.map(({ student, current }) => (
                <tr key={student.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{student.fullName}</p>
                    <p className="text-xs text-ink-500">{student.currentClassName ?? 'Belum ada kelas'}</p>
                  </td>
                  <td className="px-4 py-3">{current ? <Badge tone="blue">{billingTypeLabels[current.billingType]}</Badge> : <Badge tone="amber">Belum diatur</Badge>}</td>
                  <td className="px-4 py-3">{current ? rateText(current) : '-'}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {current && (current.discount || current.additionalFee)
                      ? [current.discount ? `−${formatRupiah(current.discount)}` : '', current.additionalFee ? `+${formatRupiah(current.additionalFee)}` : '']
                          .filter(Boolean)
                          .join(' ')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">{current ? formatDate(current.effectiveFrom) : '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {byStudent.has(student.id) && (
                      <Button variant="ghost" aria-label="Riwayat tarif" onClick={() => setHistoryTarget(student)}>
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setEditTarget(student)}>
                      {current ? 'Ubah tarif' : 'Atur tarif'}
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
      {finance && (
        <ProfileModal
          open={editTarget !== null}
          student={editTarget}
          current={editTarget ? (byStudent.get(editTarget.id)?.[0] ?? null) : null}
          finance={finance}
          onClose={() => setEditTarget(null)}
          onSaved={reload}
        />
      )}
      <Modal open={historyTarget !== null} wide title={`Riwayat tarif: ${historyTarget?.fullName ?? ''}`} onClose={() => setHistoryTarget(null)}>
        <Table head={['Berlaku', 'Jenis', 'Tarif', 'Potongan', 'Tambahan', 'Catatan']}>
          {(historyTarget ? (byStudent.get(historyTarget.id) ?? []) : []).map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-4 py-2">
                {formatDate(p.effectiveFrom)} – {p.effectiveUntil ? formatDate(p.effectiveUntil) : 'sekarang'}
              </td>
              <td className="px-4 py-2">{billingTypeLabels[p.billingType]}</td>
              <td className="px-4 py-2">{rateText(p)}</td>
              <td className="px-4 py-2">{p.discount ? formatRupiah(p.discount) : '-'}</td>
              <td className="px-4 py-2">{p.additionalFee ? `${formatRupiah(p.additionalFee)} (${p.additionalFeeLabel})` : '-'}</td>
              <td className="px-4 py-2 text-ink-500">{p.notes || '-'}</td>
            </tr>
          ))}
        </Table>
      </Modal>
    </>
  );
}

function ProfileModal({
  open,
  student,
  current,
  finance,
  onClose,
  onSaved,
}: {
  open: boolean;
  student: Student | null;
  current: BillingProfile | null;
  finance: FinanceSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BillingProfileInput>({
    billingType: 'PER_SESSION',
    sessionRate: 0,
    monthlyRate: 0,
    discount: 0,
    additionalFee: 0,
    additionalFeeLabel: 'Biaya materi',
    effectiveFrom: todayISO(),
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const firstOfNextMonth = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    })();
    setForm(
      current
        ? {
            billingType: current.billingType,
            sessionRate: current.sessionRate,
            monthlyRate: current.monthlyRate,
            discount: current.discount,
            additionalFee: current.additionalFee,
            additionalFeeLabel: current.additionalFeeLabel,
            effectiveFrom: firstOfNextMonth,
            notes: '',
          }
        : {
            billingType: 'PER_SESSION',
            sessionRate: finance.defaultSessionRate,
            monthlyRate: finance.defaultMonthlyRate,
            discount: 0,
            additionalFee: 0,
            additionalFeeLabel: 'Biaya materi',
            effectiveFrom: student?.startDate || todayISO(),
            notes: '',
          },
    );
  }, [open, current, finance, student]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!student) return;
    setBusy(true);
    setError(null);
    try {
      await setNewBillingProfile(student, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const typeChanged = current && current.billingType !== form.billingType;

  return (
    <Modal
      open={open}
      title={`${current ? 'Ubah' : 'Atur'} tarif: ${student?.fullName ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="profile-form" loading={busy}>
            Simpan sebagai versi baru
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={onSubmit} className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">Jenis tagihan</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['PER_SESSION', 'MONTHLY'] as BillingType[]).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${form.billingType === t ? 'border-brand-600 bg-brand-50' : 'border-ink-200'}`}
              >
                <input type="radio" className="sr-only" checked={form.billingType === t} onChange={() => setForm({ ...form, billingType: t })} />
                <span className="font-semibold">{billingTypeLabels[t]}</span>
                <span className="block text-xs text-ink-500">
                  {t === 'PER_SESSION' ? 'Dihitung dari sesi yang dihadiri' : 'Biaya tetap per bulan'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {form.billingType === 'PER_SESSION' ? (
          <Field label="Tarif per sesi" required>
            <MoneyInput value={form.sessionRate} onChange={(n) => setForm({ ...form, sessionRate: n })} required />
          </Field>
        ) : (
          <Field label="Tarif bulanan" required>
            <MoneyInput value={form.monthlyRate} onChange={(n) => setForm({ ...form, monthlyRate: n })} required />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Potongan per tagihan">
            <MoneyInput value={form.discount} onChange={(n) => setForm({ ...form, discount: n })} />
          </Field>
          <Field label="Biaya tambahan per tagihan">
            <MoneyInput value={form.additionalFee} onChange={(n) => setForm({ ...form, additionalFee: n })} />
          </Field>
        </div>
        {form.additionalFee > 0 && (
          <Field label="Nama biaya tambahan">
            <input className="input" value={form.additionalFeeLabel} onChange={(e) => setForm({ ...form, additionalFeeLabel: e.target.value })} />
          </Field>
        )}
        <Field
          label="Berlaku mulai"
          required
          hint={
            current
              ? `Tarif sekarang berlaku sejak ${formatDate(current.effectiveFrom)} dan akan ditutup sehari sebelum tanggal ini.`
              : 'Biasanya tanggal mulai kursus.'
          }
        >
          <input className="input sm:w-48" type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </Field>
        {typeChanged && (
          <p className="rounded-lg bg-marker-soft/60 px-3 py-2 text-sm">
            Jenis tagihan berubah. Sebaiknya berlaku mulai tanggal 1 agar satu bulan tidak ditagih dengan dua cara.
          </p>
        )}
        <Field label="Catatan">
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contoh: kenaikan tarif tahun ajaran baru" />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
