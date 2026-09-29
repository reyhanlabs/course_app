import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useProfile } from '../auth/AuthContext';
import { Avatar, EmptyState, ErrorState, LoadingState, Panel, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { listLevels } from '../services/levels';
import { listStudentsOfParentUser } from '../services/students';
import type { Level, Student } from '../types';

interface ParentCtx {
  children: Student[];
  child: Student;
  levels: Level[];
}

const Ctx = createContext<ParentCtx | null>(null);
const KEY = 'selectedChildId';

/** Layout semua halaman portal orang tua: memuat anak-anak dan pemilih anak. */
export function ParentArea() {
  const profile = useProfile();
  const { data, error, reload } = useAsync(() => Promise.all([listStudentsOfParentUser(profile.id), listLevels()]), [profile.id]);
  const [selectedId, setSelectedId] = useState<string | null>(() => sessionStorage.getItem(KEY));
  useEffect(() => {
    if (selectedId) sessionStorage.setItem(KEY, selectedId);
  }, [selectedId]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [children, levels] = data;
  if (children.length === 0) {
    return (
      <Panel>
        <EmptyState title="Belum ada data anak" description="Data anak Anda belum dihubungkan ke akun ini. Hubungi admin kursus." />
      </Panel>
    );
  }
  const child = children.find((c) => c.id === selectedId) ?? children[0];

  return (
    <Ctx.Provider value={{ children, child, levels }}>
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden" role="tablist" aria-label="Pilih anak">
        {children.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === child.id}
            onClick={() => setSelectedId(c.id)}
            className={cn(
              'flex items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-medium',
              c.id === child.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
            )}
          >
            <Avatar name={c.fullName} url={c.photoUrl} />
            {c.nickname || c.fullName}
          </button>
        ))}
      </div>
      <Outlet />
    </Ctx.Provider>
  );
}

export function useChild(): ParentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChild harus dipakai di dalam ParentArea');
  return ctx;
}
