import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Field, FormError, LoadingState } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { createFirstAdmin, createFirstAdminWithGoogle, isSetupDone } from '../services/setup';
import { GoogleButton, OrDivider } from '../components/GoogleButton';
import { signInWithGoogle } from '../services/googleAuth';
import { AuthShell } from './LoginPage';

/** Halaman satu kali: membuat admin pertama langsung dari aplikasi. */
export function SetupPage() {
  const navigate = useNavigate();
  const status = useAsync(isSetupDone, []);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      if (await createFirstAdminWithGoogle(signInWithGoogle)) navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup gagal.');
    } finally {
      setGoogleBusy(false);
    }
  }

  if (status.data === null && !status.error) return <LoadingState />;
  if (status.data === true) return <Navigate to="/login" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('Kata sandi minimal 8 karakter.');
    if (form.password !== form.confirm) return setError('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    try {
      await createFirstAdmin(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup gagal.');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Buat admin pertama" subtitle="Langkah sekali saja sebelum aplikasi dipakai.">
      <p className="mb-4 text-sm text-ink-500">
        Halaman ini hanya bisa dipakai sekali. Setelah admin pertama dibuat, halaman ini tertutup dan akun lain dibuat dari menu
        Pengguna, Guru, dan Orang Tua.
      </p>
      {status.error && <FormError message={`Tidak bisa memeriksa status setup: ${status.error}`} />}
      <GoogleButton onClick={onGoogle} loading={googleBusy} label="Buat admin dengan akun Google" />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama" required>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" required>
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Kata sandi" required hint="Minimal 8 karakter">
          <input className="input" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Ulangi kata sandi" required>
          <input className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full" loading={busy}>
          Buat admin & masuk
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sudah punya akun? Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
