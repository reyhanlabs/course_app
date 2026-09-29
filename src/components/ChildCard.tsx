import type { Level, Student } from '../types';
import { formatDate } from '../lib/format';
import { studentStatusLabels } from '../lib/labels';
import { Avatar, Badge } from './ui';

export function ChildCard({ student, levels }: { student: Student; levels: Level[] }) {
  const level = levels.find((l) => l.id === student.currentLevelId);
  const status = studentStatusLabels[student.status];
  return (
    <article className="rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex items-center gap-4">
        <Avatar name={student.fullName} url={student.photoUrl} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{student.fullName}</h2>
          {student.nickname && <p className="text-sm text-ink-500">Panggilan: {student.nickname}</p>}
          <div className="mt-1">
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-500">Kelas</dt>
          <dd className="font-medium">{student.currentClassName ?? 'Belum ada kelas'}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Level</dt>
          <dd className="font-medium">{level?.name ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Sekolah</dt>
          <dd className="font-medium">{[student.school, student.schoolGrade].filter(Boolean).join(', ') || '-'}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Mulai kursus</dt>
          <dd className="font-medium">{formatDate(student.startDate)}</dd>
        </div>
      </dl>
    </article>
  );
}
