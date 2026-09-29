import { useEffect, useState, type FormEvent } from 'react';
import type { CourseClass, Level } from '../types';
import { errorMessage } from '../lib/errors';
import { todayISO } from '../lib/format';
import { changeStudentClass } from '../services/students';
import { Button, Field, FormError, Modal } from './ui';

/**
 * Memindahkan / memasukkan / mengeluarkan siswa dari kelas.
 * mode "remove" mengeluarkan siswa (tanpa kelas tujuan).
 */
export function ClassChangeModal({
  open,
  mode,
  studentId,
  studentName,
  currentClassId,
  classes,
  levels,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: 'move' | 'remove';
  studentId: string;
  studentName: string;
  currentClassId: string | null;
  classes: CourseClass[];
  levels: Level[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClassId('');
      setDate(todayISO());
      setNote('');
      setError(null);
    }
  }, [open]);

  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? '-';
  const options = classes.filter((c) => c.status === 'active' && c.id !== currentClassId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await changeStudentClass(studentId, mode === 'remove' ? null : classId, date, note);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'remove' ? 'Keluarkan dari kelas' : currentClassId ? 'Pindah kelas' : 'Masukkan ke kelas';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="class-change-form" variant={mode === 'remove' ? 'danger' : 'primary'} loading={busy}>
            {mode === 'remove' ? 'Keluarkan' : 'Simpan'}
          </Button>
        </>
      }
    >
      <form id="class-change-form" onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-700">
          Siswa: <strong>{studentName}</strong>. Riwayat kelas sebelumnya tetap tersimpan.
        </p>
        {mode === 'move' && (
          <Field label="Kelas tujuan" required>
            <select className="input" required value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Pilih kelas</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} — {levelName(c.levelId)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Tanggal efektif" required hint="Tanggal siswa mulai/berhenti di kelas. Dipakai untuk laporan historis.">
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Catatan">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: naik level semester 2" />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
