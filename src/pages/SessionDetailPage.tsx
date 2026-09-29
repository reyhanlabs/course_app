import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { LessonSummary } from '../components/LessonSummary';
import { Badge, Button, DetailRow, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatDateWithDay, percent, todayISO } from '../lib/format';
import { attendanceStatusLabels, sessionStatusLabels } from '../lib/labels';
import { getRoster, isPresent, listAttendanceOfSession, saveAttendance, type AttendanceEntry } from '../services/attendance';
import { getClass } from '../services/classes';
import { listLessonsOfLevel } from '../services/curriculum';
import { getDocById } from '../services/db';
import { cancelSession, getSession, restoreSession, updateSessionPlan } from '../services/sessions';
import { getTeacher } from '../services/teachers';
import type { AttendanceStatus, Room } from '../types';

const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'excused', 'absent'];

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  const { data, error, reload } = useAsync(async () => {
    const session = await getSession(id);
    if (!session) throw new Error('Sesi tidak ditemukan.');
    const courseClass = await getClass(session.classId);
    if (!courseClass) throw new Error('Kelas sesi ini tidak ditemukan.');
    const [lessons, roster, attendance, room, teacherName] = await Promise.all([
      listLessonsOfLevel(courseClass.levelId),
      getRoster(session),
      listAttendanceOfSession(session),
      session.roomId ? getDocById<Room>('rooms', session.roomId) : Promise.resolve(null),
      isTeacher
        ? Promise.resolve(profile.displayName)
        : session.teacherId
          ? getTeacher(session.teacherId).then((t) => t?.fullName ?? '-')
          : Promise.resolve('-'),
    ]);
    return { session, courseClass, lessons, roster, attendance, room, teacherName };
  }, [id]);

  const [plan, setPlan] = useState({ topic: '', lessonId: '' as string, notes: '' });
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [attBusy, setAttBusy] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
  const [attMsg, setAttMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPlan({ topic: data.session.topic, lessonId: data.session.lessonId ?? '', notes: data.session.notes });
    const saved = new Map(data.attendance.map((a) => [a.studentId, a]));
    // Siswa yang sudah diabsen tapi sudah tidak ada di roster tetap ditampilkan.
    const ids = new Set([...data.roster.map((r) => r.studentId), ...data.attendance.map((a) => a.studentId)]);
    const rosterName = new Map(data.roster.map((r) => [r.studentId, r.studentName]));
    setEntries(
      [...ids].map((studentId) => {
        const a = saved.get(studentId);
        return {
          studentId,
          studentName: a?.studentName ?? rosterName.get(studentId) ?? 'Siswa',
          status: a?.status ?? 'present',
          checkInTime: a?.checkInTime ?? '',
          notes: a?.notes ?? '',
        };
      }),
    );
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { session, courseClass, lessons, attendance, room, teacherName } = data;
  const st = sessionStatusLabels[session.status];
  const canEdit = (isAdmin || isTeacher) && session.status !== 'cancelled';
  const isFuture = session.date > todayISO();
  const selectedLesson = lessons.find((l) => l.id === plan.lessonId);
  const presentCount = entries.filter((e) => isPresent(e.status)).length;

  async function savePlan() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      await updateSessionPlan(session, { ...plan, lessonId: plan.lessonId || null });
      setPlanMsg('Rencana pelajaran tersimpan.');
      reload();
    } catch (e) {
      setPlanMsg(errorMessage(e));
    } finally {
      setPlanBusy(false);
    }
  }

  async function submitAttendance() {
    setAttBusy(true);
    setAttError(null);
    setAttMsg(null);
    try {
      await saveAttendance(session, entries, attendance);
      setAttMsg('Absensi tersimpan dan sesi ditandai selesai.');
      reload();
    } catch (e) {
      setAttError(errorMessage(e));
    } finally {
      setAttBusy(false);
    }
  }

  const update = (studentId: string, patch: Partial<AttendanceEntry>) =>
    setEntries((list) => list.map((e) => (e.studentId === studentId ? { ...e, ...patch } : e)));

  return (
    <>
      <Link
        to={profile.role === 'owner' ? '/attendance' : '/sessions'}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {profile.role === 'owner' ? 'Absensi' : 'Daftar sesi'}
      </Link>
      <PageHeader
        title={`${courseClass.className} — ${formatDateWithDay(session.date)}`}
        actions={
          isAdmin &&
          (session.status === 'cancelled' ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await restoreSession(session);
                  reload();
                } catch (e) {
                  window.alert(errorMessage(e));
                }
              }}
            >
              Pulihkan sesi
            </Button>
          ) : session.status === 'scheduled' ? (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>
              Batalkan sesi
            </Button>
          ) : null)
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Panel title="Informasi sesi">
            <dl className="divide-y divide-ink-100 px-4 py-2">
              <DetailRow label="Jam" value={`${session.startTime}–${session.endTime}`} />
              <DetailRow label="Guru" value={teacherName} />
              <DetailRow label="Ruangan" value={room?.name} />
              <DetailRow label="Jenis" value={session.scheduleId ? 'Sesi rutin' : 'Sesi tambahan'} />
              <DetailRow label="Status" value={<Badge tone={st.tone}>{st.label}</Badge>} />
              {session.status === 'cancelled' && <DetailRow label="Alasan batal" value={session.cancelReason} />}
            </dl>
          </Panel>

          <Panel title="Rencana pelajaran">
            <div className="space-y-4 p-4">
              <Field label="Pelajaran dari kurikulum">
                <select className="input" disabled={!canEdit} value={plan.lessonId} onChange={(e) => {
                  const lesson = lessons.find((l) => l.id === e.target.value);
                  setPlan({ ...plan, lessonId: e.target.value, topic: plan.topic || lesson?.title || '' });
                }}>
                  <option value="">Tidak memakai kurikulum</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      Minggu {l.weekNumber}: {l.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Topik">
                <input className="input" disabled={!canEdit} value={plan.topic} onChange={(e) => setPlan({ ...plan, topic: e.target.value })} />
              </Field>
              <Field label="Catatan sesi">
                <textarea className="input" rows={3} disabled={!canEdit} value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} />
              </Field>
              {canEdit && (
                <Button onClick={savePlan} loading={planBusy}>
                  Simpan rencana
                </Button>
              )}
              {planMsg && <p className="text-sm text-ink-700">{planMsg}</p>}
            </div>
          </Panel>

          {selectedLesson && (
            <Panel title={`Isi pelajaran: ${selectedLesson.title}`}>
              <div className="p-4">
                <LessonSummary lesson={selectedLesson} />
              </div>
            </Panel>
          )}
        </div>

        <Panel
          className="lg:col-span-2"
          title="Absensi"
          actions={
            entries.length > 0 && (
              <span className="text-sm text-ink-500">
                Hadir {presentCount} dari {entries.length} ({percent(presentCount, entries.length)})
              </span>
            )
          }
        >
          {session.status === 'cancelled' ? (
            <EmptyState title="Sesi dibatalkan" description="Sesi yang dibatalkan tidak diabsen dan tidak ditagihkan." />
          ) : entries.length === 0 ? (
            <EmptyState title="Tidak ada siswa di kelas ini pada tanggal sesi" description="Siswa dimasukkan ke kelas dari halaman detail siswa atau kelas." />
          ) : (
            <>
              {isFuture && <p className="mx-4 mt-4 rounded-lg bg-marker-soft/60 px-3 py-2 text-sm">Absensi bisa diisi mulai hari sesi berlangsung.</p>}
              <ul className="divide-y divide-ink-100">
                {entries.map((e) => (
                  <li key={e.studentId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <span className="flex-1 font-medium">{e.studentName}</span>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Status ${e.studentName}`}>
                      {STATUS_ORDER.map((s) => {
                        const label = attendanceStatusLabels[s];
                        const active = e.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={!canEdit || isFuture}
                            onClick={() => update(e.studentId, { status: s })}
                            className={cn(
                              'rounded-md border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed',
                              active
                                ? {
                                    present: 'border-emerald-600 bg-emerald-600 text-white',
                                    late: 'border-amber-500 bg-amber-500 text-white',
                                    excused: 'border-brand-600 bg-brand-600 text-white',
                                    absent: 'border-rose-600 bg-rose-600 text-white',
                                  }[s]
                                : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
                            )}
                          >
                            {label.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="time"
                      className="input sm:w-28"
                      aria-label="Jam datang"
                      disabled={!canEdit || isFuture || !isPresent(e.status)}
                      value={e.checkInTime}
                      onChange={(ev) => update(e.studentId, { checkInTime: ev.target.value })}
                    />
                    <input
                      className="input sm:w-40"
                      placeholder="Catatan"
                      aria-label="Catatan"
                      disabled={!canEdit || isFuture}
                      value={e.notes}
                      onChange={(ev) => update(e.studentId, { notes: ev.target.value })}
                    />
                  </li>
                ))}
              </ul>
              {canEdit && !isFuture && (
                <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-4 py-3">
                  <Button onClick={submitAttendance} loading={attBusy}>
                    {attendance.length ? 'Perbarui absensi' : 'Simpan absensi'}
                  </Button>
                  <Button variant="ghost" onClick={() => setEntries((l) => l.map((e) => ({ ...e, status: 'present' })))}>
                    Tandai semua hadir
                  </Button>
                  {attMsg && <span className="text-sm text-emerald-700">{attMsg}</span>}
                </div>
              )}
              <div className="px-4 pb-3">
                <FormError message={attError} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          await cancelSession(session, reason);
          reload();
        }}
      />
    </>
  );
}

function CancelModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
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
      title="Batalkan sesi"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Kembali
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Batalkan sesi
          </Button>
        </>
      }
    >
      <Field label="Alasan" required hint="Contoh: guru sakit, libur nasional. Sesi batal tidak ditagihkan.">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <FormError message={error} />
    </Modal>
  );
}
