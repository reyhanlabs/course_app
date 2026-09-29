import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Pencil, Unlink } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { ClassChangeModal } from '../components/ClassChangeModal';
import { StudentFormModal } from '../components/StudentFormModal';
import { ProgressHistory } from '../components/ProgressHistory';
import { isPresent, listAttendanceOfStudent } from '../services/attendance';
import { listProgressOfStudent } from '../services/progress';
import { listInvoicesOfStudent } from '../services/invoices';
import { effectiveStatus } from '../lib/billing';
import { billingTypeLabels, invoiceStatusLabels } from '../lib/labels';
import { formatMonth, formatRupiah, todayISO } from '../lib/format';
import { attendanceStatusLabels } from '../lib/labels';
import { percent } from '../lib/format';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
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
import { ageFromDate, formatDate } from '../lib/format';
import { genderLabels, studentStatusLabels } from '../lib/labels';
import { listClasses } from '../services/classes';
import { listLevels } from '../services/levels';
import { getParent, listParents } from '../services/parents';
import { getStudent, linkParent, listEnrollmentsOfStudent, unlinkParent } from '../services/students';
import type { Parent } from '../types';

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const isAdmin = profile.role === 'admin';

  const { data, loading, error, reload } = useAsync(async () => {
    const student = await getStudent(id);
    if (!student) throw new Error('Siswa tidak ditemukan.');
    const [levels, classes, enrollments, attendance, progress] = await Promise.all([
      listLevels(),
      listClasses(),
      listEnrollmentsOfStudent(id),
      listAttendanceOfStudent(id),
      listProgressOfStudent(id),
    ]);
    const invoices = await listInvoicesOfStudent(id);
    // Data orang tua hanya bisa dibaca admin (lihat firestore.rules).
    const parents = isAdmin
      ? (await Promise.all(student.parentIds.map((pid) => getParent(pid)))).filter((p): p is Parent => p !== null)
      : [];
    return { student, levels, classes, enrollments, parents, attendance, progress, invoices };
  }, [id, isAdmin]);

  const [editOpen, setEditOpen] = useState(false);
  const [classMode, setClassMode] = useState<'move' | 'remove' | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<Parent | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const { student, levels, classes, enrollments, parents, attendance, progress, invoices } = data;
  const presentCount = attendance.filter((a) => isPresent(a.status)).length;
  const classNames = new Map(classes.map((c) => [c.id, c.className]));
  const levelName = (lid: string | null) => levels.find((l) => l.id === lid)?.name ?? '-';
  const status = studentStatusLabels[student.status];
  const age = ageFromDate(student.dateOfBirth);

  return (
    <>
      <Link to="/students" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Daftar siswa
      </Link>
      <PageHeader
        title={student.fullName}
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Ubah data
            </Button>
          )
        }
      />
      {loading && <p className="mb-3 text-xs text-ink-500">Memperbarui…</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Profil" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-2 px-4 pt-5">
            <Avatar name={student.fullName} url={student.photoUrl} size="lg" />
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <dl className="divide-y divide-ink-100 px-4 py-3">
            <DetailRow label="Panggilan" value={student.nickname} />
            <DetailRow label="Jenis kelamin" value={genderLabels[student.gender]} />
            <DetailRow
              label="Tanggal lahir"
              value={student.dateOfBirth ? `${formatDate(student.dateOfBirth)}${age !== null ? ` (${age} tahun)` : ''}` : '-'}
            />
            <DetailRow label="Sekolah" value={[student.school, student.schoolGrade].filter(Boolean).join(', ')} />
            <DetailRow label="Alamat" value={student.address} />
            <DetailRow label="Mulai kursus" value={formatDate(student.startDate)} />
            <DetailRow label="Catatan" value={student.notes} />
          </dl>
        </Panel>

        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Kelas saat ini"
            actions={
              isAdmin && (
                <div className="flex gap-2">
                  {student.currentClassId && (
                    <Button variant="secondary" onClick={() => setClassMode('remove')}>
                      Keluarkan
                    </Button>
                  )}
                  <Button onClick={() => setClassMode('move')}>{student.currentClassId ? 'Pindah kelas' : 'Masukkan ke kelas'}</Button>
                </div>
              )
            }
          >
            <div className="grid grid-cols-2 gap-4 px-4 py-4 text-sm">
              <div>
                <p className="text-ink-500">Kelas</p>
                {student.currentClassId ? (
                  <Link to={`/classes/${student.currentClassId}`} className="font-semibold text-brand-600 hover:underline">
                    {student.currentClassName}
                  </Link>
                ) : (
                  <p className="font-semibold">Belum ada kelas</p>
                )}
              </div>
              <div>
                <p className="text-ink-500">Level</p>
                <p className="font-semibold">{levelName(student.currentLevelId)}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Riwayat kelas">
            {enrollments.length === 0 ? (
              <EmptyState title="Belum ada riwayat kelas" />
            ) : (
              <Table head={['Kelas', 'Level', 'Masuk', 'Keluar', 'Catatan']}>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium">
                      {e.className} {e.status === 'active' && <Badge tone="green">Saat ini</Badge>}
                    </td>
                    <td className="px-4 py-3">{levelName(e.levelId)}</td>
                    <td className="px-4 py-3">{formatDate(e.startDate)}</td>
                    <td className="px-4 py-3">{formatDate(e.endDate)}</td>
                    <td className="px-4 py-3 text-ink-500">{e.note || '-'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel
            title="Absensi"
            actions={
              attendance.length > 0 && (
                <span className="text-sm text-ink-500">
                  Hadir {presentCount} dari {attendance.length} sesi ({percent(presentCount, attendance.length)})
                </span>
              )
            }
          >
            {attendance.length === 0 ? (
              <EmptyState title="Belum ada data absensi" />
            ) : (
              <Table head={['Tanggal', 'Kelas', 'Status', 'Catatan']}>
                {attendance.slice(0, 10).map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2">
                      <Link to={`/sessions/${a.sessionId}`} className="text-brand-600 hover:underline">
                        {formatDate(a.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{classNames.get(a.classId) ?? '-'}</td>
                    <td className="px-4 py-2">
                      <Badge tone={attendanceStatusLabels[a.status].tone}>{attendanceStatusLabels[a.status].label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-ink-500">{a.notes || '-'}</td>
                  </tr>
                ))}
              </Table>
            )}
            {attendance.length > 10 && <p className="px-4 py-2 text-xs text-ink-500">Menampilkan 10 sesi terakhir.</p>}
          </Panel>

          <Panel title="Tagihan">
            {invoices.length === 0 ? (
              <EmptyState title="Belum ada tagihan" />
            ) : (
              <Table head={['Nomor', 'Periode', 'Jenis', 'Total', 'Sisa', 'Status']}>
                {invoices.map((inv) => {
                  const st = invoiceStatusLabels[effectiveStatus(inv, todayISO())];
                  return (
                    <tr key={inv.id}>
                      <td className="whitespace-nowrap px-4 py-2">
                        <Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">
                          {inv.invoiceNumber ?? 'Draft'}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{formatMonth(inv.periodStart.slice(0, 7))}</td>
                      <td className="px-4 py-2">{billingTypeLabels[inv.billingType]}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatRupiah(inv.total)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{inv.status === 'cancelled' ? '-' : formatRupiah(inv.outstandingAmount)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Panel>

          <Panel title="Perkembangan">
            <ProgressHistory records={progress} classNames={classNames} />
          </Panel>

          {isAdmin && (
            <Panel
              title="Orang tua / wali"
              actions={
                <Button variant="secondary" onClick={() => setLinkOpen(true)}>
                  <Link2 className="h-4 w-4" /> Hubungkan
                </Button>
              }
            >
              {parents.length === 0 ? (
                <EmptyState title="Belum ada orang tua terhubung" description="Hubungkan orang tua agar mereka bisa melihat data anak di portal." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {parents.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold">
                          {p.fullName} <span className="font-normal text-ink-500">({p.relationship || 'Orang tua'})</span>
                        </p>
                        <p className="text-ink-500">{[p.whatsapp || p.phone, p.email].filter(Boolean).join(' / ') || 'Kontak belum diisi'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={p.userId ? 'green' : 'gray'}>{p.userId ? 'Punya akun' : 'Belum ada akun'}</Badge>
                        <Button variant="ghost" onClick={() => setUnlinkTarget(p)} aria-label={`Lepas ${p.fullName}`}>
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      <StudentFormModal open={editOpen} student={student} levels={levels} onClose={() => setEditOpen(false)} onSaved={reload} />
      <ClassChangeModal
        open={classMode !== null}
        mode={classMode ?? 'move'}
        studentId={student.id}
        studentName={student.fullName}
        currentClassId={student.currentClassId}
        classes={classes}
        levels={levels}
        onClose={() => setClassMode(null)}
        onDone={reload}
      />
      <LinkParentModal
        open={linkOpen}
        studentId={student.id}
        linkedIds={student.parentIds}
        onClose={() => setLinkOpen(false)}
        onDone={reload}
      />
      <ConfirmDialog
        open={unlinkTarget !== null}
        title="Lepas hubungan orang tua"
        message={
          <>
            <strong>{unlinkTarget?.fullName}</strong> tidak akan bisa lagi melihat data {student.fullName} di portal orang tua.
          </>
        }
        confirmLabel="Lepas"
        danger
        onConfirm={async () => {
          if (unlinkTarget) await unlinkParent(student.id, unlinkTarget);
          reload();
        }}
        onClose={() => setUnlinkTarget(null)}
      />
    </>
  );
}

function LinkParentModal({
  open,
  studentId,
  linkedIds,
  onClose,
  onDone,
}: {
  open: boolean;
  studentId: string;
  linkedIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { data, error: loadError } = useAsync(() => (open ? listParents() : Promise.resolve([])), [open]);
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = (data ?? []).filter((p) => !linkedIds.includes(p.id));

  async function submit() {
    const parent = options.find((p) => p.id === parentId);
    if (!parent) return setError('Pilih orang tua terlebih dahulu.');
    setBusy(true);
    setError(null);
    try {
      await linkParent(studentId, parent);
      setParentId('');
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Hubungkan orang tua"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} loading={busy} disabled={!parentId}>
            Hubungkan
          </Button>
        </>
      }
    >
      <Field label="Orang tua" hint="Belum ada di daftar? Tambahkan dulu di menu Orang Tua.">
        <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{data ? 'Pilih orang tua' : 'Memuat…'}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.whatsapp || p.phone ? ` — ${p.whatsapp || p.phone}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <FormError message={loadError ?? error} />
    </Modal>
  );
}
