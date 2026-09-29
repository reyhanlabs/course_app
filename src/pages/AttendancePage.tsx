import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/AuthContext';
import { ClassSelect } from '../components/ClassSelect';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Panel, Table } from '../components/ui';
import { useAccessibleClasses } from '../hooks/useAccessibleClasses';
import { useAsync } from '../hooks/useAsync';
import { currentMonth, formatDate, formatMonth, monthRange, percent, todayISO } from '../lib/format';
import { attendanceStatusLabels, sessionStatusLabels } from '../lib/labels';
import { isPresent, listAttendanceOfClass } from '../services/attendance';
import { listSessionsInRange } from '../services/sessions';
import type { Attendance, Session } from '../types';

const cellTone: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800',
  late: 'bg-amber-100 text-amber-800',
  excused: 'bg-brand-100 text-brand-700',
  absent: 'bg-rose-100 text-rose-800',
};

export function AttendancePage() {
  const profile = useProfile();
  const classesState = useAccessibleClasses();
  const classes = classesState.data ?? [];
  const today = todayISO();

  const todayState = useAsync(async () => {
    if (!classesState.data) return [] as Session[];
    const ids = profile.role === 'teacher' ? classesState.data.map((c) => c.id) : null;
    return listSessionsInRange(today, today, ids);
  }, [classesState.data]);

  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const recap = useAsync(async () => {
    if (!classId) return null;
    const { from, to } = monthRange(month);
    const [sessions, attendance] = await Promise.all([
      listSessionsInRange(from, to, [classId]),
      listAttendanceOfClass(classId, from, to),
    ]);
    return { sessions: sessions.filter((s) => s.status !== 'cancelled'), attendance };
  }, [classId, month]);

  const matrix = useMemo(() => buildMatrix(recap.data?.sessions ?? [], recap.data?.attendance ?? []), [recap.data]);
  const className = new Map(classes.map((c) => [c.id, c.className]));

  if (classesState.error) return <ErrorState message={classesState.error} onRetry={classesState.reload} />;
  if (!classesState.data) return <LoadingState />;

  return (
    <>
      <PageHeader title="Absensi" description="Absensi diisi per sesi. Halaman ini merangkum kehadiran harian dan bulanan." />

      <Panel title={`Hari ini, ${formatDate(today)}`} className="mb-6">
        {!todayState.data ? (
          <LoadingState />
        ) : todayState.data.length === 0 ? (
          <EmptyState title="Tidak ada sesi hari ini" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {todayState.data.map((s) => {
              const st = sessionStatusLabels[s.status];
              return (
                <li key={s.id}>
                  <Link to={`/sessions/${s.id}`} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-ink-50">
                    <span className="w-24 font-semibold">
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className="flex-1">{className.get(s.classId) ?? 'Kelas'}</span>
                    <Badge tone={st.tone}>{s.status === 'scheduled' ? 'Belum diabsen' : st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Rekap bulanan"
        actions={
          <div className="flex flex-wrap gap-2">
            <ClassSelect classes={classes} value={classId} onChange={setClassId} />
            <input type="month" className="input w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Bulan" />
          </div>
        }
      >
        {!classId ? (
          <EmptyState title="Pilih kelas" />
        ) : recap.error ? (
          <div className="p-4">
            <ErrorState message={recap.error} onRetry={recap.reload} />
          </div>
        ) : !recap.data || recap.loading ? (
          <LoadingState />
        ) : matrix.sessions.length === 0 ? (
          <EmptyState title={`Tidak ada sesi di ${formatMonth(month)}`} />
        ) : (
          <>
            <Table head={['Siswa', ...matrix.sessions.map((s) => formatDate(s.date).slice(0, 5)), 'Hadir', '%']}>
              {matrix.students.map((row) => (
                <tr key={row.studentId}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{row.studentName}</td>
                  {matrix.sessions.map((s) => {
                    const a = row.bySession.get(s.id);
                    return (
                      <td key={s.id} className="px-1 py-2 text-center">
                        {a ? (
                          <span
                            title={attendanceStatusLabels[a.status].label}
                            className={`inline-block w-7 rounded py-0.5 text-xs font-bold ${cellTone[a.status]}`}
                          >
                            {attendanceStatusLabels[a.status].short}
                          </span>
                        ) : (
                          <span className="text-ink-300" title="Belum diabsen / belum terdaftar">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2">
                    {row.present}/{row.recorded}
                  </td>
                  <td className="px-4 py-2 font-semibold">{percent(row.present, row.recorded)}</td>
                </tr>
              ))}
            </Table>
            <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
              H = hadir, T = terlambat (dihitung hadir), I = izin, A = tidak hadir. {matrix.pending} sesi belum diabsen.
            </p>
          </>
        )}
      </Panel>
    </>
  );
}

function buildMatrix(sessions: Session[], attendance: Attendance[]) {
  const students = new Map<string, { studentId: string; studentName: string; bySession: Map<string, Attendance>; present: number; recorded: number }>();
  const validSessions = new Set(sessions.map((s) => s.id));
  for (const a of attendance) {
    if (!validSessions.has(a.sessionId)) continue;
    const row = students.get(a.studentId) ?? { studentId: a.studentId, studentName: a.studentName, bySession: new Map(), present: 0, recorded: 0 };
    row.bySession.set(a.sessionId, a);
    row.recorded += 1;
    if (isPresent(a.status)) row.present += 1;
    students.set(a.studentId, row);
  }
  return {
    sessions,
    students: [...students.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, 'id')),
    pending: sessions.filter((s) => s.status === 'scheduled' && s.date <= todayISO()).length,
  };
}
