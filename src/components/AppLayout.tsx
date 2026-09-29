import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useProfile, useAuth } from '../auth/AuthContext';
import { MENUS } from '../auth/menus';
import { appName } from '../lib/env';
import { roleLabels } from '../lib/labels';
import { Button, cn } from './ui';
import { NotificationBell } from './NotificationBell';

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-ink-100 px-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 text-sm font-bold text-white">Aa</span>
      <span className="font-bold leading-tight">{appName}</span>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menu = MENUS[profile.role];

  const location = useLocation();
  // Item menu dengan query (?group=…) aktif hanya bila query-nya sama persis.
  const active = (to: string, navActive: boolean) =>
    to.includes('?') ? location.pathname + location.search === to : navActive && !menu.some((sec) => sec.items.some((i) => i.to.includes('?') && location.pathname + location.search === i.to));

  const nav = (
    <nav className="space-y-4 p-3" aria-label="Menu utama">
      {menu.map((section, i) => (
        <div key={i} className="space-y-1">
          {section.title && <p className="px-3 pb-1 text-xs font-semibold text-ink-400">{section.title}</p>}
          {section.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active(item.to, isActive) ? 'text-ink-900' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-4 w-4', active(item.to, isActive) && 'text-brand-600')} aria-hidden />
              <span className={cn(active(item.to, isActive) && 'marker-active font-semibold')}>{item.label}</span>
            </>
          )}
        </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="hidden print:hidden border-r border-ink-100 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <Brand />
            <div className="flex-1 overflow-y-auto">{nav}</div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60 print:pl-0">
        <header className="sticky top-0 z-30 flex print:hidden h-16 items-center gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-2 text-ink-700 hover:bg-ink-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <div className="text-right text-sm leading-tight">
            <div className="font-semibold">{profile.displayName}</div>
            <div className="text-xs text-ink-500">{roleLabels[profile.role]}</div>
          </div>
          <Button variant="ghost" onClick={logout} aria-label="Keluar">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
