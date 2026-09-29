import { FirebaseError } from 'firebase/app';

const messages: Record<string, string> = {
  'permission-denied': 'Anda tidak memiliki akses untuk data atau tindakan ini.',
  unavailable: 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.',
  'not-found': 'Data tidak ditemukan.',
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/wrong-password': 'Email atau kata sandi salah.',
  'auth/user-not-found': 'Email atau kata sandi salah.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/missing-email': 'Email wajib diisi.',
  'auth/email-already-in-use': 'Email ini sudah dipakai akun lain.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
  'auth/network-request-failed': 'Koneksi internet bermasalah. Coba lagi.',
  'auth/user-disabled': 'Akun ini dinonaktifkan.',
  'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase Console (Authentication → Sign-in method).',
  'auth/popup-blocked': 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.',
  'auth/unauthorized-domain': 'Domain ini belum diizinkan. Tambahkan di Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/account-exists-with-different-credential': 'Email ini sudah terdaftar dengan kata sandi. Masuk memakai email & kata sandi.',
  'storage/unauthorized': 'Anda tidak memiliki akses untuk mengunggah file ini.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? `Terjadi kesalahan (${error.code}).`;
  }
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan yang tidak diketahui.';
}
