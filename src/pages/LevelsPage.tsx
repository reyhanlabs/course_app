import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { createLevel, DEFAULT_LEVELS, listLevels, seedDefaultLevels, setLevelActive, swapLevelOrder, updateLevel } from '../services/levels';
import type { Level, LevelInput } from '../types';

export function LevelsPage() {
  const { data: levels, loading, error, reload } = useAsync(listLevels, []);
  const [editing, setEditing] = useState<Level | null | 'new'>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Level"
        description="Urutan level dipakai di seluruh aplikasi. Level yang dinonaktifkan tidak bisa dipilih untuk kelas atau siswa baru."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Tambah level
          </Button>
        }
      />
      <FormError message={actionError} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !levels ? (
        <LoadingState />
      ) : (
        <Panel className="mt-3">
          {levels.length === 0 ? (
            <EmptyState
              title="Belum ada level"
              description={`Mulai dengan level awal: ${DEFAULT_LEVELS.join(', ')}. Semuanya bisa diubah nanti.`}
              action={
                <Button loading={busyId === 'seed'} onClick={() => run('seed', seedDefaultLevels)}>
                  Buat level awal
                </Button>
              }
            />
          ) : (
            <ol className="divide-y divide-ink-100">
              {levels.map((level, index) => (
                <li key={level.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-6 text-sm font-semibold text-ink-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{level.name}</p>
                    {level.description && <p className="text-sm text-ink-500">{level.description}</p>}
                  </div>
                  <Badge tone={level.active ? 'green' : 'gray'}>{level.active ? 'Aktif' : 'Nonaktif'}</Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      aria-label="Naikkan urutan"
                      disabled={index === 0 || busyId !== null}
                      onClick={() => run(level.id, () => swapLevelOrder(level, levels[index - 1]))}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label="Turunkan urutan"
                      disabled={index === levels.length - 1 || busyId !== null}
                      onClick={() => run(level.id, () => swapLevelOrder(level, levels[index + 1]))}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" aria-label={`Ubah ${level.name}`} onClick={() => setEditing(level)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      disabled={busyId !== null}
                      onClick={() => run(level.id, () => setLevelActive(level.id, !level.active))}
                    >
                      {level.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {loading && levels.length > 0 && <p className="px-4 pb-3 text-xs text-ink-500">Memperbarui…</p>}
        </Panel>
      )}
      <LevelFormModal
        open={editing !== null}
        level={editing === 'new' ? null : editing}
        existing={levels ?? []}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}

function LevelFormModal({
  open,
  level,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  level: Level | null;
  existing: Level[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<LevelInput>({ name: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(level ? { name: level.name, description: level.description } : { name: '', description: '' });
  }, [open, level]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (level) await updateLevel(level.id, form, existing);
      else await createLevel(form, existing);
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
      title={level ? 'Ubah level' : 'Tambah level'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="level-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="level-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nama level" required>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Keterangan">
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
