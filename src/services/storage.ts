import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadPhoto(
  folder: 'students' | 'teachers',
  ownerId: string,
  file: File,
  oldPath: string | null,
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith('image/')) throw new Error('File foto harus berupa gambar (JPG/PNG/WebP).');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran foto maksimal 5 MB.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${ownerId}/photo-${Date.now()}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);
  if (oldPath) {
    // Foto lama boleh gagal dihapus (misalnya sudah tidak ada); tidak menggagalkan upload.
    await deleteObject(ref(storage, oldPath)).catch(() => undefined);
  }
  return { url, path };
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
}

/** Upload file umum (materi, lampiran PR). */
export async function uploadFile(
  folder: 'materials' | 'homework' | 'payments',
  ownerId: string,
  file: File,
  maxBytes: number,
): Promise<{ url: string; path: string; name: string }> {
  if (file.size > maxBytes) {
    throw new Error(`Ukuran file maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  const path = `${folder}/${ownerId}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
  return { url: await getDownloadURL(fileRef), path, name: file.name };
}

export async function deleteFile(path: string | null) {
  if (!path) return;
  await deleteObject(ref(storage, path)).catch(() => undefined);
}
