import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { ClassSelect } from '../components/ClassSelect';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { addDays, currentMonth, formatDate, formatDateWithDay, monthRange, startOfWeek, todayISO } from '../lib/format';
import { sessionStatusLabels } from '../lib/labels';
import { listAccessibleClasses } from '../services/scope';
import { listRooms } from '../services/rooms';
import { createExtraSession, generateSessionsFromSchedules, listSessionsInRange } from '../services/sessions';
import { listTeachers } from '../services/teachers';
import type { CourseClass, Room, Teacher } from '../types';

export function SessionsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';
  const [weekStart, setWeekStart] = useState(startOfWeek(todayISO()));
  const [classId, setClassId] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const weekEnd = addDays(weekStart, 6);

  const base = useAsync(async () => {
    const classes = await listAccessibleClasses(profile);
    const [rooms, teachers] = await Promise.all([listRooms(), isTeacher ? Promise.resolve([] as Teacher[]) : listTeachers()]);
    return { classes, rooms, teachers };
  }, [profile.id]);

  const sessions = useAsync(async () => {
    if (!base.data) return [];
    const ids = isTeacher ? base.data.classes.map((c) => c.id) : null;
    return listSessionsInRange(weekStart, weekEnd, ids);
  }, [base.data, weekStart]);

  const names = useMemo(() => {
    const d = base.data;
    return {
      cls: new Map((d?.classes ?? []).map((c) => [c.id, c.className])),
      room: new Map((d?.rooms ?? []).map((r) => [r.id, r.name])),
      teacher: new Map((d?.teachers ?? []).map((t) => [t.id, t.fullName])),
    };
  }, [base.data]);

  if (base.error) return <ErrorState message={base.error} onRetry={base.reload} />;
  if (!base.data) return <LoadingState />;

  const rows = (sessions.data ?? []).filter((s) => !classId || s.classId === classId);
  const dates = [...new Set(rows.map((s) => s.date))];
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Sesi"
        description="Sesi adalah pertemuan nyata per tanggal. Absensi dan penagihan per sesi memakai data ini."
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setExtraOpen(true)}>
                <Plus className="h-4 w-4" /> Sesi tambahan
              </Button>
              <Button onClick={() => setGenerateOpen(true)}>
                <CalendarPlus className="h-4 w-4" /> Buat sesi dari jadwal
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Minggu sebelumnya" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-semibold">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </span>
          <Button variant="secondary" aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => setWeekStart(startOfWeek(today))}>
            Minggu ini
          </Button>
        </div>
        <ClassSelect classes={base.data.classes} value={classId} onChange={setClassId} allowAll />
      </div>

      {sessions.error ? (
        <ErrorState message={sessions.error} onRetry={sessions.reload} />
      ) : !sessions.data || (sessions.loading && dates.length === 0) ? (
        <LoadingState />
      ) : dates.length === 0 ? (
        <Panel>
          <EmptyState
            title="Tidak ada sesi minggu ini"
            description={isAdmin ? 'Gunakan "Buat sesi dari jadwal" untuk membuat sesi dari jadwal mingguan.' : 'Admin belum membuat sesi untuk minggu ini.'}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <Panel key={date} title={`${formatDateWithDay(date)}${date === today ? ' (hari ini)' : ''}`}>
              <ul className="divide-y divide-ink-100">
                {rows
                  .filter((s) => s.date === date)
                  .map((s) => {
                    const st = sessionStatusLabels[s.status];
                    return (
                      <li key={s.id}>
                        <Link to={`/sessions/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-ink-50">
                          <span className="w-24 font-semibold">
                            {s.startTime}–{s.endTime}
                          </span>
                          <span className="min-w-32 flex-1">
                            <span className="font-semibold">{names.cls.get(s.classId) ?? 'Kelas'}</span>
                            <span className="block text-ink-500">
                              {s.topic || 'Topik belum diisi'}
                              {!s.scheduleId && ' · sesi tambahan'}
                            </span>
                          </span>
                          {!isTeacher && <span className="text-ink-500">{(s.teacherId && names.teacher.get(s.teacherId)) || '-'}</span>}
                          <span className="text-ink-500">{(s.roomId && names.room.get(s.roomId)) || ''}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} onDone={sessions.reload} />
          <ExtraSessionModal
            open={extraOpen}
            classes={base.data.classes}
            rooms={base.data.rooms}
            teachers={base.data.teachers}
            onClose={() => setExtraOpen(false)}
            onDone={sessions.reload}
          />
        </>
      )}
    </>
  );
}

function GenerateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const range = monthRange(currentMonth());
    setFrom(todayISO());
    setTo(range.to);
    setError(null);
    setResult(null);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await generateSessionsFromSchedules(from, to);
      setResult(r.created === 0 ? 'Semua sesi di rentang ini sudah ada. Tidak ada yang dibuat.' : `${r.created} sesi baru dibuat.`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Buat sesi dari jadwal"
      onClose={onClose}
      footer={
        result ? (
          <Button onClick={onClose}>Selesai</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button type="submit" form="generate-form" loading={busy}>
              Buat sesi
            </Button>
          </>
        )
      }
    >
      {result ? (
        <p className="text-sm">{result}</p>
      ) : (
        <form id="generate-form" onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-ink-700">
            Setiap jadwal aktif menghasilkan satu sesi untuk setiap tanggal yang cocok. Aman dijalankan berulang: sesi yang sudah ada
            (termasuk yang dibatalkan) tidak dibuat ulang.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari tanggal" required>
              <input className="input" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Sampai tanggal" required>
              <input className="input" type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </form>
      )}
      <FormError message={error} />
    </Modal>
  );
}

function ExtraSessionModal({
  open,
  classes,
  rooms,
  teachers,
  onClose,
  onDone,
}: {
  open: boolean;
  classes: CourseClass[];
  rooms: Room[];
  teachers: Teacher[];
  onClose: () => void;
  onDone: () => void;
}) {
  const blank = { classId: '', teacherId: null as string | null, roomId: null as string | null, date: todayISO(), startTime: '15:00', endTime: '16:00', topic: '' };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...blank, date: todayISO() });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createExtraSession(form);
      onDone();
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
      title="Sesi tambahan / pengganti"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="extra-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="extra-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Kelas" required>
          <select
            className="input"
            required
            value={form.classId}
            onChange={(e) => {
              const c = classes.find((x) => x.id === e.target.value);
              setForm({ ...form, classId: e.target.value, teacherId: c?.teacherId ?? form.teacherId });
            }}
          >
            <option value="">Pilih kelas</option>
            {classes
              .filter((c) => c.status === 'active')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tanggal" required>
            <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Mulai" required>
            <input className="input" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Selesai" required>
            <input className="input" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Guru">
          <select className="input" value={form.teacherId ?? ''} onChange={(e) => setForm({ ...form, teacherId: e.target.value || null })}>
            <option value="">Belum ditentukan</option>
            {teachers
              .filter((t) => t.status === 'active')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Ruangan">
          <select className="input" value={form.roomId ?? ''} onChange={(e) => setForm({ ...form, roomId: e.target.value || null })}>
            <option value="">Tanpa ruangan</option>
            {rooms
              .filter((r) => r.status === 'active')
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Topik">
          <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Contoh: kelas pengganti" />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
