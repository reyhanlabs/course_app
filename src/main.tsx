import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { missingEnv } from './lib/env';

// App dimuat setelah konfigurasi dicek, supaya Firebase tidak diinisialisasi dengan config kosong.
const App = lazy(() => import('./App'));

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-lg rounded-2xl border border-rose-200 bg-white p-8">
        <h1 className="text-lg font-bold">Konfigurasi Firebase belum lengkap</h1>
        <p className="mt-2 text-sm text-ink-500">
          Isi variabel berikut di <code>.env.local</code> (lokal) atau Environment Variables di Vercel, lalu jalankan ulang:
        </p>
        <ul className="mt-3 list-inside list-disc text-sm">
          {missingEnv.map((k) => (
            <li key={k}>
              <code>{k}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {missingEnv.length > 0 ? (
      <MissingConfig />
    ) : (
      <Suspense fallback={null}>
        <App />
      </Suspense>
    )}
  </StrictMode>,
);
