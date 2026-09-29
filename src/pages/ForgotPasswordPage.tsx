import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button, Field, FormError } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { auth } from '../lib/firebase';
import { AuthShell } from './LoginPage';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Lupa kata sandi" subtitle="Kami kirim tautan untuk membuat kata sandi baru.">
      {sent ? (
        <p className="text-sm text-ink-700">
          Jika email <strong>{email}</strong> terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Periksa juga folder spam.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" className="h-11 w-full" loading={busy}>
            Kirim tautan
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </AuthShell>
  );
}
