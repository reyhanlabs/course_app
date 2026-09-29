import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox, Loader2, RotateCw, Search, X, type LucideIcon } from 'lucide-react';
import type { Tone } from '../lib/labels';
import { errorMessage } from '../lib/errors';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Tombol

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(23,32,64,0.2)] hover:bg-brand-700',
  secondary: 'bg-white text-ink-800 border border-ink-200 shadow-[0_1px_2px_rgba(23,32,64,0.05)] hover:bg-ink-50 hover:border-ink-300',
  danger: 'bg-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-rose-700',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
};
const base =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

/** Kelas tombol untuk elemen <a>/<Link> (hindari <button> di dalam <a>). */
export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} className={cn(base, variants[variant], className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Modal

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-ink-950/50 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl bg-white shadow-[0_24px_64px_-12px_rgba(16,23,47,0.35)] sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Tutup" className="-mr-2 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-ink-100 bg-ink-50/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-700">{message}</div>
      <FormError message={error} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Label & status

const tones: Record<Tone, { chip: string; dot: string }> = {
  green: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15', dot: 'bg-emerald-500' },
  gray: { chip: 'bg-ink-100/70 text-ink-700 ring-ink-500/15', dot: 'bg-ink-400' },
  blue: { chip: 'bg-brand-50 text-brand-700 ring-brand-600/15', dot: 'bg-brand-500' },
  amber: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  red: { chip: 'bg-rose-50 text-rose-700 ring-rose-600/15', dot: 'bg-rose-500' },
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone].chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tones[tone].dot)} aria-hidden />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Form

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-800">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-ink-500">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input type="search" className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

// ---------------------------------------------------------------- Tata letak halaman

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(23,32,64,0.04)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          {title && <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const statTones: Record<Tone, string> = {
  blue: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-marker-soft text-amber-700',
  red: 'bg-rose-50 text-rose-600',
  gray: 'bg-ink-100 text-ink-600',
};

/** Kartu angka ringkasan dengan ikon. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'blue',
  to,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  to?: string;
  danger?: boolean;
}) {
  const body = (
    <div className="flex items-start gap-4">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', statTones[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <p className={cn('mt-0.5 break-words text-2xl font-bold leading-tight tracking-tight', danger ? 'text-rose-700' : 'text-ink-900')}>{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
  const cls = 'block rounded-2xl border border-ink-100 bg-white p-5 shadow-[0_1px_2px_rgba(23,32,64,0.04)]';
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:border-brand-200')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------------------------------------------------------------- Keadaan

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="notebook-light flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-100 bg-ink-50 text-ink-400">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 font-bold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Kerangka pemuatan (lebih tenang daripada spinner). */
export function LoadingState({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="space-y-3 py-6" role="status" aria-label={label}>
      <div className="skeleton h-5 w-1/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-11/12" />
      <div className="skeleton h-4 w-4/5" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-4 font-bold text-rose-900">Data gagal dimuat</p>
      <p className="mt-1 max-w-md text-sm text-rose-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RotateCw className="h-4 w-4" /> Coba lagi
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Avatar

const avatarPalette = [
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-800',
  'bg-marker-soft text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-800',
];

export function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const dim = size === 'lg' ? 'h-20 w-20 text-xl' : size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs';
  if (url) return <img src={url} alt={name} className={cn(dim, 'shrink-0 rounded-full object-cover ring-2 ring-white')} />;
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span className={cn(dim, 'inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white', avatarPalette[hash % avatarPalette.length])}>
      {initials || '?'}
    </span>
  );
}

// ---------------------------------------------------------------- Tabel

/** Tabel responsif: di layar kecil bisa digeser horizontal. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-ink-50/80 text-xs font-semibold text-ink-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b border-ink-100 px-4 py-3 first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 [&>tr]:transition-colors [&>tr:hover]:bg-ink-50/70 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="col-span-2 break-words font-medium text-ink-900">{value || '-'}</dd>
    </div>
  );
}
