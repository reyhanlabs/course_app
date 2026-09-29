import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
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
import { formatDate, matchesSearch } from '../lib/format';
import { roleLabels } from '../lib/labels';
import { sendSetupEmail } from '../services/accounts';
import { createStaffAccount, listUsers, setUserActive } from '../services/users';
import type { Role, UserProfile } from '../types';

export function UsersPage() {
  const me = useProfile();
  const { data: users, loading, error, reload } = useAsync(listUsers, []);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UserProfile | null>(null);
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);

  const filtered = (users ?? []).filter((u) => (!role || u.role === role) && matchesSearch(search, u.displayName, u.email));

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun login semua peran. Akun guru dibuat dari menu Guru, akun orang tua dari menu Orang Tua."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Akun admin / owner
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !users && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau email" />
            <select className="input sm:w-44" value={role} onChange={(e) => setRole(e.target.value as Role | '')} aria-label="Filter peran">
              <option value="">Semua peran</option>
              {Object.entries(roleLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="Tidak ada pengguna yang cocok" />
          ) : (
            <Table head={['Nama', 'Peran', 'Dibuat', 'Status', '']}>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.displayName}</p>
                    <p className="text-xs text-ink-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{roleLabels[u.role]}</td>
                  <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'Aktif' : 'Nonaktif'}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" className="text-xs" onClick={() => setResetTarget(u)}>
                      Kirim tautan sandi
                    </Button>
                    {u.id !== me.id && (
                      <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setToggleTarget(u)}>
                        {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      <CreateStaffModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={reload} />
      <ConfirmDialog
        open={toggleTarget !== null}
        title={toggleTarget?.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
        message={
          toggleTarget?.active ? (
            <>
              <strong>{toggleTarget.displayName}</strong> tidak akan bisa membuka data apa pun sampai diaktifkan kembali.
            </>
          ) : (
            <>
              <strong>{toggleTarget?.displayName}</strong> akan bisa login dan membuka data sesuai perannya lagi.
            </>
          )
        }
        confirmLabel={toggleTarget?.active ? 'Nonaktifkan' : 'Aktifkan'}
        danger={toggleTarget?.active}
        onConfirm={async () => {
          if (toggleTarget) await setUserActive(toggleTarget, !toggleTarget.active);
          reload();
        }}
        onClose={() => setToggleTarget(null)}
      />
      <ConfirmDialog
        open={resetTarget !== null}
        title="Kirim tautan kata sandi"
        message={
          <>
            Email berisi tautan untuk membuat kata sandi baru akan dikirim ke <strong>{resetTarget?.email}</strong>.
          </>
        }
        confirmLabel="Kirim"
        onConfirm={async () => {
          if (resetTarget) await sendSetupEmail(resetTarget.email);
        }}
        onClose={() => setResetTarget(null)}
      />
    </>
  );
}

function CreateStaffModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'owner'>('owner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName('');
      setEmail('');
      setRole('owner');
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createStaffAccount({ displayName, email, role });
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
      title="Buat akun admin / owner"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="staff-form" loading={busy}>
            Buat akun
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama" required>
          <input className="input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Email" required hint="Pengguna akan menerima email untuk membuat kata sandi sendiri.">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Peran">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'owner')}>
            <option value="owner">Owner — melihat dashboard, data, dan laporan</option>
            <option value="admin">Admin — akses penuh</option>
          </select>
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
