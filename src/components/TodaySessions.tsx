import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { todayISO } from '../lib/format';
import { sessionStatusLabels } from '../lib/labels';
import { listAttendanceOfSession } from '../services/attendance';
import { listSessionsInRange } from '../services/sessions';
import type { CourseClass } from '../types';
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from './ui';

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
        <EmptyState title="Tidak ada sesi hari ini" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.map((s) => {
            const st = sessionStatusLabels[s.status];
            return (
              <li key={s.id}>
                <Link to={`/sessions/${s.id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm hover:bg-ink-50">
                  <span className="w-24 font-semibold">
                    {s.startTime}–{s.endTime}
                  </span>
                  <span className="flex-1">{className.get(s.classId) ?? 'Kelas'}</span>
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
