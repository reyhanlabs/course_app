import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useProfile } from '../auth/AuthContext';
import { ClassSelect } from '../components/ClassSelect';
import { ProgressHistory } from '../components/ProgressHistory';
import { Avatar, Button, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, Panel, Table, cn } from '../components/ui';
import { useAccessibleClasses } from '../hooks/useAccessibleClasses';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { formatDate, todayISO } from '../lib/format';
import { scoreLabels, skillLabels } from '../lib/labels';
import { averageScore, createProgress, listProgressOfClass } from '../services/progress';
import { listStudentsInClass } from '../services/students';
import { SKILLS, type ProgressRecord, type SkillScores, type Student } from '../types';

export function ProgressPage() {
  const classesState = useAccessibleClasses();
  const classes = (classesState.data ?? []).filter((c) => c.status === 'active');
  const [classId, setClassId] = useState('');
  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const data = useAsync(
    async () => (classId ? Promise.all([listStudentsInClass(classId), listProgressOfClass(classId)]) : null),
    [classId],
  );
  const [assessTarget, setAssessTarget] = useState<Student | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Student | null>(null);

  const [students, records] = data.data ?? [[], []];
  const byStudent = useMemo(() => {
    const map = new Map<string, ProgressRecord[]>();
    for (const r of records) map.set(r.studentId, [...(map.get(r.studentId) ?? []), r]);
    return map;
  }, [records]);

  if (classesState.error) return <ErrorState message={classesState.error} onRetry={classesState.reload} />;
  if (!classesState.data) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Perkembangan Siswa"
        description="Nilai 1–5 per keterampilan. Setiap penilaian disimpan sebagai riwayat dan tidak pernah menimpa penilaian lama."
      />
      <div className="mb-4">
        <ClassSelect classes={classes} value={classId} onChange={setClassId} />
      </div>
      {data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        classId ? <LoadingState /> : <Panel><EmptyState title="Pilih kelas" /></Panel>
      ) : students.length === 0 ? (
        <Panel>
          <EmptyState title="Belum ada siswa di kelas ini" />
        </Panel>
      ) : (
        <Panel>
          <Table head={['Siswa', 'Penilaian terakhir', 'Rata-rata', 'Jumlah', '']}>
            {students.map((s) => {
              const history = byStudent.get(s.id) ?? [];
              const last = history[0];
              const avg = last ? averageScore(last.scores) : null;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.fullName} url={s.photoUrl} />
                      <span className="font-semibold">{s.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{last ? formatDate(last.assessedAt) : <span className="text-ink-400">Belum pernah</span>}</td>
                  <td className="px-4 py-3 font-semibold">{avg !== null ? avg.toFixed(1) : '-'}</td>
                  <td className="px-4 py-3">{history.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {history.length > 0 && (
                      <Button variant="ghost" onClick={() => setHistoryTarget(s)}>
                        Riwayat
                      </Button>
                    )}
                    <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setAssessTarget(s)}>
                      Beri nilai
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}

      <AssessModal open={assessTarget !== null} student={assessTarget} classId={classId} onClose={() => setAssessTarget(null)} onSaved={data.reload} />
      <Modal open={historyTarget !== null} wide title={`Riwayat perkembangan: ${historyTarget?.fullName ?? ''}`} onClose={() => setHistoryTarget(null)}>
        {historyTarget && <ProgressHistory records={byStudent.get(historyTarget.id) ?? []} />}
      </Modal>
    </>
  );
}

function AssessModal({
  open,
  student,
  classId,
  onClose,
  onSaved,
}: {
  open: boolean;
  student: Student | null;
  classId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const profile = useProfile();
  const [date, setDate] = useState(todayISO());
  const [scores, setScores] = useState<SkillScores>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setScores({});
      setNotes('');
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!student) return;
    setBusy(true);
    setError(null);
    try {
      await createProgress({ studentId: student.id, studentName: student.fullName, classId, assessedAt: date, scores, notes }, profile);
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
      title={`Penilaian: ${student?.fullName ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="assess-form" loading={busy}>
            Simpan penilaian
          </Button>
        </>
      }
    >
      <form id="assess-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Tanggal penilaian" required>
          <input className="input sm:w-48" type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {SKILLS.map((skill) => (
            <div key={skill} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <span className="flex-1 text-sm font-medium">{skillLabels[skill]}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={skillLabels[skill]}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = scores[skill] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={scoreLabels[n]}
                      onClick={() => setScores((s) => ({ ...s, [skill]: active ? null : n }))}
                      className={cn(
                        'h-8 w-8 rounded-md border text-sm font-semibold',
                        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white hover:bg-ink-50',
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-500">1 = perlu banyak bimbingan, 3 = cukup, 5 = sangat baik. Keterampilan yang tidak dinilai boleh dikosongkan.</p>
        <Field label="Catatan untuk orang tua">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
