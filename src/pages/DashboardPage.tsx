import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useProfile } from '../auth/AuthContext';
import { ChildCard } from '../components/ChildCard';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, todayISO } from '../lib/format';
import { listClassesOfTeacherUser } from '../services/classes';
import { countDocs } from '../services/db';
import { listLevels } from '../services/levels';
import { countStudentsInClass, listStudentsOfParentUser } from '../services/students';

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-xl border border-ink-100 bg-white p-5 hover:border-brand-100">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-ink-100 bg-white p-5">{body}</div>
  );
}

function AdminOwnerDashboard({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const active = where('status', '==', 'active');
    const [students, classes, teachers] = await Promise.all([
      countDocs('students', active),
      countDocs('classes', active),
      countDocs('teachers', active),
    ]);
    return { students, classes, teachers };
  }, []);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || loading) return <LoadingState />;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Siswa aktif" value={data.students} to="/students" />
        <Stat label="Kelas aktif" value={data.classes} to="/classes" />
        <Stat label="Guru aktif" value={data.teachers} to={isAdmin ? '/teachers' : undefined} />
      </div>
      <Panel className="mt-6" title="Tahap pengembangan">
        <p className="px-4 py-4 text-sm text-ink-500">
          Sesi hari ini, absensi, pendapatan bulan ini, dan tagihan tertunggak akan tampil di sini setelah modul Jadwal &amp; Sesi
          (Fase 2) dan Keuangan (Fase 3) selesai.
        </p>
      </Panel>
    </>
  );
}

function TeacherDashboard({ uid }: { uid: string }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const classes = await listClassesOfTeacherUser(uid);
    const counts = await Promise.all(classes.map((c) => countStudentsInClass(c.id)));
    return classes.map((c, i) => ({ ...c, studentCount: counts[i] }));
  }, [uid]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || loading) return <LoadingState />;
  const totalStudents = data.reduce((sum, c) => sum + c.studentCount, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Kelas yang saya ajar" value={data.length} to="/my-classes" />
        <Stat label="Total siswa" value={totalStudents} />
      </div>
      <Panel className="mt-6" title="Kelas saya">
        {data.length === 0 ? (
          <EmptyState title="Belum ada kelas" description="Admin belum menugaskan kelas untuk Anda." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.map((c) => (
              <li key={c.id}>
                <Link to={`/classes/${c.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-ink-50">
                  <span className="font-medium">{c.className}</span>
                  <span className="text-ink-500">{c.studentCount} siswa</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ParentDashboard({ uid }: { uid: string }) {
  const { data, loading, error, reload } = useAsync(
    async () => Promise.all([listStudentsOfParentUser(uid), listLevels()]),
    [uid],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || loading) return <LoadingState />;
  const [children, levels] = data;
  if (children.length === 0) {
    return (
      <Panel>
        <EmptyState title="Belum ada data anak" description="Data anak Anda belum dihubungkan ke akun ini. Hubungi admin kursus." />
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {children.map((s) => (
        <ChildCard key={s.id} student={s} levels={levels} />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const profile = useProfile();
  return (
    <>
      <PageHeader title={`Halo, ${profile.displayName.split(' ')[0]}`} description={`Hari ini ${formatDate(todayISO())}`} />
      {profile.role === 'admin' && <AdminOwnerDashboard isAdmin />}
      {profile.role === 'owner' && <AdminOwnerDashboard isAdmin={false} />}
      {profile.role === 'teacher' && <TeacherDashboard uid={profile.id} />}
      {profile.role === 'parent' && <ParentDashboard uid={profile.id} />}
    </>
  );
}
