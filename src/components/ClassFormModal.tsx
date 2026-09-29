import { useEffect, useState, type FormEvent } from 'react';
import type { ClassInput, CourseClass, Level, Teacher } from '../types';
import { errorMessage } from '../lib/errors';
import { saveClass } from '../services/classes';
import { Button, Field, FormError, Modal } from './ui';

export function ClassFormModal({
  open,
  courseClass,
  levels,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean;
  courseClass: CourseClass | null;
  levels: Level[];
  teachers: Teacher[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClassInput>({ className: '', levelId: '', teacherId: null, capacity: 10, status: 'active' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      courseClass
        ? {
            className: courseClass.className,
            levelId: courseClass.levelId,
            teacherId: courseClass.teacherId,
            capacity: courseClass.capacity,
            status: courseClass.status,
          }
        : { className: '', levelId: '', teacherId: null, capacity: 10, status: 'active' },
    );
  }, [open, courseClass]);

  const set = <K extends keyof ClassInput>(key: K, value: ClassInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveClass(courseClass?.id ?? null, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedTeacher = teachers.find((t) => t.id === form.teacherId);

  return (
    <Modal
      open={open}
      title={courseClass ? 'Ubah kelas' : 'Tambah kelas'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="class-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama kelas" required hint="Contoh: Grade 1 A">
          <input className="input" required value={form.className} onChange={(e) => set('className', e.target.value)} />
        </Field>
        <Field label="Level" required>
          <select className="input" required value={form.levelId} onChange={(e) => set('levelId', e.target.value)}>
            <option value="">Pilih level</option>
            {levels
              .filter((l) => l.active || l.id === form.levelId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
        <Field
          label="Guru"
          hint={selectedTeacher && !selectedTeacher.userId ? 'Guru ini belum punya akun, jadi belum bisa membuka kelas di aplikasi.' : undefined}
        >
          <select className="input" value={form.teacherId ?? ''} onChange={(e) => set('teacherId', e.target.value || null)}>
            <option value="">Belum ditentukan</option>
            {teachers
              .filter((t) => t.status === 'active' || t.id === form.teacherId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kapasitas" hint="0 = tanpa batas">
            <input
              className="input"
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => set('capacity', Number(e.target.value))}
            />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as ClassInput['status'])}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-ink-500">Ruangan dan jadwal kelas diatur di Fase 2 (modul Ruangan &amp; Jadwal).</p>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
