import { useEffect, useState, type FormEvent } from 'react';
import type { Level, Student, StudentInput } from '../types';
import { errorMessage } from '../lib/errors';
import { todayISO } from '../lib/format';
import { genderLabels, studentStatusLabels } from '../lib/labels';
import { createStudent, setStudentPhoto, updateStudent } from '../services/students';
import { Button, Field, FormError, Modal } from './ui';

const empty = (): StudentInput => ({
  fullName: '',
  nickname: '',
  gender: '',
  dateOfBirth: '',
  school: '',
  schoolGrade: '',
  address: '',
  startDate: todayISO(),
  currentLevelId: null,
  status: 'active',
  notes: '',
});

export function StudentFormModal({
  open,
  student,
  levels,
  onClose,
  onSaved,
}: {
  open: boolean;
  student: Student | null;
  levels: Level[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState<StudentInput>(empty());
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhoto(null);
    setForm(
      student
        ? {
            fullName: student.fullName,
            nickname: student.nickname,
            gender: student.gender,
            dateOfBirth: student.dateOfBirth,
            school: student.school,
            schoolGrade: student.schoolGrade,
            address: student.address,
            startDate: student.startDate,
            currentLevelId: student.currentLevelId,
            status: student.status,
            notes: student.notes,
          }
        : empty(),
    );
  }, [open, student]);

  const set = <K extends keyof StudentInput>(key: K, value: StudentInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const levelLocked = Boolean(student?.currentClassId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let savedId: string;
    try {
      if (student) {
        await updateStudent(student, form);
        savedId = student.id;
      } else {
        savedId = await createStudent(form);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }
    if (photo) {
      try {
        await setStudentPhoto(savedId, student?.photoPath ?? null, photo);
      } catch (err) {
        window.alert(`Data siswa tersimpan, tetapi foto gagal diunggah: ${errorMessage(err)}`);
      }
    }
    setBusy(false);
    onSaved(savedId);
    onClose();
  }

  return (
    <Modal
      open={open}
      wide
      title={student ? 'Ubah data siswa' : 'Tambah siswa'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="student-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" required className="sm:col-span-2">
          <input className="input" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label="Nama panggilan">
          <input className="input" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
        </Field>
        <Field label="Jenis kelamin">
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value as StudentInput['gender'])}>
            <option value="">Pilih</option>
            <option value="male">{genderLabels.male}</option>
            <option value="female">{genderLabels.female}</option>
          </select>
        </Field>
        <Field label="Tanggal lahir">
          <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
        <Field label="Tanggal mulai kursus" required>
          <input className="input" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Sekolah">
          <input className="input" value={form.school} onChange={(e) => set('school', e.target.value)} />
        </Field>
        <Field label="Kelas di sekolah" hint="Contoh: TK B, Kelas 2">
          <input className="input" value={form.schoolGrade} onChange={(e) => set('schoolGrade', e.target.value)} />
        </Field>
        <Field
          label="Level kursus"
          hint={levelLocked ? 'Level mengikuti kelas siswa. Ubah lewat menu pindah kelas.' : 'Kelas diatur dari halaman detail siswa.'}
        >
          <select
            className="input"
            disabled={levelLocked}
            value={form.currentLevelId ?? ''}
            onChange={(e) => set('currentLevelId', e.target.value || null)}
          >
            <option value="">Belum ditentukan</option>
            {levels
              .filter((l) => l.active || l.id === form.currentLevelId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as StudentInput['status'])}>
            {Object.entries(studentStatusLabels).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alamat" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Catatan" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Field label="Foto" hint="JPG/PNG/WebP, maksimal 5 MB" className="sm:col-span-2">
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
