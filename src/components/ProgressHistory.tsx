import { formatDate } from '../lib/format';
import { skillLabels } from '../lib/labels';
import { averageScore } from '../services/progress';
import { SKILLS, type ProgressRecord } from '../types';
import { EmptyState, Table } from './ui';

/** Tabel riwayat penilaian — setiap baris satu penilaian, terbaru di atas. */
export function ProgressHistory({ records, classNames }: { records: ProgressRecord[]; classNames?: Map<string, string> }) {
  if (records.length === 0) return <EmptyState title="Belum ada penilaian" />;
  return (
    <Table head={['Tanggal', ...(classNames ? ['Kelas'] : []), ...SKILLS.map((s) => skillLabels[s].slice(0, 5)), 'Rata-rata', 'Catatan']}>
      {records.map((r) => {
        const avg = averageScore(r.scores);
        return (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-2">
              {formatDate(r.assessedAt)}
              <span className="block text-xs text-ink-500">{r.recordedByName}</span>
            </td>
            {classNames && <td className="px-4 py-2">{classNames.get(r.classId) ?? '-'}</td>}
            {SKILLS.map((s) => (
              <td key={s} className="px-2 py-2 text-center font-semibold">
                {r.scores[s] ?? <span className="font-normal text-ink-300">–</span>}
              </td>
            ))}
            <td className="px-4 py-2 font-semibold">{avg !== null ? avg.toFixed(1) : '-'}</td>
            <td className="max-w-xs px-4 py-2 text-ink-700">{r.notes || '-'}</td>
          </tr>
        );
      })}
    </Table>
  );
}
