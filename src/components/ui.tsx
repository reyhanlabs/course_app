import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, Loader2, Search, X } from 'lucide-react';
import type { Tone } from '../lib/labels';
import { errorMessage } from '../lib/errors';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  ghost: 'text-ink-700 hover:bg-ink-100',
};

/** Kelas tombol untuk elemen <a> (hindari <button> di dalam <a>). */
export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
    variants[variant],
    className,
  );
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
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
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
      <div className="text-sm text-ink-700">{message}</div>
      <FormError message={error} />
    </Modal>
  );
}

const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  gray: 'bg-ink-50 text-ink-500 ring-ink-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}

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
      <span className="mb-1 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-ink-100 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <p className="font-semibold text-rose-800">Data gagal dimuat</p>
      <p className="mt-1 text-sm text-rose-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        className="input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const dim = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-9 w-9 text-xs';
  if (url) return <img src={url} alt={name} className={cn(dim, 'shrink-0 rounded-full object-cover')} />;
  return (
    <span className={cn(dim, 'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700')}>
      {initials || '?'}
    </span>
  );
}

/** Tabel responsif: di layar kecil bisa digeser horizontal. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/60 text-xs font-semibold text-ink-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="col-span-2 break-words">{value || '-'}</dd>
    </div>
  );
}
