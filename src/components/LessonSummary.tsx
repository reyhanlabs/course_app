import type { Lesson } from '../types';

const FIELDS: [keyof Lesson, string][] = [
  ['objective', 'Tujuan'],
  ['vocabulary', 'Vocabulary'],
  ['grammar', 'Grammar'],
  ['speaking', 'Speaking'],
  ['listening', 'Listening'],
  ['reading', 'Reading'],
  ['writing', 'Writing'],
  ['activities', 'Aktivitas'],
  ['homework', 'PR'],
  ['teachingNotes', 'Catatan mengajar'],
];

export function LessonSummary({ lesson }: { lesson: Lesson }) {
  const filled = FIELDS.filter(([key]) => String(lesson[key] ?? '').trim());
  if (filled.length === 0) return <p className="text-sm text-ink-500">Isi pelajaran belum dilengkapi.</p>;
  return (
    <dl className="space-y-3 text-sm">
      {filled.map(([key, label]) => (
        <div key={key}>
          <dt className="font-semibold">{label}</dt>
          <dd className="whitespace-pre-line text-ink-700">{String(lesson[key])}</dd>
        </div>
      ))}
    </dl>
  );
}
