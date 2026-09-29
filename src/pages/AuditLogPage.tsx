import { useState } from 'react';
import { limit, orderBy } from 'firebase/firestore';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../lib/format';
import { listDocs } from '../services/db';
import { listUsers } from '../services/users';
import type { Timestamp } from 'firebase/firestore';

interface AuditRow {
  id: string;
  userId: string;
  action: string;
  module: string;
  recordId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp?: Timestamp;
}

const actionLabels: Record<string, string> = {
  student_class_changed: 'Kelas siswa diubah',
  class_teacher_changed: 'Guru kelas diubah',
  user_account_created: 'Akun dibuat',
  user_status_changed: 'Status akun diubah',
  billing_rate_changed: 'Tarif diubah',
  billing_type_changed: 'Jenis tagihan diubah',
  invoice_created: 'Tagihan dibuat',
  invoice_edited: 'Tagihan diubah',
  invoice_issued: 'Tagihan diterbitkan',
  invoice_cancelled: 'Tagihan dibatalkan',
  payment_created: 'Pembayaran dicatat',
  payment_verified: 'Pembayaran diverifikasi',
  payment_rejected: 'Pembayaran ditolak',
};

export function AuditLogPage() {
  const [filter, setFilter] = useState('');
  const { data, error, reload } = useAsync(
    async () => Promise.all([listDocs<AuditRow>('auditLogs', orderBy('timestamp', 'desc'), limit(300)), listUsers().catch(() => [])]),
    [],
  );
  const [open, setOpen] = useState<string | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  const [rows, users] = data;
  const userName = new Map(users.map((u) => [u.id, u.displayName]));
  const shown = rows.filter((r) => !filter || r.action === filter);

  return (
    <>
      <PageHeader title="Log Aktivitas" description="300 perubahan penting terakhir. Log tidak bisa diubah atau dihapus." />
      <Panel
        actions={
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter aksi">
            <option value="">Semua aksi</option>
            {Object.entries(actionLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        }
        title={`${shown.length} catatan`}
      >
        {shown.length === 0 ? (
          <EmptyState title="Belum ada aktivitas" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {shown.map((r) => (
              <li key={r.id} className="px-4 py-2.5 text-sm">
                <button type="button" className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <span className="w-28 text-ink-500">
                    {formatDate(r.timestamp ?? null)} {r.timestamp ? r.timestamp.toDate().toTimeString().slice(0, 5) : ''}
                  </span>
                  <Badge tone="blue">{actionLabels[r.action] ?? r.action}</Badge>
                  <span className="flex-1 text-ink-700">{userName.get(r.userId) ?? r.userId}</span>
                  <span className="text-xs text-ink-400">{open === r.id ? 'Tutup' : 'Detail'}</span>
                </button>
                {open === r.id && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <pre className="overflow-x-auto rounded-lg bg-ink-50 p-2 text-xs">Sebelum: {JSON.stringify(r.oldData, null, 2)}</pre>
                    <pre className="overflow-x-auto rounded-lg bg-ink-50 p-2 text-xs">Sesudah: {JSON.stringify(r.newData, null, 2)}</pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
