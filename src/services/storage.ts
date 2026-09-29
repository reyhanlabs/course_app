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
