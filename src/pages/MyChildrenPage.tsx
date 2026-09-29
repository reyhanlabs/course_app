import { useState } from 'react';
import { useProfile } from '../auth/AuthContext';
import { ChildCard } from '../components/ChildCard';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { listLevels } from '../services/levels';
import { listStudentsOfParentUser } from '../services/students';

export function MyChildrenPage() {
  const profile = useProfile();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([listStudentsOfParentUser(profile.id), listLevels()]),
    [profile.id],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || loading) return <LoadingState />;
  const [children, levels] = data;
  const selected = children.find((c) => c.id === selectedId) ?? children[0];

  return (
    <>
      <PageHeader title="Anak Saya" />
      {!selected ? (
        <Panel>
          <EmptyState title="Belum ada data anak" description="Hubungi admin kursus untuk menghubungkan data anak ke akun Anda." />
        </Panel>
      ) : (
        <>
          {children.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Pilih anak">
              {children.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={c.id === selected.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium',
                    c.id === selected.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
                  )}
                >
                  {c.nickname || c.fullName}
                </button>
              ))}
            </div>
          )}
          <ChildCard student={selected} levels={levels} />
          <Panel className="mt-4">
            <p className="px-4 py-4 text-sm text-ink-500">
              Jadwal, absensi, materi, PR, perkembangan belajar, dan tagihan akan tampil di halaman ini setelah modul-modulnya selesai
              (Fase 2–4).
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
