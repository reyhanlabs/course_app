import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { todayISO } from '../lib/format';
import { sessionStatusLabels } from '../lib/labels';
import { listAttendanceOfSession } from '../services/attendance';
import { listSessionsInRange } from '../services/sessions';
import type { CourseClass } from '../types';
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from './ui';
import { CalendarDays } from 'lucide-react';

/** Sesi hari ini beserta jumlah hadir (dipakai di dashboard admin, owner, guru). */
export function TodaySessions({ classes, onlyTheseClasses }: { classes: CourseClass[]; onlyTheseClasses: boolean }) {
  const today = todayISO();
  const { data, error, reload } = useAsync(async () => {
    const sessions = await listSessionsInRange(today, today, onlyTheseClasses ? classes.map((c) => c.id) : null);
    const attendance = await Promise.all(sessions.map((s) => (s.status === 'completed' ? listAttendanceOfSession(s) : Promise.resolve([]))));
    return sessions.map((s, i) => ({
      ...s,
      present: attendance[i].filter((a) => a.status === 'present' || a.status === 'late').length,
      recorded: attendance[i].length,
    }));
  }, [classes, onlyTheseClasses]);
  const className = new Map(classes.map((c) => [c.id, c.className]));

  return (
    <Panel title="Sesi hari ini">
      {error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Tidak ada sesi hari ini" description="Sesi dibuat dari jadwal di menu Sesi." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.map((s) => {
            const st = sessionStatusLabels[s.status];
            return (
              <li key={s.id}>
                <Link to={`/sessions/${s.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3.5 text-sm hover:bg-ink-50/70">
                  <span className="flex w-16 flex-col items-center rounded-xl bg-ink-50 py-1.5 leading-tight">
                    <span className="font-bold text-ink-900">{s.startTime}</span>
                    <span className="text-[11px] text-ink-500">{s.endTime}</span>
                  </span>
                  <span className="flex-1 font-semibold">{className.get(s.classId) ?? 'Kelas'}</span>
                  {s.status === 'completed' && (
                    <span className="text-ink-500">
                      Hadir {s.present}/{s.recorded}
                    </span>
                  )}
                  <Badge tone={s.status === 'scheduled' ? 'amber' : st.tone}>{s.status === 'scheduled' ? 'Belum diabsen' : st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
