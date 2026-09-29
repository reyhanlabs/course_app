import { Link, Navigate } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useProfile } from '../auth/AuthContext';
import { TodaySessions } from '../components/TodaySessions';
import { LatestAnnouncements } from '../components/LatestAnnouncements';
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate, todayISO } from '../lib/format';
import { listClasses, listClassesOfTeacherUser } from '../services/classes';
import { countDocs } from '../services/db';
import { listInvoices } from '../services/invoices';
import { listPayments } from '../services/payments';
import { outstandingSummary, revenueByMonth } from '../lib/finance';
import { currentMonth, formatRupiah } from '../lib/format';
import { countStudentsInClass } from '../services/students';

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
    const [students, classes, teachers, classList, invoices, payments] = await Promise.all([
      countDocs('students', active),
      countDocs('classes', active),
      countDocs('teachers', active),
      listClasses(),
      listInvoices(),
      listPayments(),
    ]);
    const revenue = revenueByMonth(payments, [currentMonth()])[0];
    const summary = outstandingSummary(invoices, todayISO());
    const recentPayments = payments.filter((p) => p.status === 'verified').slice(0, 5);
    const pending = payments.filter((p) => p.status === 'pending').length;
    return { students, classes, teachers, classList, revenue, summary, recentPayments, pending };
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
      <div className="mt-6">
        <TodaySessions classes={data.classList} onlyTheseClasses={false} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link to="/finance" className="block rounded-xl border border-ink-100 bg-white p-5 hover:border-brand-100">
          <p className="text-sm text-ink-500">Pendapatan bulan ini</p>
          <p className="mt-1 text-2xl font-bold">{formatRupiah(data.revenue.total)}</p>
          <p className="mt-1 text-xs text-ink-500">
            Per sesi {formatRupiah(data.revenue.perSession)} · Bulanan {formatRupiah(data.revenue.monthly)}
          </p>
        </Link>
        <Link to="/invoices?status=unpaid" className="block rounded-xl border border-ink-100 bg-white p-5 hover:border-brand-100">
          <p className="text-sm text-ink-500">Tagihan belum lunas</p>
          <p className="mt-1 text-2xl font-bold">{formatRupiah(data.summary.outstanding)}</p>
          <p className="mt-1 text-xs text-ink-500">{data.summary.open.length} tagihan</p>
        </Link>
        <Link to="/invoices?status=overdue" className="block rounded-xl border border-ink-100 bg-white p-5 hover:border-brand-100">
          <p className="text-sm text-ink-500">Terlambat</p>
          <p className={`mt-1 text-2xl font-bold ${data.summary.overdue.length ? 'text-rose-700' : ''}`}>{data.summary.overdue.length} tagihan</p>
          <p className="mt-1 text-xs text-ink-500">
            {formatRupiah(data.summary.overdueAmount)}
            {data.pending > 0 && ` · ${data.pending} pembayaran menunggu verifikasi`}
          </p>
        </Link>
      </div>
      <Panel className="mt-6" title="Pembayaran terbaru">
        {data.recentPayments.length === 0 ? (
          <EmptyState title="Belum ada pembayaran" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.recentPayments.map((p) => (
              <li key={p.id}>
                <Link to={`/invoices/${p.invoiceId}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50">
                  <span className="w-24">{formatDate(p.paymentDate)}</span>
                  <span className="flex-1">{p.studentName}</span>
                  <span className="font-semibold">{formatRupiah(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
      <div className="mt-6">
        <TodaySessions classes={data} onlyTheseClasses />
      </div>
      <div className="mt-6">
        <LatestAnnouncements />
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

export function DashboardPage() {
  const profile = useProfile();
  return (
    <>
      <PageHeader title={`Halo, ${profile.displayName.split(' ')[0]}`} description={`Hari ini ${formatDate(todayISO())}`} />
      {profile.role === 'admin' && <AdminOwnerDashboard isAdmin />}
      {profile.role === 'owner' && <AdminOwnerDashboard isAdmin={false} />}
      {profile.role === 'teacher' && <TeacherDashboard uid={profile.id} />}
      {profile.role === 'parent' && <Navigate to="/my-children" replace />}
    </>
  );
}
