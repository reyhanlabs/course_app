import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth, useProfile } from '../auth/AuthContext';
import { MENUS, type MenuItem } from '../auth/menus';
import { appName } from '../lib/env';
import { roleLabels } from '../lib/labels';
import { NotificationBell } from './NotificationBell';
import { Avatar, cn } from './ui';

function BrandMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-marker text-sm font-extrabold text-ink-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">
      Aa
    </span>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menu = MENUS[profile.role];
  const here = location.pathname + location.search;
  const allItems = menu.flatMap((s) => s.items);

  // Item dengan query (?group=…) aktif hanya bila query sama persis.
  const queryMatch = allItems.find((i) => i.to.includes('?') && here === i.to);
  const isActive = (item: MenuItem, navActive: boolean) => (item.to.includes('?') ? here === item.to : navActive && !queryMatch);
  const current =
    queryMatch ??
    [...allItems]
      .filter((i) => !i.to.includes('?'))
      .sort((a, b) => b.to.length - a.to.length)
      .find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)));

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 text-ink-300">
      <div className="notebook flex h-16 items-center gap-3 border-b border-white/5 pl-[60px] pr-4">
        <BrandMark />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{appName}</p>
          <p className="text-xs text-ink-400">Manajemen kursus</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Menu utama">
        {menu.map((section, i) => (
          <div key={i}>
            {section.title && <p className="mb-1.5 px-3 text-xs font-semibold text-ink-400">{section.title}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}>
                  {({ isActive: navActive }) => {
                    const active = isActive(item, navActive);
                    return (
                      <span
                        className={cn(
                          'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-marker font-semibold text-ink-900' : 'hover:bg-white/5 hover:text-white',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-ink-900' : 'text-ink-400')} aria-hidden />
                        {item.label}
                      </span>
                    );
                  }}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <Avatar name={profile.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profile.displayName}</p>
            <p className="text-xs text-ink-400">{roleLabels[profile.role]}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Keluar" title="Keluar">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="hidden print:hidden lg:fixed lg:inset-y-0 lg:block lg:w-64">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {sidebar}
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-300 hover:bg-white/10" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur-md print:hidden sm:px-8">
          <button className="-ml-1 rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink-900">{current?.label ?? appName}</p>
          </div>
          <NotificationBell />
          <div className="hidden h-6 w-px bg-ink-100 sm:block" />
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar name={profile.displayName} size="sm" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{profile.displayName}</p>
              <p className="text-xs text-ink-500">{roleLabels[profile.role]}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
