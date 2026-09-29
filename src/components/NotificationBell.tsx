import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { formatDate } from '../lib/format';
import { markRead, subscribeNotifications } from '../services/notifications';
import type { AppNotification } from '../types';
import { cn } from './ui';

export function NotificationBell() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeNotifications(profile, setItems), [profile.id, profile.role]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-ink-700 hover:bg-ink-100"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <span className="text-sm font-semibold">Notifikasi</span>
            {unread > 0 && (
              <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => markRead(items).catch(() => undefined)}>
                Tandai semua dibaca
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">Belum ada notifikasi.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn('block w-full px-4 py-3 text-left text-sm hover:bg-ink-50', !n.read && 'bg-brand-50/50')}
                    onClick={() => {
                      markRead([n]).catch(() => undefined);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className={cn('block', !n.read && 'font-semibold')}>{n.title}</span>
                    {n.body && <span className="block text-ink-500">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-ink-400">{formatDate(n.createdAt ?? null)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
