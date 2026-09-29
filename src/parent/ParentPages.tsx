import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, ExternalLink, NotebookPen, Paperclip, Printer, Wallet, type LucideIcon } from 'lucide-react';
import type { Tone } from '../lib/labels';
import { useProfile } from '../auth/AuthContext';
import { ChildCard } from '../components/ChildCard';
import { LessonSummary } from '../components/LessonSummary';
import { MoneyInput } from '../components/MoneyInput';
import { ProgressHistory } from '../components/ProgressHistory';
import { Badge, Button, buttonClass, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, StatCard, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { effectiveStatus } from '../lib/billing';
import { errorMessage } from '../lib/errors';
import { addDays, formatDate, formatDateWithDay, formatMonth, formatRupiah, percent, todayISO } from '../lib/format';
import {
  attendanceStatusLabels,
  billingTypeLabels,
  dayLabels,
  invoiceStatusLabels,
  materialTypeLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  sessionStatusLabels,
  skillLabels,
} from '../lib/labels';
import { isPresent, listAttendanceOfStudent } from '../services/attendance';
import { getLesson } from '../services/curriculum';
import { listHomeworkOfClasses } from '../services/homework';
import { listParentMaterials } from '../services/materials';
import { listMyInvoices, listMyPayments, listMyReceipts, submitPaymentProof } from '../services/parentPortal';
import { averageScore, listProgressOfStudent } from '../services/progress';
import { listSchedulesOfClasses } from '../services/schedules';
import { listSessionsInRange } from '../services/sessions';
import { getFinanceSettings } from '../services/settings';
import { listSubmissionsOfStudent, submitHomework } from '../services/submissions';
import { SKILLS, type Homework, type HomeworkSubmission, type Invoice, type Lesson, type PaymentMethod } from '../types';
import { useChild } from './ParentArea';
import { LatestAnnouncements } from '../components/LatestAnnouncements';

function NoClass() {
  return (
    <Panel>
      <EmptyState title="Anak belum terdaftar di kelas" description="Hubungi admin kursus." />
    </Panel>
  );
}

// ---------------------------------------------------------------- Ringkasan
export function ChildOverviewPage() {
  const { child, levels } = useChild();
  const profile = useProfile();
  const today = todayISO();
  const { data, error, reload } = useAsync(async () => {
    const classId = child.currentClassId;
    const [attendance, sessions, homework, submissions, invoices, progress] = await Promise.all([
      listAttendanceOfStudent(child.id),
      classId ? listSessionsInRange(today, addDays(today, 14), [classId]) : Promise.resolve([]),
      classId ? listHomeworkOfClasses([classId]) : Promise.resolve([] as Homework[]),
      listSubmissionsOfStudent(child.id),
      listMyInvoices(profile.id),
      listProgressOfStudent(child.id),
    ]);
    return { attendance, sessions, homework, submissions, invoices, progress };
  }, [child.id, child.currentClassId]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const recent = data.attendance.filter((a) => a.date >= addDays(today, -30));
  const present = recent.filter((a) => isPresent(a.status)).length;
  const next = data.sessions.find((s) => s.status === 'scheduled');
  const submitted = new Set(data.submissions.map((s) => s.homeworkId));
  const openHomework = data.homework.filter((h) => h.status === 'active' && !submitted.has(h.id));
  const outstanding = data.invoices
    .filter((i) => i.studentId === child.id && (i.status === 'unpaid' || i.status === 'partially_paid'))
    .reduce((s, i) => s + i.outstandingAmount, 0);
  const lastProgress = data.progress[0];
  const avg = lastProgress ? averageScore(lastProgress.scores) : null;

  const cards: [LucideIcon, Tone, string, string, string, string][] = [
    [ClipboardCheck, 'green', 'Kehadiran 30 hari', percent(present, recent.length), `${present} dari ${recent.length} sesi`, '/p/attendance'],
    [CalendarDays, 'blue', 'Sesi berikutnya', next ? formatDateWithDay(next.date) : '-', next ? `${next.startTime}–${next.endTime}` : 'Belum dijadwalkan', '/p/schedule'],
    [NotebookPen, openHomework.length ? 'amber' : 'gray', 'PR belum dikumpulkan', String(openHomework.length), openHomework[0] ? `Terdekat: ${formatDate(openHomework[0].dueDate)}` : 'Semua beres', '/p/homework'],
    [Wallet, outstanding ? 'red' : 'gray', 'Sisa tagihan', formatRupiah(outstanding), outstanding ? 'Lihat tagihan' : 'Tidak ada tagihan', '/p/invoices'],
  ];

  return (
    <>
      <PageHeader title={child.fullName} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ChildCard student={child} levels={levels} />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {cards.map(([icon, tone, label, value, sub, to]) => (
            <StatCard key={label} icon={icon} tone={tone} label={label} value={value} hint={sub} to={to} />
          ))}
          <Link to="/p/progress" className="block rounded-2xl border border-ink-100 bg-white p-5 shadow-[0_1px_2px_rgba(23,32,64,0.04)] hover:border-brand-200 sm:col-span-2">
            <p className="text-sm text-ink-500">Penilaian terakhir</p>
            {lastProgress ? (
              <>
                <p className="mt-1 text-xl font-bold">
                  {avg?.toFixed(1)} <span className="text-sm font-normal text-ink-500">rata-rata, {formatDate(lastProgress.assessedAt)}</span>
                </p>
                {lastProgress.notes && <p className="mt-1 text-sm text-ink-700">“{lastProgress.notes}”</p>}
              </>
            ) : (
              <p className="mt-1 text-sm">Belum ada penilaian.</p>
            )}
          </Link>
        </div>
      </div>
      <div className="mt-6">
        <LatestAnnouncements />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Jadwal
export function ParentSchedulePage() {
  const { child } = useChild();
  const today = todayISO();
  const { data, error, reload } = useAsync(async () => {
    if (!child.currentClassId) return null;
    return Promise.all([listSchedulesOfClasses([child.currentClassId]), listSessionsInRange(today, addDays(today, 30), [child.currentClassId])]);
  }, [child.currentClassId]);
  if (!child.currentClassId) return <NoClass />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [schedules, sessions] = data;
  return (
    <>
      <PageHeader title="Jadwal" description={`Kelas ${child.currentClassName ?? ''}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Jadwal mingguan">
          {schedules.filter((s) => s.status === 'active').length === 0 ? (
            <EmptyState title="Belum ada jadwal" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {schedules
                .filter((s) => s.status === 'active')
                .map((s) => (
                  <li key={s.id} className="px-4 py-3 text-sm">
                    <span className="font-semibold">{dayLabels[s.dayOfWeek]}</span>, {s.startTime}–{s.endTime}
                  </li>
                ))}
            </ul>
          )}
        </Panel>
        <Panel title="30 hari ke depan" className="lg:col-span-2">
          {sessions.length === 0 ? (
            <EmptyState title="Belum ada sesi terjadwal" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {sessions.map((s) => {
                const st = sessionStatusLabels[s.status];
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-44 font-semibold">{formatDateWithDay(s.date)}</span>
                    <span className="w-24">
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className="flex-1 text-ink-700">{s.status === 'cancelled' ? `Libur: ${s.cancelReason ?? ''}` : s.topic || ''}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Absensi
export function ParentAttendancePage() {
  const { child } = useChild();
  const [month, setMonth] = useState('');
  const { data, error, reload } = useAsync(() => listAttendanceOfStudent(child.id), [child.id]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const rows = data.filter((a) => !month || a.date.startsWith(month));
  const present = rows.filter((a) => isPresent(a.status)).length;
  return (
    <>
      <PageHeader title="Absensi" />
      <Panel
        title={`Kehadiran ${percent(present, rows.length)} (${present} dari ${rows.length} sesi)`}
        actions={<input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan" />}
      >
        {rows.length === 0 ? (
          <EmptyState title="Belum ada data absensi" />
        ) : (
          <Table head={['Tanggal', 'Status', 'Jam datang', 'Catatan guru']}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2">{formatDateWithDay(a.date)}</td>
                <td className="px-4 py-2">
                  <Badge tone={attendanceStatusLabels[a.status].tone}>{attendanceStatusLabels[a.status].label}</Badge>
                </td>
                <td className="px-4 py-2">{a.checkInTime || '-'}</td>
                <td className="px-4 py-2 text-ink-700">{a.notes || '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Pelajaran
export function ParentLessonsPage() {
  const { child } = useChild();
  const today = todayISO();
  const { data, error, reload } = useAsync(async () => {
    if (!child.currentClassId) return null;
    const sessions = (await listSessionsInRange(addDays(today, -60), today, [child.currentClassId]))
      .filter((s) => s.status === 'completed')
      .reverse();
    const ids = [...new Set(sessions.map((s) => s.lessonId).filter((x): x is string => Boolean(x)))];
    const lessons = (await Promise.all(ids.map(getLesson))).filter((l): l is Lesson => l !== null);
    return { sessions, lessons: new Map(lessons.map((l) => [l.id, l])) };
  }, [child.currentClassId]);
  const [open, setOpen] = useState<Lesson | null>(null);
  if (!child.currentClassId) return <NoClass />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  return (
    <>
      <PageHeader title="Pelajaran" description="Materi yang dipelajari di kelas dalam 60 hari terakhir. Bisa dipakai untuk mengulang di rumah." />
      <Panel>
        {data.sessions.length === 0 ? (
          <EmptyState title="Belum ada pelajaran tercatat" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.sessions.map((s) => {
              const lesson = s.lessonId ? data.lessons.get(s.lessonId) : undefined;
              return (
                <li key={s.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                  <span className="w-44 font-semibold">{formatDateWithDay(s.date)}</span>
                  <span className="flex-1">
                    <span className="font-medium">{s.topic || lesson?.title || 'Topik tidak dicatat'}</span>
                    {lesson?.vocabulary && <span className="block text-ink-500">Vocabulary: {lesson.vocabulary}</span>}
                  </span>
                  {lesson && (
                    <Button variant="ghost" onClick={() => setOpen(lesson)}>
                      Lihat isi
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Modal open={open !== null} wide title={open?.title ?? ''} onClose={() => setOpen(null)}>
        {open && <LessonSummary lesson={{ ...open, teachingNotes: '' }} />}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- Materi
export function ParentMaterialsPage() {
  const { child, levels } = useChild();
  const { data, error, reload } = useAsync(listParentMaterials, []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const rows = data.filter((m) => !m.levelId || m.levelId === child.currentLevelId);
  const levelName = levels.find((l) => l.id === child.currentLevelId)?.name;
  return (
    <>
      <PageHeader title="Materi" description={levelName ? `Materi untuk level ${levelName} dan materi umum.` : undefined} />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada materi" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <Badge tone="blue">{materialTypeLabels[m.type]}</Badge>
                <div className="flex-1">
                  <a href={m.storageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline">
                    {m.title} <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                  </a>
                  {m.description && <p className="text-ink-500">{m.description}</p>}
                  {m.topic && <p className="text-xs text-ink-500">Topik: {m.topic}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- PR
export function ParentHomeworkPage() {
  const { child } = useChild();
  const { data, error, reload } = useAsync(async () => {
    if (!child.currentClassId) return null;
    return Promise.all([listHomeworkOfClasses([child.currentClassId]), listSubmissionsOfStudent(child.id)]);
  }, [child.id, child.currentClassId]);
  const [target, setTarget] = useState<Homework | null>(null);
  if (!child.currentClassId) return <NoClass />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [homework, submissions] = data;
  const byHw = new Map(submissions.map((s) => [s.homeworkId, s]));
  const today = todayISO();
  return (
    <>
      <PageHeader title="PR" description="Unggah foto atau file jawaban anak. Guru akan memberi umpan balik." />
      <Panel>
        {homework.length === 0 ? (
          <EmptyState title="Belum ada PR" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {homework.map((h) => {
              const sub = byHw.get(h.id);
              const late = !sub && h.status === 'active' && h.dueDate < today;
              return (
                <li key={h.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{h.title}</p>
                    <p className="text-ink-500">
                      Diberikan {formatDate(h.assignedDate)} · batas {formatDate(h.dueDate)}
                    </p>
                    {h.description && <p className="mt-1 whitespace-pre-line text-ink-700">{h.description}</p>}
                    {h.attachmentUrl && (
                      <a href={h.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Paperclip className="h-3.5 w-3.5" /> {h.attachmentName ?? 'Lampiran'}
                      </a>
                    )}
                    {sub?.feedback && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                        Umpan balik {sub.reviewedByName ?? 'guru'}: {sub.feedback}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge tone={sub ? (sub.status === 'reviewed' ? 'green' : 'blue') : late ? 'red' : h.status === 'closed' ? 'gray' : 'amber'}>
                      {sub ? (sub.status === 'reviewed' ? 'Sudah dinilai' : 'Sudah dikumpulkan') : late ? 'Terlambat' : h.status === 'closed' ? 'Ditutup' : 'Belum dikumpulkan'}
                    </Badge>
                    {h.status === 'active' && (
                      <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setTarget(h)}>
                        {sub ? 'Ganti jawaban' : 'Kumpulkan'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <SubmitModal homework={target} existing={target ? (byHw.get(target.id) ?? null) : null} onClose={() => setTarget(null)} onSaved={reload} />
    </>
  );
}

function SubmitModal({ homework, existing, onClose, onSaved }: { homework: Homework | null; existing: HomeworkSubmission | null; onClose: () => void; onSaved: () => void }) {
  const { child } = useChild();
  const profile = useProfile();
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (homework) {
      setNote(existing?.note ?? '');
      setFile(null);
      setError(null);
    }
  }, [homework, existing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!homework) return;
    setBusy(true);
    setError(null);
    try {
      await submitHomework(homework, child, { note, file }, existing, profile);
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
      open={homework !== null}
      title={`Kumpulkan: ${homework?.title ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="submit-form" loading={busy}>
            Kirim jawaban
          </Button>
        </>
      }
    >
      <form id="submit-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="File jawaban" hint={existing?.fileName ? `Terkirim: ${existing.fileName}. Pilih file baru untuk mengganti.` : 'Foto lembar kerja atau file, maksimal 20 MB'}>
          <input className="input" type="file" accept="image/*,application/pdf,audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Catatan untuk guru">
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Perkembangan
export function ParentProgressPage() {
  const { child } = useChild();
  const { data, error, reload } = useAsync(() => listProgressOfStudent(child.id), [child.id]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const latest = data[0];
  return (
    <>
      <PageHeader title="Perkembangan" description="Nilai 1–5 per keterampilan dari guru. Riwayat lengkap di bawah." />
      {latest && (
        <Panel title={`Penilaian terakhir, ${formatDate(latest.assessedAt)}`} className="mb-6">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {SKILLS.filter((s) => latest.scores[s]).map((s) => (
              <div key={s}>
                <div className="flex justify-between text-sm">
                  <span>{skillLabels[s]}</span>
                  <span className="font-semibold">{latest.scores[s]}/5</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ink-100">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${((latest.scores[s] ?? 0) / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {latest.notes && <p className="border-t border-ink-100 px-4 py-3 text-sm">Catatan guru: {latest.notes}</p>}
        </Panel>
      )}
      <Panel title="Riwayat">
        <ProgressHistory records={data} />
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Tagihan
export function ParentInvoicesPage() {
  const { child } = useChild();
  const profile = useProfile();
  const { data, error, reload } = useAsync(
    () => Promise.all([listMyInvoices(profile.id), listMyPayments(profile.id), getFinanceSettings()]),
    [profile.id],
  );
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [allInvoices, payments, finance] = data;
  const invoices = allInvoices.filter((i) => i.studentId === child.id);
  const today = todayISO();
  const pendingOf = (id: string) => payments.filter((p) => p.invoiceId === id && p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <PageHeader title="Tagihan" />
      {finance.paymentInstructions && (
        <Panel title="Cara pembayaran" className="mb-6">
          <p className="whitespace-pre-line px-4 py-3 text-sm">{finance.paymentInstructions}</p>
        </Panel>
      )}
      <Panel>
        {invoices.length === 0 ? (
          <EmptyState title="Belum ada tagihan" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {invoices.map((i) => {
              const st = invoiceStatusLabels[effectiveStatus(i, today)];
              const pending = pendingOf(i.id);
              const canPay = (i.status === 'unpaid' || i.status === 'partially_paid') && i.outstandingAmount - pending > 0;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {formatMonth(i.periodStart.slice(0, 7))} · {billingTypeLabels[i.billingType]}
                    </p>
                    <p className="text-ink-500">
                      {i.invoiceNumber} · jatuh tempo {formatDate(i.dueDate)}
                    </p>
                    {pending > 0 && <p className="text-xs text-amber-700">{formatRupiah(pending)} menunggu verifikasi admin</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatRupiah(i.total)}</p>
                    {i.status !== 'cancelled' && i.outstandingAmount > 0 && <p className="text-xs text-ink-500">sisa {formatRupiah(i.outstandingAmount)}</p>}
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Link to={`/invoices/${i.id}/print`} className={buttonClass('ghost')}>
                    <Printer className="h-4 w-4" /> Lihat
                  </Link>
                  {canPay && (
                    <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setPayTarget(i)}>
                      Kirim bukti bayar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <ProofModal
        invoice={payTarget}
        pendingSum={payTarget ? pendingOf(payTarget.id) : 0}
        methods={finance.paymentMethods.filter((m) => m !== 'cash')}
        onClose={() => setPayTarget(null)}
        onSaved={reload}
      />
    </>
  );
}

function ProofModal({
  invoice,
  pendingSum,
  methods,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  pendingSum: number;
  methods: PaymentMethod[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const profile = useProfile();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = invoice ? invoice.outstandingAmount - pendingSum : 0;
  useEffect(() => {
    if (invoice) {
      setAmount(available);
      setDate(todayISO());
      setMethod(methods[0] ?? 'bank_transfer');
      setReference('');
      setNotes('');
      setFile(null);
      setError(null);
    }
  }, [invoice, available, methods]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      await submitPaymentProof(invoice, { amount, paymentDate: date, paymentMethod: method, referenceNumber: reference, notes }, file, pendingSum, profile);
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
      open={invoice !== null}
      title="Kirim bukti bayar"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="proof-form" loading={busy}>
            Kirim
          </Button>
        </>
      }
    >
      <form id="proof-form" onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-700">
          Sisa yang bisa dibayar: <strong>{formatRupiah(available)}</strong>. Admin akan memeriksa dan menerbitkan kuitansi.
        </p>
        <Field label="Nominal yang dibayar" required>
          <MoneyInput value={amount} onChange={setAmount} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal bayar" required>
            <input className="input" type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Metode">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabels[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Bukti transfer" required hint="Foto atau PDF, maksimal 10 MB">
          <input className="input" type="file" required accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Nomor referensi / nama pengirim">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Catatan">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Pembayaran & kuitansi
export function ParentPaymentsPage() {
  const { child } = useChild();
  const profile = useProfile();
  const { data, error, reload } = useAsync(() => listMyPayments(profile.id), [profile.id]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const rows = data.filter((p) => p.studentId === child.id);
  return (
    <>
      <PageHeader title="Pembayaran" />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada pembayaran" />
        ) : (
          <Table head={['Tanggal', 'Tagihan', 'Metode', 'Nominal', 'Status', '']}>
            {rows.map((p) => {
              const st = paymentStatusLabels[p.status];
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{p.invoiceNumber}</td>
                  <td className="px-4 py-2">{paymentMethodLabels[p.paymentMethod]}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(p.amount)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {p.rejectReason && <span className="block text-xs text-ink-500">{p.rejectReason}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.status === 'verified' && (
                      <Link to={`/receipts/${p.id}`} className="text-brand-600 hover:underline">
                        Kuitansi
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </>
  );
}

export function ParentReceiptsPage() {
  const { child } = useChild();
  const profile = useProfile();
  const { data, error, reload } = useAsync(() => listMyReceipts(profile.id), [profile.id]);
  const rows = useMemo(() => (data ?? []).filter((r) => r.studentId === child.id), [data, child.id]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  return (
    <>
      <PageHeader title="Kuitansi" />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada kuitansi" />
        ) : (
          <Table head={['Nomor', 'Tanggal bayar', 'Tagihan', 'Nominal', 'Sisa tagihan']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2">
                  <Link to={`/receipts/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                    {r.receiptNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatDate(r.paymentDate)}</td>
                <td className="whitespace-nowrap px-4 py-2">{r.invoiceNumber}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(r.remainingBalance)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

