import type { Level, Student } from '../types';
import { formatDate } from '../lib/format';
import { studentStatusLabels } from '../lib/labels';
import { Avatar, Badge } from './ui';

export function ChildCard({ student, levels }: { student: Student; levels: Level[] }) {
  const level = levels.find((l) => l.id === student.currentLevelId);
  const status = studentStatusLabels[student.status];
  return (
    <article className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(23,32,64,0.04)]">
      <div className="notebook h-16 bg-ink-900" aria-hidden />
      <div className="-mt-10 px-5 pb-5">
      <div className="flex items-end gap-4">
        <Avatar name={student.fullName} url={student.photoUrl} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight">{student.fullName}</h2>
          {student.nickname && <p className="text-sm text-ink-500">Panggilan: {student.nickname}</p>}
          <div className="mt-1">
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-ink-100 pt-4 text-sm">
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
      </div>
    </article>
  );
}
