import { Link } from 'react-router-dom';
import { Pin } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../lib/format';
import { listAnnouncementsFor } from '../services/announcements';
import { Panel } from './ui';

/** 3 pengumuman terbaru untuk dashboard guru/orang tua. Tidak tampil jika kosong. */
export function LatestAnnouncements() {
  const profile = useProfile();
  const { data } = useAsync(() => listAnnouncementsFor(profile), [profile.id]);
  if (!data || data.length === 0) return null;
  return (
    <Panel
      title="Pengumuman"
      actions={
        <Link to="/announcements" className="text-sm font-medium text-brand-600 hover:underline">
          Lihat semua
        </Link>
      }
    >
      <ul className="divide-y divide-ink-100">
        {data.slice(0, 3).map((a) => (
          <li key={a.id} className="px-4 py-3 text-sm">
            <p className="flex items-center gap-1 font-semibold">
              {a.pinned && <Pin className="h-3.5 w-3.5 text-marker" />}
              {a.title}
            </p>
            <p className="line-clamp-2 text-ink-700">{a.body}</p>
            <p className="text-xs text-ink-400">{formatDate(a.publishedAt ?? a.createdAt ?? null)}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
