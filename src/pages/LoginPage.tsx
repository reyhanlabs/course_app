import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, FormError } from '../components/ui';
import { appName } from '../lib/env';
import { errorMessage } from '../lib/errors';
import { auth } from '../lib/firebase';
import { useAsync } from '../hooks/useAsync';
import { isSetupDone } from '../services/setup';
import { GoogleButton, OrDivider } from '../components/GoogleButton';
import { signInWithGoogle } from '../services/googleAuth';

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-900 font-bold text-white">Aa</span>
          <span className="text-lg font-bold">{appName}</span>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h1 className="mb-5 text-xl font-bold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = useAsync(isSetupDone, []);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (!loading && user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Masuk">
      {setup.data === false && (
        <Link
          to="/setup"
          className="mb-5 block rounded-lg border border-marker bg-marker-soft/60 px-4 py-3 text-sm hover:bg-marker-soft"
        >
          <span className="block font-semibold">Belum ada admin</span>
          Klik di sini untuk membuat akun admin pertama.
        </Link>
      )}
      {setup.error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="block font-semibold">Database belum siap</span>
          Aplikasi belum bisa membaca Firestore. Pastikan database Firestore sudah dibuat dan rules sudah dipasang (lihat README
          langkah 3), lalu muat ulang halaman ini.
        </div>
      )}
      <GoogleButton onClick={onGoogle} loading={googleBusy} />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Kata sandi">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" className="w-full" loading={busy}>
          Masuk
        </Button>
        <p className="flex justify-between text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Lupa kata sandi?
          </Link>
          {setup.data !== true && (
            <Link to="/setup" className="font-medium text-brand-600 hover:underline">
              Buat admin pertama
            </Link>
          )}
        </p>
      </form>
    </AuthShell>
  );
}
