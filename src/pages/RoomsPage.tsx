import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, Table } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { activeStatusLabels } from '../lib/labels';
import { listRooms, saveRoom } from '../services/rooms';
import type { Room, RoomInput } from '../types';

export function RoomsPage() {
  const { data: rooms, loading, error, reload } = useAsync(listRooms, []);
  const [editing, setEditing] = useState<Room | null | 'new'>(null);

  return (
    <>
      <PageHeader
        title="Ruangan"
        description="Jadwal memakai ruangan ini. Sistem menolak dua kelas di ruangan yang sama pada jam yang sama."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Tambah ruangan
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rooms && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          {!rooms || rooms.length === 0 ? (
            <EmptyState title="Belum ada ruangan" description="Tambahkan ruangan kelas, misalnya Ruang 1 dan Ruang 2." />
          ) : (
            <Table head={['Nama', 'Kapasitas', 'Status', '']}>
              {rooms.map((r) => {
                const st = activeStatusLabels[r.status];
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-semibold">{r.name}</td>
                    <td className="px-4 py-3">{r.capacity > 0 ? `${r.capacity} orang` : '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setEditing(r)} aria-label={`Ubah ${r.name}`}>
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
      <RoomFormModal
        open={editing !== null}
        room={editing === 'new' ? null : editing}
        existing={rooms ?? []}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}

function RoomFormModal({ open, room, existing, onClose, onSaved }: { open: boolean; room: Room | null; existing: Room[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RoomInput>({ name: '', capacity: 10, status: 'active' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(room ? { name: room.name, capacity: room.capacity, status: room.status } : { name: '', capacity: 10, status: 'active' });
  }, [open, room]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveRoom(room?.id ?? null, form, existing);
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
      title={room ? 'Ubah ruangan' : 'Tambah ruangan'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="room-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama ruangan" required>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kapasitas" hint="0 = tidak dibatasi">
            <input className="input" type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomInput['status'] })}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
          </Field>
        </div>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
