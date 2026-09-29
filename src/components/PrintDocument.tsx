import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import type { InstitutionSettings } from '../types';
import { Button } from './ui';

/** Kerangka dokumen A4. Toolbar tidak ikut tercetak. */
export function PrintDocument({
  backTo,
  backLabel,
  institution,
  title,
  meta,
  children,
  stamp,
}: {
  backTo: string;
  backLabel: string;
  institution: InstitutionSettings;
  title: string;
  meta: [string, string][];
  children: ReactNode;
  stamp?: string;
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to={backTo} className="mr-auto inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Cetak
        </Button>
        <Button onClick={() => window.print()} title="Pilih tujuan 'Simpan sebagai PDF' di jendela cetak">
          <Download className="h-4 w-4" /> Unduh PDF
        </Button>
      </div>
      <p className="mb-4 text-xs text-ink-500 print:hidden">Untuk PDF: klik Unduh PDF, lalu pilih tujuan “Simpan sebagai PDF”.</p>

      <article className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white p-8 text-sm text-ink-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {stamp && (
          <span className="pointer-events-none absolute right-10 top-40 rotate-[-12deg] rounded-lg border-4 border-emerald-600 px-4 py-1 text-3xl font-bold text-emerald-600 opacity-70">
            {stamp}
          </span>
        )}
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink-900 pb-4">
          <div className="flex items-start gap-3">
            {institution.logoUrl && <img src={institution.logoUrl} alt="" className="h-16 w-16 object-contain" />}
            <div>
              <p className="text-lg font-bold">{institution.name || 'Nama lembaga belum diatur'}</p>
              {institution.address && <p className="whitespace-pre-line text-ink-700">{institution.address}</p>}
              <p className="text-ink-700">{[institution.phone, institution.whatsapp && `WA ${institution.whatsapp}`, institution.email].filter(Boolean).join(' | ')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-wide">{title}</p>
            <dl className="mt-1">
              {meta.map(([k, v]) => (
                <div key={k} className="flex justify-end gap-2">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>
        {children}
      </article>
    </>
  );
}
