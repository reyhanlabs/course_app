import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppNotification, UserProfile } from '../types';
import { currentUid } from './db';

interface Message {
  title: string;
  body: string;
  link: string | null;
}

/**
 * Notifikasi bersifat "best effort": dikirim setelah aksi utama berhasil dan
 * kegagalannya tidak membatalkan aksi utama.
 */
export async function notifyUsers(uids: (string | null | undefined)[], msg: Message) {
  const unique = [...new Set(uids.filter((u): u is string => Boolean(u)))];
  if (unique.length === 0) return;
  try {
    const createdBy = currentUid();
    for (let i = 0; i < unique.length; i += 400) {
      const batch = writeBatch(db);
      for (const uid of unique.slice(i, i + 400)) {
        batch.set(doc(collection(db, 'notifications')), {
          userId: uid,
          targetRole: null,
          ...msg,
          title: msg.title.slice(0, 200),
          read: false,
          createdBy,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('Notifikasi gagal dikirim', e);
  }
}

/** Satu notifikasi bersama untuk semua admin (mis. bukti bayar baru). */
export async function notifyAdmins(msg: Message) {
  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'notifications')), {
      userId: null,
      targetRole: 'admin',
      ...msg,
      title: msg.title.slice(0, 200),
      read: false,
      createdBy: currentUid(),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (e) {
    console.warn('Notifikasi admin gagal dikirim', e);
  }
}

/** Berlangganan 20 notifikasi terbaru (plus notifikasi peran untuk admin). */
export function subscribeNotifications(profile: UserProfile, onChange: (rows: AppNotification[]) => void) {
  const parts = new Map<string, AppNotification[]>();
  const emit = () =>
    onChange(
      [...parts.values()]
        .flat()
        .sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()))
        .slice(0, 30),
    );
  const listen = (key: string, q: ReturnType<typeof query>) =>
    onSnapshot(
      q,
      (snap) => {
        parts.set(key, snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as AppNotification));
        emit();
      },
      (err) => console.warn('Gagal memuat notifikasi', err),
    );
  const unsubs = [
    listen('mine', query(collection(db, 'notifications'), where('userId', '==', profile.id), orderBy('createdAt', 'desc'), limit(20))),
  ];
  if (profile.role === 'admin') {
    unsubs.push(listen('role', query(collection(db, 'notifications'), where('targetRole', '==', 'admin'), orderBy('createdAt', 'desc'), limit(20))));
  }
  return () => unsubs.forEach((u) => u());
}

export async function markRead(rows: AppNotification[]) {
  const unread = rows.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true, readAt: serverTimestamp() }));
  await batch.commit();
}
