import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, FormError } from '../components/ui';
import { appName } from '../lib/env';
import { ClipboardCheck, HeartHandshake, Wallet } from 'lucide-react';
import { errorMessage } from '../lib/errors';
import { auth } from '../lib/firebase';
import { useAsync } from '../hooks/useAsync';
import { isSetupDone } from '../services/setup';
import { GoogleButton, OrDivider } from '../components/GoogleButton';
import { signInWithGoogle } from '../services/googleAuth';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Panel merek: halaman buku tulis */}
      <aside className="notebook relative hidden flex-col justify-between overflow-hidden bg-ink-900 py-12 pl-20 pr-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-marker font-extrabold text-ink-900">Aa</span>
          <span className="text-lg font-bold">{appName}</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-[40px] font-extrabold leading-[1.1] tracking-tight">Kelas tertata, orang tua tenang.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-300">
            Jadwal, absensi, perkembangan belajar, dan tagihan kursus dalam satu tempat.
          </p>
          <ul className="mt-8 space-y-3.5 text-sm text-ink-200">
            {[
              [ClipboardCheck, 'Guru mengisi absensi langsung dari HP.'],
              [Wallet, 'Tagihan per sesi dihitung otomatis dari kehadiran.'],
              [HeartHandshake, 'Orang tua memantau anak dan mengirim bukti bayar.'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Wallet;
              return (
                <li key={text as string} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-marker">
                    <I className="h-4 w-4" />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-ink-400">Data Anda tersimpan aman dan hanya bisa dibuka sesuai peran.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px] animate-pop">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-marker font-extrabold text-ink-900">Aa</span>
            <span className="text-lg font-bold">{appName}</span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
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
    <AuthShell title="Selamat datang" subtitle="Masuk untuk melanjutkan ke akun Anda.">
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
        <Button type="submit" className="h-11 w-full" loading={busy}>
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
