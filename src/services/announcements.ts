import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Announcement, AnnouncementInput, Student, UserProfile } from '../types';
import { listDocs, required } from './db';
import { notifyUsers } from './notifications';

const COL = 'announcements';

function sortAnnouncements(rows: Announcement[]) {
  const t = (a: Announcement) => a.publishedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || t(b) - t(a));
}

/** Admin & owner: semua pengumuman termasuk draft. */
export async function listAllAnnouncements() {
  return sortAnnouncements(await listDocs<Announcement>(COL));
}

/**
 * Guru & orang tua: query harus sama dengan yang diperiksa rules
 * (published == true dan audience sesuai peran), lalu difilter per kelas.
 */
export async function listAnnouncementsFor(profile: UserProfile) {
  if (profile.role === 'admin' || profile.role === 'owner') {
    return (await listAllAnnouncements()).filter((a) => a.published);
  }
  const audience = profile.role === 'teacher' ? ['all', 'teachers'] : ['all', 'parents'];
  const rows = await listDocs<Announcement>(COL, where('published', '==', true), where('audience', 'in', audience));
  const myClasses = profile.role === 'teacher' ? (profile.classIds ?? []) : (profile.childClassIds ?? []);
  return sortAnnouncements(rows.filter((a) => a.classIds.length === 0 || a.classIds.some((c) => myClasses.includes(c))));
}

async function recipients(a: AnnouncementInput): Promise<string[]> {
  const uids: string[] = [];
  if (a.audience !== 'teachers') {
    const students = await listDocs<Student>('students', where('status', '==', 'active'));
    students
      .filter((s) => a.classIds.length === 0 || (s.currentClassId && a.classIds.includes(s.currentClassId)))
      .forEach((s) => uids.push(...s.parentUids));
  }
  if (a.audience !== 'parents') {
    const teachers = await listDocs<UserProfile>('users', where('role', '==', 'teacher'));
    teachers
      .filter((t) => t.active && (a.classIds.length === 0 || (t.classIds ?? []).some((c) => a.classIds.includes(c))))
      .forEach((t) => uids.push(t.id));
  }
  return uids;
}

export async function saveAnnouncement(existing: Announcement | null, input: AnnouncementInput, profile: UserProfile) {
  const data = {
    title: required(input.title, 'Judul'),
    body: required(input.body, 'Isi pengumuman'),
    audience: input.audience,
    classIds: input.classIds,
    pinned: input.pinned,
    published: input.published,
    updatedAt: serverTimestamp(),
  };
  const firstPublish = input.published && !existing?.published;
  let id = existing?.id;
  if (existing) {
    await updateDoc(doc(db, COL, existing.id), { ...data, ...(firstPublish ? { publishedAt: serverTimestamp() } : {}) });
  } else {
    const ref = await addDoc(collection(db, COL), {
      ...data,
      publishedAt: input.published ? serverTimestamp() : null,
      createdBy: profile.id,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
    });
    id = ref.id;
  }
  if (firstPublish && id) {
    await notifyUsers(await recipients(input), { title: `Pengumuman: ${data.title}`, body: data.body.slice(0, 140), link: '/announcements' });
  }
}

export async function deleteAnnouncement(a: Announcement) {
  await deleteDoc(doc(db, COL, a.id));
}
