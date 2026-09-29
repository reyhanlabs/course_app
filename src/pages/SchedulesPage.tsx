import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { ClassSelect } from '../components/ClassSelect';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { dayLabels } from '../lib/labels';
import { listAccessibleClasses } from '../services/scope';
import { listRooms } from '../services/rooms';
import { listSchedules, listSchedulesOfClasses, saveSchedule } from '../services/schedules';
import { listTeachers } from '../services/teachers';
import { getAcademicSettings } from '../services/settings';
import { addMinutes } from '../lib/format';
import type { CourseClass, DayOfWeek, Room, Schedule, ScheduleInput, Teacher } from '../types';

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

export function SchedulesPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';
  const { data, loading, error, reload } = useAsync(async () => {
    const classes = await listAccessibleClasses(profile);
    const [schedules, rooms, teachers, academic] = await Promise.all([
      isTeacher ? listSchedulesOfClasses(classes.map((c) => c.id)) : listSchedules(),
      listRooms(),
      isTeacher ? Promise.resolve([] as Teacher[]) : listTeachers(),
      getAcademicSettings(),
    ]);
    return { classes, schedules, rooms, teachers, duration: academic.defaultClassDuration };
  }, [profile.id]);
  const [classId, setClassId] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Schedule | null | 'new'>(null);

  const lookups = useMemo(() => {
    const d = data ?? { classes: [], rooms: [], teachers: [] as Teacher[] };
    return {
      className: new Map(d.classes.map((c) => [c.id, c.className])),
      roomName: new Map(d.rooms.map((r) => [r.id, r.name])),
      teacherName: new Map(d.teachers.map((t) => [t.id, t.fullName])),
    };
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const visible = data.schedules.filter((s) => (!classId || s.classId === classId) && (showInactive || s.status === 'active'));

  return (
    <>
      <PageHeader
        title={isTeacher ? 'Jadwal Saya' : 'Jadwal'}
        description="Jadwal adalah rencana mingguan. Pertemuan nyata per tanggal dibuat di menu Sesi."
        actions={
          isAdmin && (
            <Button onClick={() => setEditing('new')} disabled={data.classes.length === 0}>
              <Plus className="h-4 w-4" /> Tambah jadwal
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ClassSelect classes={data.classes} value={classId} onChange={setClassId} allowAll />
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan jadwal nonaktif
          </label>
        )}
        {loading && <span className="text-xs text-ink-500">Memperbarui…</span>}
      </div>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada jadwal" description={isAdmin ? 'Tambahkan jadwal mingguan untuk setiap kelas.' : undefined} />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DAYS.filter((d) => visible.some((s) => s.dayOfWeek === d)).map((day) => (
            <Panel key={day} title={dayLabels[day]}>
              <ul className="divide-y divide-ink-100">
                {visible
                  .filter((s) => s.dayOfWeek === day)
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setEditing(s)}
                        className={cn('w-full px-4 py-3 text-left text-sm', isAdmin && 'hover:bg-ink-50', s.status === 'inactive' && 'opacity-50')}
                      >
                        <p className="font-semibold">
                          {s.startTime}–{s.endTime} · {lookups.className.get(s.classId) ?? 'Kelas'}
                        </p>
                        <p className="text-ink-500">
                          {isTeacher ? 'Anda' : (s.teacherId && lookups.teacherName.get(s.teacherId)) || 'Guru belum ditentukan'}
                          {s.roomId ? `, ${lookups.roomName.get(s.roomId) ?? 'ruangan'}` : ''}
                        </p>
                        {s.status === 'inactive' && <Badge tone="gray">Nonaktif</Badge>}
                      </button>
                    </li>
                  ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {isAdmin && (
        <ScheduleFormModal
          open={editing !== null}
          schedule={editing === 'new' ? null : editing}
          classes={data.classes}
          rooms={data.rooms}
          teachers={data.teachers}
          duration={data.duration}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}

function ScheduleFormModal({
  open,
  schedule,
  classes,
  rooms,
  teachers,
  duration,
  onClose,
  onSaved,
}: {
  open: boolean;
  schedule: Schedule | null;
  classes: CourseClass[];
  rooms: Room[];
  teachers: Teacher[];
  duration: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank: ScheduleInput = { classId: '', teacherId: null, roomId: null, dayOfWeek: 1, startTime: '15:00', endTime: addMinutes('15:00', duration), status: 'active' };
  const [form, setForm] = useState<ScheduleInput>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      schedule
        ? {
            classId: schedule.classId,
            teacherId: schedule.teacherId,
            roomId: schedule.roomId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            status: schedule.status,
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule]);

  function chooseClass(id: string) {
    const c = classes.find((x) => x.id === id);
    // Guru default mengikuti guru kelas, tetap bisa diganti (guru pengganti).
    setForm((f) => ({ ...f, classId: id, teacherId: c?.teacherId ?? f.teacherId }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveSchedule(schedule?.id ?? null, form);
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
      title={schedule ? 'Ubah jadwal' : 'Tambah jadwal'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="schedule-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Kelas" required>
          <select className="input" required value={form.classId} onChange={(e) => chooseClass(e.target.value)} disabled={Boolean(schedule)}>
            <option value="">Pilih kelas</option>
            {classes
              .filter((c) => c.status === 'active' || c.id === form.classId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Hari" required>
            <select className="input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) as DayOfWeek })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {dayLabels[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mulai" required>
            <input
              className="input"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value, ...(schedule || !e.target.value ? {} : { endTime: addMinutes(e.target.value, duration) }) })}
            />
          </Field>
          <Field label="Selesai" required>
            <input className="input" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Guru">
          <select className="input" value={form.teacherId ?? ''} onChange={(e) => setForm({ ...form, teacherId: e.target.value || null })}>
            <option value="">Belum ditentukan</option>
            {teachers
              .filter((t) => t.status === 'active' || t.id === form.teacherId)
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
              .filter((r) => r.status === 'active' || r.id === form.roomId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Status" hint="Jadwal nonaktif tidak dipakai untuk membuat sesi baru. Sesi yang sudah ada tidak berubah.">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ScheduleInput['status'] })}>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak aktif</option>
          </select>
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
