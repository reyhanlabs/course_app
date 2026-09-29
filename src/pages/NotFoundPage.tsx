import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center">
      <p className="font-semibold">Halaman tidak ditemukan</p>
      <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
        Kembali ke dashboard
      </Link>
    </div>
  );
}
