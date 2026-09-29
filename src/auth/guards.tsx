import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui';
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
  if (!profile) {
    return (
      <AccountNotice
        title="Akun belum terdaftar"
        message="Akun login ini belum memiliki profil pengguna di sistem. Hubungi admin kursus untuk mengaktifkannya."
      />
    );
  }
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
