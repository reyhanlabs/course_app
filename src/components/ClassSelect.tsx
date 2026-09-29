import type { CourseClass } from '../types';

export function ClassSelect({
  classes,
  value,
  onChange,
  allowAll,
  className = 'input sm:w-56',
}: {
  classes: CourseClass[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
  className?: string;
}) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Pilih kelas">
      {allowAll ? <option value="">Semua kelas</option> : <option value="">Pilih kelas</option>}
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.className}
          {c.status === 'inactive' ? ' (nonaktif)' : ''}
        </option>
      ))}
    </select>
  );
}
