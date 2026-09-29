import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, SearchInput } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatDate, matchesSearch } from '../lib/format';
import { materialTypeLabels, skillLabels } from '../lib/labels';
import { listLessonsOfLevel } from '../services/curriculum';
import { listLevels } from '../services/levels';
import { createMaterial, deleteMaterial, guessMaterialType, listMaterials, MAX_MATERIAL_BYTES, setMaterialVisibility } from '../services/materials';
import { errorMessage as errMsg } from '../lib/errors';
import { SKILLS, type Level, type Material, type MaterialType } from '../types';

export function MaterialsPage() {
  const profile = useProfile();
  const { data, loading, error, reload } = useAsync(() => Promise.all([listMaterials(), listLevels()]), []);
  const [search, setSearch] = useState('');
  const [levelId, setLevelId] = useState('');
  const [type, setType] = useState<MaterialType | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const [materials, levels] = data ?? [[], []];
  const levelName = useMemo(() => new Map(levels.map((l) => [l.id, l.name])), [levels]);
  const filtered = materials.filter(
    (m) => (!levelId || m.levelId === levelId) && (!type || m.type === type) && matchesSearch(search, m.title, m.topic, m.description),
  );
  const canDelete = (m: Material) => profile.role === 'admin' || m.createdBy === profile.id;

  return (
    <>
      <PageHeader
        title="Materi"
        description="Perpustakaan materi ajar: PDF, gambar, audio, video, worksheet, dokumen, atau tautan."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah materi
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data && loading ? (
        <LoadingState />
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari judul atau topik" />
            <select className="input sm:w-44" value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Filter level">
              <option value="">Semua level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select className="input sm:w-40" value={type} onChange={(e) => setType(e.target.value as MaterialType | '')} aria-label="Filter jenis">
              <option value="">Semua jenis</option>
              {Object.entries(materialTypeLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title={materials.length === 0 ? 'Belum ada materi' : 'Tidak ada materi yang cocok'} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {filtered.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                  <Badge tone="blue">{materialTypeLabels[m.type]}</Badge>
                  <div className="min-w-0 flex-1">
                    <a href={m.storageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline">
                      {m.title} <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                    </a>
                    {m.description && <p className="text-ink-500">{m.description}</p>}
                    <p className="text-xs text-ink-500">
                      {[m.levelId && levelName.get(m.levelId), m.topic, m.skill && skillLabels[m.skill as keyof typeof skillLabels]]
                        .filter(Boolean)
                        .join(', ') || 'Umum'}
                      {' — '}
                      {m.createdByName}, {formatDate(m.createdAt)}
                    </p>
                  </div>
                  {canDelete(m) ? (
                    <button
                      type="button"
                      className="text-xs"
                      title="Klik untuk mengubah"
                      onClick={async () => {
                        try {
                          await setMaterialVisibility(m, !m.visibleToParents);
                          reload();
                        } catch (e) {
                          window.alert(errMsg(e));
                        }
                      }}
                    >
                      <Badge tone={m.visibleToParents ? 'green' : 'gray'}>{m.visibleToParents ? 'Terlihat orang tua' : 'Khusus guru'}</Badge>
                    </button>
                  ) : (
                    <Badge tone={m.visibleToParents ? 'green' : 'gray'}>{m.visibleToParents ? 'Terlihat orang tua' : 'Khusus guru'}</Badge>
                  )}
                  {canDelete(m) && (
                    <Button variant="ghost" aria-label={`Hapus ${m.title}`} onClick={() => setDeleteTarget(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      <AddMaterialModal open={addOpen} levels={levels} onClose={() => setAddOpen(false)} onSaved={reload} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus materi"
        message={<>Hapus <strong>{deleteTarget?.title}</strong>? File yang diunggah ikut terhapus.</>}
        confirmLabel="Hapus"
        danger
        onConfirm={async () => {
          if (deleteTarget) await deleteMaterial(deleteTarget);
          reload();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function AddMaterialModal({ open, levels, onClose, onSaved }: { open: boolean; levels: Level[]; onClose: () => void; onSaved: () => void }) {
  const profile = useProfile();
  const blank = { title: '', description: '', type: 'pdf' as MaterialType, levelId: '', lessonId: '', topic: '', skill: '', externalUrl: '', visibleToParents: true };
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lessons = useAsync(() => (form.levelId ? listLessonsOfLevel(form.levelId) : Promise.resolve([])), [form.levelId]);

  useEffect(() => {
    if (open) {
      setForm(blank);
      setFile(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickFile(f: File | null) {
    setFile(f);
    if (f) setForm((prev) => ({ ...prev, title: prev.title || f.name.replace(/\.[^.]+$/, ''), type: prev.type === 'worksheet' ? 'worksheet' : guessMaterialType(f) }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMaterial({ ...form, levelId: form.levelId || null, lessonId: form.lessonId || null }, file, profile);
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
      title="Tambah materi"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="material-form" loading={busy}>
            {busy && form.type !== 'url' ? 'Mengunggah…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis" required>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaterialType })}>
            {Object.entries(materialTypeLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {form.type === 'url' ? (
          <Field label="Tautan" required hint="Contoh: video YouTube atau Google Drive">
            <input className="input" type="url" required value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://" />
          </Field>
        ) : (
          <Field label="File" required hint={`Maksimal ${MAX_MATERIAL_BYTES / 1024 / 1024} MB`}>
            <input className="input" type="file" required onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </Field>
        )}
        <Field label="Judul" required className="sm:col-span-2">
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Deskripsi" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Level">
          <select className="input" value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value, lessonId: '' })}>
            <option value="">Semua level</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pelajaran">
          <select className="input" value={form.lessonId} disabled={!form.levelId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })}>
            <option value="">{form.levelId ? 'Tidak terkait pelajaran' : 'Pilih level dulu'}</option>
            {(lessons.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                Minggu {l.weekNumber}: {l.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Topik">
          <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Contoh: Animals" />
        </Field>
        <Field label="Keterampilan">
          <select className="input" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}>
            <option value="">Umum</option>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {skillLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.visibleToParents} onChange={(e) => setForm({ ...form, visibleToParents: e.target.checked })} />
          Tampilkan di portal orang tua (kosongkan untuk kunci jawaban atau materi khusus guru)
        </label>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
