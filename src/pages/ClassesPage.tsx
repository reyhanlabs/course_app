import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { ClassFormModal } from '../components/ClassFormModal';
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { matchesSearch } from '../lib/format';
import { activeStatusLabels } from '../lib/labels';
import { listClasses } from '../services/classes';
import { listLevels } from '../services/levels';
import { listStudents } from '../services/students';
import { listTeachers } from '../services/teachers';

export function ClassesPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([listClasses(), listLevels(), listTeachers(), listStudents()]),
    [],
  );
  const [search, setSearch] = useState('');
  const [levelId, setLevelId] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const [classes, levels, teachers, students] = data ?? [[], [], [], []];
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) if (s.currentClassId) map.set(s.currentClassId, (map.get(s.currentClassId) ?? 0) + 1);
    return map;
  }, [students]);
  const levelOrder = new Map(levels.map((l) => [l.id, l.order]));
  const filtered = classes
    .filter((c) => (!levelId || c.levelId === levelId) && matchesSearch(search, c.className))
    .sort((a, b) => (levelOrder.get(a.levelId) ?? 99) - (levelOrder.get(b.levelId) ?? 99) || a.className.localeCompare(b.className));

  return (
    <>
      <PageHeader
        title="Kelas"
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)} disabled={levels.length === 0}>
              <Plus className="h-4 w-4" /> Tambah kelas
            </Button>
          )
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama kelas" />
            <select className="input sm:w-48" value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Filter level">
              <option value="">Semua level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title={classes.length === 0 ? 'Belum ada kelas' : 'Tidak ada kelas yang cocok'}
              description={
                levels.length === 0 ? 'Buat level terlebih dahulu di menu Level.' : classes.length === 0 ? 'Tambahkan kelas pertama.' : undefined
              }
            />
          ) : (
            <Table head={['Kelas', 'Level', 'Guru', 'Siswa', 'Status']}>
              {filtered.map((c) => {
                const st = activeStatusLabels[c.status];
                const count = counts.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link to={`/classes/${c.id}`} className="font-semibold text-ink-900 hover:underline">
                        {c.className}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{levels.find((l) => l.id === c.levelId)?.name ?? '-'}</td>
                    <td className="px-4 py-3">{teachers.find((t) => t.id === c.teacherId)?.fullName ?? <span className="text-ink-400">Belum ada</span>}</td>
                    <td className="px-4 py-3">
                      {count}
                      {c.capacity > 0 && <span className="text-ink-400"> / {c.capacity}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      )}
      <ClassFormModal
        open={formOpen}
        courseClass={null}
        levels={levels}
        teachers={teachers}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
    </>
  );
}
