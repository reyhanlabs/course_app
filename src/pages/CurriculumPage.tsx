import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { LessonSummary } from '../components/LessonSummary';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, cn } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { materialTypeLabels } from '../lib/labels';
import { deleteLesson, deleteSemester, listLessonsOfLevel, listSemesters, saveLesson, saveSemester } from '../services/curriculum';
import { listLevels } from '../services/levels';
import { listMaterials } from '../services/materials';
import type { Lesson, LessonInput, Semester } from '../types';

export function CurriculumPage() {
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const levelsState = useAsync(listLevels, []);
  const levels = (levelsState.data ?? []).filter((l) => l.active);
  const [levelId, setLevelId] = useState('');
  useEffect(() => {
    if (!levelId && levels.length > 0) setLevelId(levels[0].id);
  }, [levels, levelId]);

  const content = useAsync(
    async () => (levelId ? Promise.all([listSemesters(levelId), listLessonsOfLevel(levelId)]) : null),
    [levelId],
  );
  const [semesterModal, setSemesterModal] = useState<Semester | null | 'new'>(null);
  const [deleteSem, setDeleteSem] = useState<Semester | null>(null);
  const [lessonModal, setLessonModal] = useState<{ lesson: Lesson | null; semesterId: string } | null>(null);
  const [viewLesson, setViewLesson] = useState<Lesson | null>(null);

  if (levelsState.error) return <ErrorState message={levelsState.error} onRetry={levelsState.reload} />;
  if (!levelsState.data) return <LoadingState />;

  const [semesters, lessons] = content.data ?? [[], []];

  return (
    <>
      <PageHeader title="Kurikulum" description="Susunan pelajaran per level: Level → Semester → Minggu → Pelajaran." />
      {levels.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada level aktif" description="Buat level di menu Level terlebih dahulu." />
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Pilih level">
            {levels.map((l) => (
              <button
                key={l.id}
                role="tab"
                aria-selected={l.id === levelId}
                onClick={() => setLevelId(l.id)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium',
                  l.id === levelId ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
                )}
              >
                {l.name}
              </button>
            ))}
            {isAdmin && (
              <Button variant="secondary" className="ml-auto" onClick={() => setSemesterModal('new')}>
                <Plus className="h-4 w-4" /> Semester
              </Button>
            )}
          </div>

          {content.error ? (
            <ErrorState message={content.error} onRetry={content.reload} />
          ) : !content.data ? (
            <LoadingState />
          ) : semesters.length === 0 ? (
            <Panel>
              <EmptyState
                title="Belum ada semester untuk level ini"
                description={isAdmin ? 'Tambahkan Semester 1, lalu isi pelajaran per minggu.' : undefined}
              />
            </Panel>
          ) : (
            <div className="space-y-6">
              {semesters.map((sem) => {
                const semLessons = lessons.filter((l) => l.semesterId === sem.id);
                return (
                  <Panel
                    key={sem.id}
                    title={sem.name}
                    actions={
                      isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" aria-label="Ubah semester" onClick={() => setSemesterModal(sem)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" aria-label="Hapus semester" onClick={() => setDeleteSem(sem)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => setLessonModal({ lesson: null, semesterId: sem.id })}>
                            <Plus className="h-4 w-4" /> Pelajaran
                          </Button>
                        </div>
                      )
                    }
                  >
                    {semLessons.length === 0 ? (
                      <EmptyState title="Belum ada pelajaran" />
                    ) : (
                      <ul className="divide-y divide-ink-100">
                        {semLessons.map((l) => (
                          <li key={l.id}>
                            <button type="button" onClick={() => setViewLesson(l)} className="flex w-full items-start gap-4 px-4 py-3 text-left text-sm hover:bg-ink-50">
                              <span className="w-20 shrink-0 font-semibold text-ink-500">Minggu {l.weekNumber}</span>
                              <span className="flex-1">
                                <span className="font-semibold">{l.title}</span>
                                {l.objective && <span className="block text-ink-500">{l.objective}</span>}
                              </span>
                              {l.duration > 0 && <span className="text-ink-500">{l.duration} mnt</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <>
          <SemesterModal
            open={semesterModal !== null}
            semester={semesterModal === 'new' ? null : semesterModal}
            levelId={levelId}
            existing={semesters}
            onClose={() => setSemesterModal(null)}
            onSaved={content.reload}
          />
          <ConfirmDialog
            open={deleteSem !== null}
            title="Hapus semester"
            message={<>Hapus <strong>{deleteSem?.name}</strong>? Hanya bisa jika semester ini tidak berisi pelajaran.</>}
            confirmLabel="Hapus"
            danger
            onConfirm={async () => {
              if (deleteSem) await deleteSemester(deleteSem);
              content.reload();
            }}
            onClose={() => setDeleteSem(null)}
          />
          <LessonFormModal
            open={lessonModal !== null}
            lesson={lessonModal?.lesson ?? null}
            levelId={levelId}
            semesterId={lessonModal?.semesterId ?? ''}
            semesters={semesters}
            onClose={() => setLessonModal(null)}
            onSaved={content.reload}
          />
        </>
      )}
      <LessonViewModal
        lesson={viewLesson}
        canEdit={isAdmin}
        onClose={() => setViewLesson(null)}
        onEdit={(l) => {
          setViewLesson(null);
          setLessonModal({ lesson: l, semesterId: l.semesterId });
        }}
        onDeleted={() => {
          setViewLesson(null);
          content.reload();
        }}
      />
    </>
  );
}

function SemesterModal({
  open,
  semester,
  levelId,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  semester: Semester | null;
  levelId: string;
  existing: Semester[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName(semester?.name ?? `Semester ${existing.length + 1}`);
      setError(null);
    }
  }, [open, semester, existing.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveSemester(semester?.id ?? null, levelId, name, existing);
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
      title={semester ? 'Ubah semester' : 'Tambah semester'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="semester-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="semester-form" onSubmit={onSubmit}>
        <Field label="Nama semester" required>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}

const TEXT_FIELDS: [keyof LessonInput, string][] = [
  ['objective', 'Tujuan pembelajaran'],
  ['vocabulary', 'Vocabulary'],
  ['grammar', 'Grammar'],
  ['speaking', 'Speaking'],
  ['listening', 'Listening'],
  ['reading', 'Reading'],
  ['writing', 'Writing'],
  ['activities', 'Aktivitas'],
  ['homework', 'PR'],
  ['teachingNotes', 'Catatan mengajar'],
];

function LessonFormModal({
  open,
  lesson,
  levelId,
  semesterId,
  semesters,
  onClose,
  onSaved,
}: {
  open: boolean;
  lesson: Lesson | null;
  levelId: string;
  semesterId: string;
  semesters: Semester[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank = (): LessonInput => ({
    levelId,
    semesterId,
    weekNumber: 1,
    title: '',
    objective: '',
    vocabulary: '',
    grammar: '',
    speaking: '',
    listening: '',
    reading: '',
    writing: '',
    activities: '',
    homework: '',
    teachingNotes: '',
    duration: 60,
  });
  const [form, setForm] = useState<LessonInput>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (lesson) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = lesson;
      setForm(rest);
    } else setForm(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson, semesterId, levelId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveLesson(lesson?.id ?? null, form);
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
      title={lesson ? 'Ubah pelajaran' : 'Tambah pelajaran'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="lesson-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Judul pelajaran" required className="sm:col-span-3">
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Greetings" />
        </Field>
        <Field label="Semester" required>
          <select className="input" value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Minggu ke-" required>
          <input className="input" type="number" min={1} required value={form.weekNumber} onChange={(e) => setForm({ ...form, weekNumber: Number(e.target.value) })} />
        </Field>
        <Field label="Durasi (menit)">
          <input className="input" type="number" min={0} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
        </Field>
        {TEXT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} className="sm:col-span-3">
            <textarea className="input" rows={2} value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </Field>
        ))}
      </form>
      <FormError message={error} />
    </Modal>
  );
}

function LessonViewModal({
  lesson,
  canEdit,
  onClose,
  onEdit,
  onDeleted,
}: {
  lesson: Lesson | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (l: Lesson) => void;
  onDeleted: () => void;
}) {
  const materials = useAsync(() => (lesson ? listMaterials() : Promise.resolve([])), [lesson?.id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linked = (materials.data ?? []).filter((m) => lesson && m.lessonId === lesson.id);

  return (
    <>
      <Modal
        open={lesson !== null && !confirmDelete}
        wide
        title={lesson ? `Minggu ${lesson.weekNumber}: ${lesson.title}` : ''}
        onClose={onClose}
        footer={
          canEdit && lesson ? (
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
              <Button onClick={() => onEdit(lesson)}>
                <Pencil className="h-4 w-4" /> Ubah
              </Button>
            </>
          ) : undefined
        }
      >
        {lesson && (
          <div className="space-y-5">
            <LessonSummary lesson={lesson} />
            <div>
              <p className="text-sm font-semibold">Materi terkait</p>
              {linked.length === 0 ? (
                <p className="text-sm text-ink-500">Belum ada. Tambahkan dari menu Materi dan pilih pelajaran ini.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {linked.map((m) => (
                    <li key={m.id}>
                      <a href={m.storageUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                        {m.title}
                      </a>{' '}
                      <span className="text-ink-500">({materialTypeLabels[m.type]})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Hapus pelajaran"
        message={<>Hapus <strong>{lesson?.title}</strong>? Pelajaran yang sudah dipakai di sesi tidak bisa dihapus.</>}
        confirmLabel="Hapus"
        danger
        onConfirm={async () => {
          if (lesson) await deleteLesson(lesson);
          onDeleted();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
