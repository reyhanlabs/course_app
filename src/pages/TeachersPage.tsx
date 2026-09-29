import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  LoadingState,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Table,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { matchesSearch } from '../lib/format';
import { activeStatusLabels } from '../lib/labels';
import { listClasses } from '../services/classes';
import { createTeacher, createTeacherAccount, listTeachers, setTeacherPhoto, updateTeacher } from '../services/teachers';
import type { Teacher, TeacherInput } from '../types';

const empty: TeacherInput = { fullName: '', phone: '', email: '', address: '', specialization: '', status: 'active' };

export function TeachersPage() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([listTeachers(), listClasses()]), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Teacher | null | 'new'>(null);
  const [accountTarget, setAccountTarget] = useState<Teacher | null>(null);

  const [teachers, classes] = data ?? [[], []];
  const classesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of classes) {
      if (c.teacherId && c.status === 'active') map.set(c.teacherId, [...(map.get(c.teacherId) ?? []), c.className]);
    }
    return map;
  }, [classes]);
  const filtered = teachers.filter((t) => matchesSearch(search, t.fullName, t.email, t.specialization));

  return (
    <>
      <PageHeader
        title="Guru"
        description="Guru yang punya akun hanya bisa melihat kelas yang ditugaskan kepadanya."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Tambah guru
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="border-b border-ink-100 p-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, email, spesialisasi" />
          </div>
          {filtered.length === 0 ? (
            <EmptyState title={teachers.length === 0 ? 'Belum ada guru' : 'Tidak ada yang cocok'} />
          ) : (
            <Table head={['Nama', 'Kontak', 'Kelas aktif', 'Status', 'Akun', '']}>
              {filtered.map((t) => {
                const st = activeStatusLabels[t.status];
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.fullName} url={t.photoUrl} />
                        <div>
                          <p className="font-semibold">{t.fullName}</p>
                          <p className="text-xs text-ink-500">{t.specialization}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{t.phone || '-'}</p>
                      <p className="text-xs text-ink-500">{t.email}</p>
                    </td>
                    <td className="px-4 py-3">{classesOf.get(t.id)?.join(', ') ?? <span className="text-ink-400">-</span>}</td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {t.userId ? (
                        <Badge tone="green">Aktif</Badge>
                      ) : (
                        <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setAccountTarget(t)}>
                          <KeyRound className="h-3.5 w-3.5" /> Buat akun
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setEditing(t)} aria-label={`Ubah ${t.fullName}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      )}

      <TeacherFormModal
        open={editing !== null}
        teacher={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={accountTarget !== null}
        title="Buat akun guru"
        message={
          <>
            Akun login akan dibuat untuk <strong>{accountTarget?.email || '(email belum diisi)'}</strong>. Guru akan menerima email untuk
            membuat kata sandi sendiri.
          </>
        }
        confirmLabel="Buat akun"
        onConfirm={async () => {
          if (accountTarget) await createTeacherAccount(accountTarget);
          reload();
        }}
        onClose={() => setAccountTarget(null)}
      />
    </>
  );
}

function TeacherFormModal({
  open,
  teacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TeacherInput>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhoto(null);
    setForm(
      teacher
        ? {
            fullName: teacher.fullName,
            phone: teacher.phone,
            email: teacher.email,
            address: teacher.address,
            specialization: teacher.specialization,
            status: teacher.status,
          }
        : empty,
    );
  }, [open, teacher]);

  const set = <K extends keyof TeacherInput>(key: K, value: TeacherInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let savedId: string;
    try {
      if (teacher) {
        await updateTeacher(teacher, form);
        savedId = teacher.id;
      } else {
        savedId = await createTeacher(form);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }
    if (photo) {
      try {
        await setTeacherPhoto(savedId, teacher?.photoPath ?? null, photo);
      } catch (err) {
        window.alert(`Data guru tersimpan, tetapi foto gagal diunggah: ${errorMessage(err)}`);
      }
    }
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      wide
      title={teacher ? 'Ubah data guru' : 'Tambah guru'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="teacher-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" required>
          <input className="input" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label="Spesialisasi" hint="Contoh: Kindergarten, Phonics">
          <input className="input" value={form.specialization} onChange={(e) => set('specialization', e.target.value)} />
        </Field>
        <Field label="Telepon / WhatsApp">
          <input className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email" hint="Wajib diisi jika guru akan diberi akun.">
          <input
            className="input"
            type="email"
            value={form.email}
            disabled={Boolean(teacher?.userId)}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as TeacherInput['status'])}>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak aktif</option>
          </select>
        </Field>
        <Field label="Foto" hint="Maksimal 5 MB">
          <input className="input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Alamat" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
