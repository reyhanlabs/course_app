import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { ClassSelect } from '../components/ClassSelect';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel } from '../components/ui';
import { useAccessibleClasses } from '../hooks/useAccessibleClasses';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { addDays, formatDate, todayISO } from '../lib/format';
import { listLessonsOfLevel } from '../services/curriculum';
import { deleteHomework, listHomeworkOfClasses, saveHomework } from '../services/homework';
import type { CourseClass, Homework, HomeworkInput, HomeworkSubmission, Student } from '../types';
import { listSubmissionsOfHomework, reviewSubmission } from '../services/submissions';
import { listStudentsInClass } from '../services/students';

export function HomeworkPage() {
  const classesState = useAccessibleClasses();
  const classes = classesState.data ?? [];
  const [classId, setClassId] = useState('');
  const hw = useAsync(async () => (classesState.data ? listHomeworkOfClasses(classesState.data.map((c) => c.id)) : []), [classesState.data]);
  const [editing, setEditing] = useState<Homework | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<Homework | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Homework | null>(null);
  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.className])), [classes]);

  if (classesState.error) return <ErrorState message={classesState.error} onRetry={classesState.reload} />;
  if (!classesState.data) return <LoadingState />;
  const rows = (hw.data ?? []).filter((h) => !classId || h.classId === classId);
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="PR"
        description="PR per kelas. Orang tua akan bisa melihat dan mengunggah jawaban di portal orang tua (Fase 4)."
        actions={
          <Button onClick={() => setEditing('new')} disabled={classes.length === 0}>
            <Plus className="h-4 w-4" /> Buat PR
          </Button>
        }
      />
      <div className="mb-4">
        <ClassSelect classes={classes} value={classId} onChange={setClassId} allowAll />
      </div>
      {hw.error ? (
        <ErrorState message={hw.error} onRetry={hw.reload} />
      ) : !hw.data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada PR" />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-ink-100">
            {rows.map((h) => {
              const overdue = h.status === 'active' && h.dueDate < today;
              return (
                <li key={h.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{h.title}</p>
                    <p className="text-ink-500">
                      {className.get(h.classId) ?? 'Kelas'} · diberikan {formatDate(h.assignedDate)} · batas {formatDate(h.dueDate)}
                    </p>
                    {h.description && <p className="mt-1 whitespace-pre-line text-ink-700">{h.description}</p>}
                    {h.attachmentUrl && (
                      <a href={h.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Paperclip className="h-3.5 w-3.5" /> {h.attachmentName ?? 'Lampiran'}
                      </a>
                    )}
                  </div>
                  <Badge tone={h.status === 'closed' ? 'gray' : overdue ? 'amber' : 'green'}>
                    {h.status === 'closed' ? 'Ditutup' : overdue ? 'Lewat batas' : 'Aktif'}
                  </Badge>
                  <div className="flex">
                    <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setReviewTarget(h)}>
                      Jawaban
                    </Button>
                    <Button variant="ghost" aria-label="Ubah PR" onClick={() => setEditing(h)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" aria-label="Hapus PR" onClick={() => setDeleteTarget(h)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      <HomeworkFormModal
        open={editing !== null}
        homework={editing === 'new' ? null : editing}
        classes={classes.filter((c) => c.status === 'active' || (editing !== 'new' && editing?.classId === c.id))}
        defaultClassId={classId}
        onClose={() => setEditing(null)}
        onSaved={hw.reload}
      />
      <SubmissionsModal homework={reviewTarget} onClose={() => setReviewTarget(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus PR"
        message={<>Hapus <strong>{deleteTarget?.title}</strong> beserta lampirannya?</>}
        confirmLabel="Hapus"
        danger
        onConfirm={async () => {
          if (deleteTarget) await deleteHomework(deleteTarget);
          hw.reload();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function HomeworkFormModal({
  open,
  homework,
  classes,
  defaultClassId,
  onClose,
  onSaved,
}: {
  open: boolean;
  homework: Homework | null;
  classes: CourseClass[];
  defaultClassId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const profile = useProfile();
  const [form, setForm] = useState<HomeworkInput>({ classId: '', lessonId: null, title: '', description: '', assignedDate: todayISO(), dueDate: addDays(todayISO(), 7), status: 'active' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const levelId = classes.find((c) => c.id === form.classId)?.levelId ?? '';
  const lessons = useAsync(() => (levelId ? listLessonsOfLevel(levelId) : Promise.resolve([])), [levelId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setForm(
      homework
        ? {
            classId: homework.classId,
            lessonId: homework.lessonId,
            title: homework.title,
            description: homework.description,
            assignedDate: homework.assignedDate,
            dueDate: homework.dueDate,
            status: homework.status,
          }
        : { classId: defaultClassId, lessonId: null, title: '', description: '', assignedDate: todayISO(), dueDate: addDays(todayISO(), 7), status: 'active' },
    );
  }, [open, homework, defaultClassId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveHomework(homework, form, file, profile);
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
      title={homework ? 'Ubah PR' : 'Buat PR'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="homework-form" loading={busy}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="homework-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Kelas" required>
          <ClassSelect classes={classes} value={form.classId} onChange={(id) => setForm({ ...form, classId: id, lessonId: null })} className="input" />
        </Field>
        <Field label="Pelajaran">
          <select className="input" value={form.lessonId ?? ''} disabled={!levelId} onChange={(e) => setForm({ ...form, lessonId: e.target.value || null })}>
            <option value="">Tidak terkait pelajaran</option>
            {(lessons.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                Minggu {l.weekNumber}: {l.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Judul" required className="sm:col-span-2">
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Instruksi" className="sm:col-span-2">
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Tanggal diberikan" required>
          <input className="input" type="date" required value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
        </Field>
        <Field label="Batas pengumpulan" required>
          <input className="input" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label="Lampiran" hint={homework?.attachmentName ? `Saat ini: ${homework.attachmentName}. Pilih file baru untuk mengganti.` : 'Maksimal 20 MB'}>
          <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as HomeworkInput['status'] })}>
            <option value="active">Aktif</option>
            <option value="closed">Ditutup</option>
          </select>
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}

function SubmissionsModal({ homework, onClose }: { homework: Homework | null; onClose: () => void }) {
  const { data, error, reload } = useAsync(
    async () => (homework ? Promise.all([listStudentsInClass(homework.classId), listSubmissionsOfHomework(homework)]) : null),
    [homework?.id],
  );
  const [students, submissions] = data ?? [[] as Student[], [] as HomeworkSubmission[]];
  const bySt = new Map(submissions.map((s) => [s.studentId, s]));
  // Siswa yang sudah pindah kelas tapi sempat mengumpulkan tetap ditampilkan.
  const extra = submissions.filter((s) => !students.some((st) => st.id === s.studentId));
  const rows = [...students.map((s) => ({ id: s.id, name: s.fullName })), ...extra.map((s) => ({ id: s.studentId, name: s.studentName }))];

  return (
    <Modal open={homework !== null} wide title={`Jawaban: ${homework?.title ?? ''}`} onClose={onClose}>
      {error ? (
        <FormError message={error} />
      ) : !data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada siswa di kelas ini" />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-500">
            {submissions.length} dari {rows.length} siswa sudah mengumpulkan (dikirim orang tua lewat portal).
          </p>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {rows.map((r) => (
              <SubmissionRow key={r.id} name={r.name} submission={bySt.get(r.id) ?? null} onSaved={reload} />
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function SubmissionRow({ name, submission, onSaved }: { name: string; submission: HomeworkSubmission | null; onSaved: () => void }) {
  const profile = useProfile();
  const [feedback, setFeedback] = useState(submission?.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setFeedback(submission?.feedback ?? ''), [submission]);

  async function save() {
    if (!submission) return;
    setBusy(true);
    setError(null);
    try {
      await reviewSubmission(submission, feedback, profile);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-medium">{name}</span>
        {submission ? (
          <Badge tone={submission.status === 'reviewed' ? 'green' : 'blue'}>
            {submission.status === 'reviewed' ? 'Sudah dinilai' : `Dikumpulkan ${formatDate(submission.submittedAt)}`}
          </Badge>
        ) : (
          <Badge tone="gray">Belum mengumpulkan</Badge>
        )}
      </div>
      {submission && (
        <>
          {submission.fileUrl && (
            <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <Paperclip className="h-3.5 w-3.5" /> {submission.fileName ?? 'File jawaban'}
            </a>
          )}
          {submission.note && <p className="text-ink-700">Catatan orang tua: {submission.note}</p>}
          <div className="flex gap-2">
            <input className="input" placeholder="Umpan balik untuk orang tua" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <Button variant="secondary" onClick={save} loading={busy}>
              Simpan
            </Button>
          </div>
          <FormError message={error} />
        </>
      )}
    </li>
  );
}
