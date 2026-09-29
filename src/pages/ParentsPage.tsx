import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import {
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
import { relationshipOptions } from '../lib/labels';
import { createParent, createParentAccount, deleteParent, listParents, updateParent } from '../services/parents';
import { listStudents } from '../services/students';
import type { Parent, ParentInput } from '../types';

const empty: ParentInput = { fullName: '', phone: '', whatsapp: '', email: '', address: '', relationship: 'Ibu' };

export function ParentsPage() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([listParents(), listStudents()]), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Parent | null | 'new'>(null);
  const [accountTarget, setAccountTarget] = useState<Parent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);

  const [parents, students] = data ?? [[], []];
  const childrenOf = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const s of students) {
      for (const pid of s.parentIds) {
        map.set(pid, [...(map.get(pid) ?? []), { id: s.id, name: s.nickname || s.fullName }]);
      }
    }
    return map;
  }, [students]);
  const filtered = parents.filter((p) => matchesSearch(search, p.fullName, p.phone, p.whatsapp, p.email));

  return (
    <>
      <PageHeader
        title="Orang Tua"
        description="Satu orang tua bisa terhubung ke beberapa anak. Hubungkan anak dari halaman detail siswa."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Tambah orang tua
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
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, telepon, email" />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title={parents.length === 0 ? 'Belum ada data orang tua' : 'Tidak ada yang cocok'}
              description={parents.length === 0 ? 'Tambahkan orang tua, lalu hubungkan ke anaknya.' : undefined}
            />
          ) : (
            <Table head={['Nama', 'Kontak', 'Anak', 'Akun portal', '']}>
              {filtered.map((p) => {
                const children = childrenOf.get(p.id) ?? [];
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.fullName}</p>
                      <p className="text-xs text-ink-500">{p.relationship}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{p.whatsapp || p.phone || '-'}</p>
                      <p className="text-xs text-ink-500">{p.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {children.length === 0 ? (
                        <span className="text-ink-400">Belum terhubung</span>
                      ) : (
                        children.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ', '}
                            <Link to={`/students/${c.id}`} className="text-brand-600 hover:underline">
                              {c.name}
                            </Link>
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.userId ? (
                        <Badge tone="green">Aktif</Badge>
                      ) : (
                        <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setAccountTarget(p)}>
                          <KeyRound className="h-3.5 w-3.5" /> Buat akun
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => setEditing(p)} aria-label={`Ubah ${p.fullName}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" onClick={() => setDeleteTarget(p)} aria-label={`Hapus ${p.fullName}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      )}

      <ParentFormModal
        open={editing !== null}
        parent={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={accountTarget !== null}
        title="Buat akun portal orang tua"
        message={
          <>
            Akun login akan dibuat untuk <strong>{accountTarget?.email || '(email belum diisi)'}</strong>. Orang tua akan menerima email
            untuk membuat kata sandi sendiri, lalu bisa melihat data anak-anaknya.
          </>
        }
        confirmLabel="Buat akun"
        onConfirm={async () => {
          if (accountTarget) await createParentAccount(accountTarget);
          reload();
        }}
        onClose={() => setAccountTarget(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus orang tua"
        message={
          <>
            Hapus data <strong>{deleteTarget?.fullName}</strong>? Hanya bisa dilakukan jika belum terhubung ke anak dan belum punya akun.
          </>
        }
        confirmLabel="Hapus"
        danger
        onConfirm={async () => {
          if (deleteTarget) await deleteParent(deleteTarget);
          reload();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function ParentFormModal({
  open,
  parent,
  onClose,
  onSaved,
}: {
  open: boolean;
  parent: Parent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ParentInput>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      parent
        ? {
            fullName: parent.fullName,
            phone: parent.phone,
            whatsapp: parent.whatsapp,
            email: parent.email,
            address: parent.address,
            relationship: parent.relationship,
          }
        : empty,
    );
  }, [open, parent]);

  const set = (key: keyof ParentInput, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (parent) await updateParent(parent, form);
      else await createParent(form);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      wide
      title={parent ? 'Ubah data orang tua' : 'Tambah orang tua'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="parent-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="parent-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" required>
          <input className="input" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
        <Field label="Hubungan">
          <select className="input" value={form.relationship} onChange={(e) => set('relationship', e.target.value)}>
            {relationshipOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Telepon">
          <input className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="WhatsApp" hint="Contoh: 081234567890">
          <input className="input" type="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </Field>
        <Field label="Email" hint="Wajib diisi jika orang tua akan diberi akun portal." className="sm:col-span-2">
          <input
            className="input"
            type="email"
            value={form.email}
            disabled={Boolean(parent?.userId)}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Alamat" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
