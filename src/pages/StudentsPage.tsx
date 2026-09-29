import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { StudentFormModal } from '../components/StudentFormModal';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchInput, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, matchesSearch } from '../lib/format';
import { studentStatusLabels } from '../lib/labels';
import { listLevels } from '../services/levels';
import { listStudents } from '../services/students';
import type { StudentStatus } from '../types';

export function StudentsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => Promise.all([listStudents(), listLevels()]), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus | ''>('active');
  const [levelId, setLevelId] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const [students, levels] = data ?? [[], []];
  const levelName = useMemo(() => new Map(levels.map((l) => [l.id, l.name])), [levels]);
  const filtered = students.filter(
    (s) =>
      (!status || s.status === status) &&
      (!levelId || s.currentLevelId === levelId) &&
      matchesSearch(search, s.fullName, s.nickname, s.school, s.currentClassName),
  );

  return (
    <>
      <PageHeader
        title="Siswa"
        description="Data siswa, level, dan kelas saat ini."
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Tambah siswa
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
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, sekolah, kelas" />
            <select className="input sm:w-44" value={status} onChange={(e) => setStatus(e.target.value as StudentStatus | '')} aria-label="Filter status">
              <option value="">Semua status</option>
              {Object.entries(studentStatusLabels).map(([v, { label }]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <select className="input sm:w-44" value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Filter level">
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
              title={students.length === 0 ? 'Belum ada siswa' : 'Tidak ada siswa yang cocok'}
              description={students.length === 0 ? 'Tambahkan siswa pertama untuk mulai mengatur kelas.' : 'Ubah kata kunci atau filter.'}
              action={
                isAdmin && students.length === 0 && (
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4" /> Tambah siswa
                  </Button>
                )
              }
            />
          ) : (
            <Table head={['Nama', 'Level', 'Kelas', 'Mulai', 'Status']}>
              {filtered.map((s) => {
                const st = studentStatusLabels[s.status];
                return (
                  <tr key={s.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link to={`/students/${s.id}`} className="flex items-center gap-3">
                        <Avatar name={s.fullName} url={s.photoUrl} />
                        <span>
                          <span className="block font-semibold text-ink-900 hover:underline">{s.fullName}</span>
                          {s.nickname && <span className="text-xs text-ink-500">{s.nickname}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">{(s.currentLevelId && levelName.get(s.currentLevelId)) || '-'}</td>
                    <td className="px-4 py-3">{s.currentClassName ?? <span className="text-ink-400">Belum ada</span>}</td>
                    <td className="px-4 py-3">{formatDate(s.startDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            Menampilkan {filtered.length} dari {students.length} siswa
          </p>
        </Panel>
      )}
      <StudentFormModal
        open={formOpen}
        student={null}
        levels={levels}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => navigate(`/students/${id}`)}
      />
    </>
  );
}
