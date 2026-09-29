import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useProfile } from '../auth/AuthContext';
import { ClassChangeModal } from '../components/ClassChangeModal';
import { ClassFormModal } from '../components/ClassFormModal';
import {
  Avatar,
  Badge,
  Button,
  DetailRow,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  LoadingState,
  Modal,
  PageHeader,
  Panel,
  Table,
} from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { ageFromDate, formatDate, todayISO } from '../lib/format';
import { activeStatusLabels } from '../lib/labels';
import { getClass } from '../services/classes';
import { listDocs } from '../services/db';
import { listLevels } from '../services/levels';
import { changeStudentClass, listStudents, listStudentsInClass } from '../services/students';
import { getTeacher, listTeachers } from '../services/teachers';
import { listSchedulesOfClasses } from '../services/schedules';
import { dayLabels } from '../lib/labels';
import type { ClassEnrollment, CourseClass, Student } from '../types';

export function ClassDetailPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  const { data, loading, error, reload } = useAsync(async () => {
    const courseClass = await getClass(id);
    if (!courseClass) throw new Error('Kelas tidak ditemukan.');
    const [levels, roster, enrollments, schedules] = await Promise.all([
      listLevels(),
      listStudentsInClass(id),
      listDocs<ClassEnrollment>('classEnrollments', where('classId', '==', id)),
      listSchedulesOfClasses([id]),
    ]);
    // Guru hanya boleh membaca data gurunya sendiri; admin & owner boleh semua.
    const teacherName = isTeacher
      ? profile.displayName
      : courseClass.teacherId
        ? ((await getTeacher(courseClass.teacherId))?.fullName ?? '-')
        : null;
    const teachers = isAdmin ? await listTeachers() : [];
    return { courseClass, levels, roster, enrollments, teacherName, teachers, schedules };
  }, [id, isAdmin, isTeacher]);

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { courseClass, levels, roster, enrollments, teacherName, teachers, schedules } = data;
  const level = levels.find((l) => l.id === courseClass.levelId);
  const st = activeStatusLabels[courseClass.status];
  const past = enrollments.filter((e) => e.status === 'ended').sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
  const joinedAt = new Map(enrollments.filter((e) => e.status === 'active').map((e) => [e.studentId, e.startDate]));

  return (
    <>
      <Link
        to={isTeacher ? '/my-classes' : '/classes'}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {isTeacher ? 'Kelas saya' : 'Daftar kelas'}
      </Link>
      <PageHeader
        title={courseClass.className}
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Ubah kelas
            </Button>
          )
        }
      />
      {loading && <p className="mb-3 text-xs text-ink-500">Memperbarui…</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Informasi kelas">
          <dl className="divide-y divide-ink-100 px-4 py-2">
            <DetailRow label="Level" value={level?.name} />
            <DetailRow label="Guru" value={teacherName ?? 'Belum ditentukan'} />
            <DetailRow
              label="Siswa"
              value={`${roster.length}${courseClass.capacity > 0 ? ` dari ${courseClass.capacity}` : ''}`}
            />
            <DetailRow label="Status" value={<Badge tone={st.tone}>{st.label}</Badge>} />
            <DetailRow
              label="Jadwal"
              value={
                schedules.filter((sc) => sc.status === 'active').length === 0 ? (
                  <span className="text-ink-500">Belum ada jadwal</span>
                ) : (
                  schedules
                    .filter((sc) => sc.status === 'active')
                    .map((sc) => (
                      <span key={sc.id} className="block">
                        {dayLabels[sc.dayOfWeek]} {sc.startTime}–{sc.endTime}
                      </span>
                    ))
                )
              }
            />
          </dl>
        </Panel>

        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Daftar siswa"
            actions={
              isAdmin &&
              courseClass.status === 'active' && (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Tambah siswa
                </Button>
              )
            }
          >
            {roster.length === 0 ? (
              <EmptyState title="Belum ada siswa di kelas ini" />
            ) : (
              <Table head={['Nama', 'Usia', 'Masuk kelas', ...(isAdmin ? [''] : [])]}>
                {roster.map((s) => {
                  const age = ageFromDate(s.dateOfBirth);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.fullName} url={s.photoUrl} />
                          <div>
                            {isTeacher ? (
                              <p className="font-semibold">{s.fullName}</p>
                            ) : (
                              <Link to={`/students/${s.id}`} className="font-semibold hover:underline">
                                {s.fullName}
                              </Link>
                            )}
                            {s.nickname && <p className="text-xs text-ink-500">{s.nickname}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{age !== null ? `${age} tahun` : '-'}</td>
                      <td className="px-4 py-3">{formatDate(joinedAt.get(s.id))}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" onClick={() => setRemoveTarget(s)} aria-label={`Keluarkan ${s.fullName}`}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Table>
            )}
          </Panel>

          {past.length > 0 && (
            <Panel title="Siswa yang pernah di kelas ini">
              <Table head={['Siswa', 'Masuk', 'Keluar', 'Catatan']}>
                {past.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      {isTeacher ? (
                        <span className="text-ink-500">Siswa lama</span>
                      ) : (
                        <Link to={`/students/${e.studentId}`} className="text-brand-600 hover:underline">
                          Lihat siswa
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(e.startDate)}</td>
                    <td className="px-4 py-3">{formatDate(e.endDate)}</td>
                    <td className="px-4 py-3 text-ink-500">{e.note || '-'}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </div>
      </div>

      {isAdmin && (
        <>
          <ClassFormModal
            open={editOpen}
            courseClass={courseClass}
            levels={levels}
            teachers={teachers}
            onClose={() => setEditOpen(false)}
            onSaved={reload}
          />
          <AddStudentModal open={addOpen} courseClass={courseClass} onClose={() => setAddOpen(false)} onDone={reload} />
          <ClassChangeModal
            open={removeTarget !== null}
            mode="remove"
            studentId={removeTarget?.id ?? ''}
            studentName={removeTarget?.fullName ?? ''}
            currentClassId={courseClass.id}
            classes={[]}
            levels={levels}
            onClose={() => setRemoveTarget(null)}
            onDone={reload}
          />
        </>
      )}
    </>
  );
}

function AddStudentModal({
  open,
  courseClass,
  onClose,
  onDone,
}: {
  open: boolean;
  courseClass: CourseClass;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: students } = useAsync(() => (open ? listStudents() : Promise.resolve([])), [open]);
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStudentId('');
      setDate(todayISO());
      setError(null);
    }
  }, [open]);

  const options = (students ?? []).filter((s) => s.status === 'active' && s.currentClassId !== courseClass.id);
  const selected = options.find((s) => s.id === studentId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await changeStudentClass(studentId, courseClass.id, date, '');
      onDone();
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
      title={`Tambah siswa ke ${courseClass.className}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="add-student-form" loading={busy} disabled={!studentId}>
            Tambahkan
          </Button>
        </>
      }
    >
      <form id="add-student-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Siswa aktif" required>
          <select className="input" required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">{students ? 'Pilih siswa' : 'Memuat…'}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.currentClassName ? ` (saat ini: ${s.currentClassName})` : ''}
              </option>
            ))}
          </select>
        </Field>
        {selected?.currentClassName && (
          <p className="rounded-lg bg-marker-soft/60 px-3 py-2 text-sm">
            {selected.fullName} akan dipindahkan dari {selected.currentClassName}. Riwayat kelas lamanya tetap tersimpan.
          </p>
        )}
        <Field label="Tanggal masuk kelas" required>
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </form>
      <FormError message={error} />
    </Modal>
  );
}
