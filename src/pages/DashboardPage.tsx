import { Link, Navigate } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { AlertCircle, CalendarPlus, FilePlus2, GraduationCap, Hourglass, School, UserPlus, Users, Wallet } from 'lucide-react';
import { useProfile } from '../auth/AuthContext';
import { TodaySessions } from '../components/TodaySessions';
import { LatestAnnouncements } from '../components/LatestAnnouncements';
import { Avatar, buttonClass, EmptyState, ErrorState, LoadingState, Panel, StatCard } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { outstandingSummary, revenueByMonth } from '../lib/finance';
import { currentMonth, formatDate, formatDateWithDay, formatMonth, formatRupiah, todayISO } from '../lib/format';
import { listClasses, listClassesOfTeacherUser } from '../services/classes';
import { countDocs } from '../services/db';
import { listInvoices } from '../services/invoices';
import { listPayments } from '../services/payments';
import { countStudentsInClass } from '../services/students';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Sapaan di atas dashboard, dengan pintasan tindakan yang paling sering dipakai. */
function Welcome({ actions }: { actions?: React.ReactNode }) {
  const profile = useProfile();
  return (
    <section className="notebook-light mb-7 flex flex-col gap-5 rounded-2xl border border-ink-100 bg-white px-6 py-6 shadow-[0_1px_2px_rgba(23,32,64,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div>
        <p className="text-sm font-medium text-ink-500">{formatDateWithDay(todayISO())}</p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight sm:text-[28px]">
          {greeting()}, {profile.displayName.split(' ')[0]}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

function AdminOwnerDashboard({ isAdmin }: { isAdmin: boolean }) {
  const { data, error, reload } = useAsync(async () => {
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
    const recentPayments = payments.filter((p) => p.status === 'verified').slice(0, 6);
    const pending = payments.filter((p) => p.status === 'pending');
    return { students, classes, teachers, classList, revenue, summary, recentPayments, pending };
  }, []);

  const actions = isAdmin && (
    <>
      <Link to="/students" className={buttonClass('secondary')}>
        <UserPlus className="h-4 w-4" /> Siswa
      </Link>
      <Link to="/sessions" className={buttonClass('secondary')}>
        <CalendarPlus className="h-4 w-4" /> Sesi
      </Link>
      <Link to="/invoices/new" className={buttonClass('primary')}>
        <FilePlus2 className="h-4 w-4" /> Buat tagihan
      </Link>
    </>
  );

  if (error)
    return (
      <>
        <Welcome actions={actions} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  if (!data)
    return (
      <>
        <Welcome actions={actions} />
        <LoadingState />
      </>
    );

  return (
    <>
      <Welcome actions={actions} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Siswa aktif" value={data.students} to="/students" tone="blue" />
        <StatCard icon={School} label="Kelas aktif" value={data.classes} to="/classes" tone="green" />
        <StatCard icon={Users} label="Guru aktif" value={data.teachers} to={isAdmin ? '/teachers' : undefined} tone="gray" />
        <StatCard
          icon={Wallet}
          label={`Pendapatan ${formatMonth(currentMonth())}`}
          value={formatRupiah(data.revenue.total)}
          hint={`Per sesi ${formatRupiah(data.revenue.perSession)}, bulanan ${formatRupiah(data.revenue.monthly)}`}
          to="/finance"
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <TodaySessions classes={data.classList} onlyTheseClasses={false} />
          <Panel
            title="Pembayaran terbaru"
            actions={
              <Link to="/payments" className="text-sm font-semibold text-brand-600 hover:underline">
                Semua pembayaran
              </Link>
            }
          >
            {data.recentPayments.length === 0 ? (
              <EmptyState icon={Wallet} title="Belum ada pembayaran" description="Pembayaran yang diverifikasi akan muncul di sini." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.recentPayments.map((p) => (
                  <li key={p.id}>
                    <Link to={`/invoices/${p.invoiceId}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ink-50/70">
                      <Avatar name={p.studentName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.studentName}</span>
                        <span className="text-xs text-ink-500">
                          {formatDate(p.paymentDate)}, {p.invoiceNumber}
                        </span>
                      </span>
                      <span className="font-bold text-emerald-700">+{formatRupiah(p.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Perlu perhatian">
            <ul className="divide-y divide-ink-100 text-sm">
              <AttentionRow
                to="/invoices?status=overdue"
                icon={AlertCircle}
                tone={data.summary.overdue.length ? 'text-rose-600 bg-rose-50' : 'text-ink-400 bg-ink-100'}
                title={`${data.summary.overdue.length} tagihan terlambat`}
                sub={formatRupiah(data.summary.overdueAmount)}
              />
              <AttentionRow
                to="/payments?status=pending"
                icon={Hourglass}
                tone={data.pending.length ? 'text-amber-700 bg-marker-soft' : 'text-ink-400 bg-ink-100'}
                title={`${data.pending.length} pembayaran menunggu verifikasi`}
                sub={formatRupiah(data.pending.reduce((s, p) => s + p.amount, 0))}
              />
              <AttentionRow
                to="/invoices?status=unpaid"
                icon={Wallet}
                tone="text-brand-600 bg-brand-50"
                title={`${data.summary.open.length} tagihan belum lunas`}
                sub={`Sisa ${formatRupiah(data.summary.outstanding)}`}
              />
            </ul>
          </Panel>
          <LatestAnnouncements />
        </div>
      </div>
    </>
  );
}

function AttentionRow({ to, icon: Icon, tone, title, sub }: { to: string; icon: typeof Wallet; tone: string; title: string; sub: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/70">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="text-xs text-ink-500">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

function TeacherDashboard({ uid }: { uid: string }) {
  const { data, error, reload } = useAsync(async () => {
    const classes = await listClassesOfTeacherUser(uid);
    const counts = await Promise.all(classes.map((c) => countStudentsInClass(c.id)));
    return classes.map((c, i) => ({ ...c, studentCount: counts[i] }));
  }, [uid]);

  const actions = (
    <>
      <Link to="/sessions" className={buttonClass('primary')}>
        <CalendarPlus className="h-4 w-4" /> Isi absensi
      </Link>
      <Link to="/homework" className={buttonClass('secondary')}>
        <FilePlus2 className="h-4 w-4" /> Buat PR
      </Link>
    </>
  );

  if (error)
    return (
      <>
        <Welcome actions={actions} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  if (!data)
    return (
      <>
        <Welcome actions={actions} />
        <LoadingState />
      </>
    );
  const totalStudents = data.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <>
      <Welcome actions={actions} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={School} label="Kelas yang saya ajar" value={data.length} to="/my-classes" tone="blue" />
        <StatCard icon={GraduationCap} label="Total siswa" value={totalStudents} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TodaySessions classes={data} onlyTheseClasses />
        </div>
        <div className="space-y-4">
          <Panel title="Kelas saya">
            {data.length === 0 ? (
              <EmptyState icon={School} title="Belum ada kelas" description="Admin belum menugaskan kelas untuk Anda." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.map((c) => (
                  <li key={c.id}>
                    <Link to={`/classes/${c.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-ink-50/70">
                      <span className="font-semibold">{c.className}</span>
                      <span className="text-ink-500">{c.studentCount} siswa</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <LatestAnnouncements />
        </div>
      </div>
    </>
  );
}

export function DashboardPage() {
  const profile = useProfile();
  if (profile.role === 'parent') return <Navigate to="/my-children" replace />;
  if (profile.role === 'teacher') return <TeacherDashboard uid={profile.id} />;
  return <AdminOwnerDashboard isAdmin={profile.role === 'admin'} />;
}
