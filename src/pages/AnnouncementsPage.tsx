import { useEffect, useState, type FormEvent } from 'react';
import { MessageCircle, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { Badge, Button, buttonClass, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { deleteAnnouncement, listAllAnnouncements, listAnnouncementsFor, saveAnnouncement } from '../services/announcements';
import { listClasses } from '../services/classes';
import { getInstitutionSettings } from '../services/settings';
import type { Announcement, AnnouncementAudience, AnnouncementInput, CourseClass } from '../types';

const audienceLabels: Record<AnnouncementAudience, string> = { all: 'Semua', parents: 'Orang tua', teachers: 'Guru' };

export function AnnouncementsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const { data, error, reload } = useAsync(
    async () =>
      Promise.all([
        isAdmin ? listAllAnnouncements() : listAnnouncementsFor(profile),
        isAdmin || profile.role === 'owner' ? listClasses() : Promise.resolve([] as CourseClass[]),
        getInstitutionSettings(),
      ]),
    [profile.id],
  );
  const [editing, setEditing] = useState<Announcement | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [items, classes, institution] = data;
  const className = new Map(classes.map((c) => [c.id, c.className]));

  return (
    <>
      <PageHeader
        title="Pengumuman"
        description={isAdmin ? 'Pengumuman terbit muncul di portal guru/orang tua dan dikirim sebagai notifikasi.' : undefined}
        actions={
          isAdmin && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Buat pengumuman
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada pengumuman" />
        </Panel>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const waText = `*${a.title}*\n\n${a.body}\n\n— ${institution.name || ''}`.trim();
            return (
              <article key={a.id} className="rounded-xl border border-ink-100 bg-white p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <h2 className="flex flex-1 items-center gap-2 text-lg font-bold">
                    {a.pinned && <Pin className="h-4 w-4 text-marker" aria-label="Disematkan" />}
                    {a.title}
                  </h2>
                  {isAdmin && !a.published && <Badge tone="gray">Draft</Badge>}
                  {isAdmin && (
                    <>
                      <Badge tone="blue">{audienceLabels[a.audience]}</Badge>
                      {a.classIds.length > 0 && <Badge tone="gray">{a.classIds.map((c) => className.get(c) ?? '?').join(', ')}</Badge>}
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {formatDate(a.publishedAt ?? a.createdAt ?? null)}, {a.createdByName}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm text-ink-700">{a.body}</p>
                {isAdmin && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
                      <MessageCircle className="h-4 w-4" /> Bagikan ke WhatsApp
                    </a>
                    <Button variant="ghost" onClick={() => setEditing(a)}>
                      <Pencil className="h-4 w-4" /> Ubah
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="h-4 w-4" /> Hapus
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {isAdmin && (
        <>
          <AnnouncementModal
            open={editing !== null}
            announcement={editing === 'new' ? null : editing}
            classes={classes}
            onClose={() => setEditing(null)}
            onSaved={reload}
          />
          <ConfirmDialog
            open={deleteTarget !== null}
            title="Hapus pengumuman"
            message={<>Hapus <strong>{deleteTarget?.title}</strong>?</>}
            confirmLabel="Hapus"
            danger
            onConfirm={async () => {
              if (deleteTarget) await deleteAnnouncement(deleteTarget);
              reload();
            }}
            onClose={() => setDeleteTarget(null)}
          />
        </>
      )}
    </>
  );
}

function AnnouncementModal({
  open,
  announcement,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean;
  announcement: Announcement | null;
  classes: CourseClass[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const profile = useProfile();
  const blank: AnnouncementInput = { title: '', body: '', audience: 'all', classIds: [], pinned: false, published: true };
  const [form, setForm] = useState<AnnouncementInput>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      announcement
        ? { title: announcement.title, body: announcement.body, audience: announcement.audience, classIds: announcement.classIds, pinned: announcement.pinned, published: announcement.published }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announcement]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveAnnouncement(announcement, form, profile);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const toggleClass = (id: string) =>
    setForm((f) => ({ ...f, classIds: f.classIds.includes(id) ? f.classIds.filter((c) => c !== id) : [...f.classIds, id] }));

  return (
    <Modal
      open={open}
      wide
      title={announcement ? 'Ubah pengumuman' : 'Buat pengumuman'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="announcement-form" loading={busy}>
            {form.published && !announcement?.published ? 'Terbitkan' : 'Simpan'}
          </Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Judul" required>
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Isi" required>
          <textarea className="input" rows={6} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label="Untuk">
          <select className="input sm:w-48" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as AnnouncementAudience })}>
            {Object.entries(audienceLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">Kelas (kosongkan untuk semua kelas)</legend>
          <div className="flex flex-wrap gap-3">
            {classes
              .filter((c) => c.status === 'active')
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                  {c.className}
                </label>
              ))}
          </div>
          <p className="mt-1 text-xs text-ink-500">Pilihan kelas hanya mengatur siapa yang melihatnya di aplikasi. Jangan tulis data rahasia di pengumuman.</p>
        </fieldset>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Sematkan di atas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Terbitkan
            {announcement?.published ? '' : ' (penerima mendapat notifikasi)'}
          </label>
        </div>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
