import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { useEffect, useState } from 'react';
import { Button, FormError } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { ensureSetupMarker, isSetupDone, promoteCurrentUserToFirstAdmin } from '../services/setup';
import type { Role } from '../types';
import { useAuth } from './AuthContext';

function AccountNotice({ title, message }: { title: string; message: string }) {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">{message}</p>
        <Button variant="secondary" className="mt-6" onClick={logout}>
          Keluar
        </Button>
      </div>
    </div>
  );
}

/** Proteksi route di frontend. Keamanan data yang sebenarnya ada di firestore.rules. */
export function ProtectedLayout() {
  const { user, profile, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Memuat" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profileError) return <AccountNotice title="Profil gagal dimuat" message={profileError} />;
  if (!profile) return <NoProfile />;
  if (profile.role === 'admin' && profile.active) return <AdminLayout uid={profile.id} />;
  if (!profile.active) {
    return <AccountNotice title="Akun nonaktif" message="Akun Anda sedang dinonaktifkan. Hubungi admin kursus." />;
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) {
    return (
      <div className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center">
        <p className="font-semibold">Halaman ini tidak tersedia untuk peran Anda</p>
        <p className="mt-1 text-sm text-ink-500">Gunakan menu di samping untuk membuka halaman lain.</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Admin yang dibuat manual di Console: tutup halaman setup secara permanen. */
function AdminLayout({ uid }: { uid: string }) {
  useEffect(() => {
    ensureSetupMarker(uid);
  }, [uid]);
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/** Sudah login tapi belum punya profil. Jika belum ada admin, akun ini bisa langsung dijadikan admin. */
function NoProfile() {
  const { user, logout } = useAuth();
  const setup = useAsync(isSetupDone, []);
  const [name, setName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (setup.data === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8">
          <h1 className="text-lg font-bold">Jadikan akun ini admin?</h1>
          <p className="mt-2 text-sm text-ink-500">
            Belum ada admin di sistem. Akun <strong>{user?.email}</strong> bisa langsung dijadikan admin pertama.
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-ink-700">Nama Anda</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <FormError message={error} />
          <div className="mt-6 flex gap-2">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await promoteCurrentUserToFirstAdmin(name);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Gagal.');
                  setBusy(false);
                }
              }}
            >
              Jadikan admin
            </Button>
            <Button variant="secondary" onClick={logout}>
              Keluar
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <AccountNotice
      title="Akun belum terdaftar"
      message={`${user?.email ?? 'Akun ini'} belum terdaftar di sistem. Minta admin kursus membuatkan akun dengan email ini, lalu masuk lagi (bisa dengan Google atau kata sandi dari email undangan).`}
    />
  );
}
