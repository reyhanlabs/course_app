/** Input nominal Rupiah: tampil dengan pemisah ribuan, nilai tetap integer. */
export function MoneyInput({
  value,
  onChange,
  id,
  required,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">Rp</span>
      <input
        id={id}
        className="input pl-9 text-right"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        value={value ? value.toLocaleString('id-ID') : ''}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
    </div>
  );
}
