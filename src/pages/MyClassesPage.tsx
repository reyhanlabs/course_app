import { Link } from 'react-router-dom';
import { useProfile } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { listClassesOfTeacherUser } from '../services/classes';
import { listLevels } from '../services/levels';
import { countStudentsInClass } from '../services/students';

export function MyClassesPage() {
  const profile = useProfile();
  const { data, loading, error, reload } = useAsync(async () => {
    const [classes, levels] = await Promise.all([listClassesOfTeacherUser(profile.id), listLevels()]);
    const counts = await Promise.all(classes.map((c) => countStudentsInClass(c.id)));
    return classes.map((c, i) => ({
      ...c,
      studentCount: counts[i],
      levelName: levels.find((l) => l.id === c.levelId)?.name ?? '-',
    }));
  }, [profile.id]);

  return (
    <>
      <PageHeader title="Kelas Saya" description="Kelas yang ditugaskan admin kepada Anda." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada kelas" description="Admin belum menugaskan kelas untuk Anda." />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link
              key={c.id}
              to={`/classes/${c.id}`}
              className="rounded-xl border border-ink-100 bg-white p-5 transition-colors hover:border-brand-100"
            >
              <p className="text-lg font-bold">{c.className}</p>
              <p className="text-sm text-ink-500">{c.levelName}</p>
              <p className="mt-4 text-sm">
                <span className="font-semibold">{c.studentCount}</span> siswa
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
