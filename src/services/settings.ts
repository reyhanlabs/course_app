import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEFAULT_BILLING_RULES } from '../lib/billing';
import type { AcademicSettings, FinanceSettings, InstitutionSettings } from '../types';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export const DEFAULT_INSTITUTION: InstitutionSettings = {
  name: '',
  address: '',
  phone: '',
  whatsapp: '',
  email: '',
  logoUrl: null,
  logoPath: null,
};

export const DEFAULT_FINANCE: FinanceSettings = {
  defaultSessionRate: 50_000,
  defaultMonthlyRate: 350_000,
  invoicePrefix: 'INV',
  receiptPrefix: 'KWT',
  paymentPrefix: 'PAY',
  defaultDueDays: 10,
  billingRules: DEFAULT_BILLING_RULES,
  paymentMethods: ['cash', 'bank_transfer', 'ewallet', 'other'],
  paymentInstructions: '',
};

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  const snap = await getDoc(doc(db, 'settings', 'institution'));
  return { ...DEFAULT_INSTITUTION, ...(snap.exists() ? (snap.data() as Partial<InstitutionSettings>) : {}) };
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const snap = await getDoc(doc(db, 'settings', 'finance'));
  const data = snap.exists() ? (snap.data() as Partial<FinanceSettings>) : {};
  return { ...DEFAULT_FINANCE, ...data, billingRules: { ...DEFAULT_BILLING_RULES, ...(data.billingRules ?? {}) } };
}

export async function saveInstitutionSettings(input: Omit<InstitutionSettings, 'logoUrl' | 'logoPath'>) {
  if (!input.name.trim()) throw new Error('Nama lembaga wajib diisi.');
  await setDoc(
    doc(db, 'settings', 'institution'),
    {
      name: input.name.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      whatsapp: input.whatsapp.trim(),
      email: input.email.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function uploadInstitutionLogo(file: File, oldPath: string | null) {
  if (!file.type.startsWith('image/')) throw new Error('Logo harus berupa gambar.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran logo maksimal 2 MB.');
  const path = `institution/logo-${Date.now()}.${(file.name.split('.').pop() || 'png').toLowerCase()}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);
  await setDoc(doc(db, 'settings', 'institution'), { logoUrl: url, logoPath: path, updatedAt: serverTimestamp() }, { merge: true });
  if (oldPath) await deleteObject(ref(storage, oldPath)).catch(() => undefined);
}

export async function saveFinanceSettings(input: FinanceSettings) {
  const int = (n: number, label: string) => {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v) || v < 0) throw new Error(`${label} tidak valid.`);
    return v;
  };
  const prefix = (s: string, label: string) => {
    const v = s.trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,10}$/.test(v)) throw new Error(`${label} hanya boleh huruf/angka, maksimal 10 karakter.`);
    return v;
  };
  if (input.paymentMethods.length === 0) throw new Error('Pilih minimal satu metode pembayaran.');
  await setDoc(doc(db, 'settings', 'finance'), {
    defaultSessionRate: int(input.defaultSessionRate, 'Tarif per sesi'),
    defaultMonthlyRate: int(input.defaultMonthlyRate, 'Tarif bulanan'),
    invoicePrefix: prefix(input.invoicePrefix, 'Prefix invoice'),
    receiptPrefix: prefix(input.receiptPrefix, 'Prefix kuitansi'),
    paymentPrefix: prefix(input.paymentPrefix, 'Prefix pembayaran'),
    defaultDueDays: int(input.defaultDueDays, 'Jatuh tempo'),
    billingRules: input.billingRules,
    paymentMethods: input.paymentMethods,
    paymentInstructions: input.paymentInstructions.trim(),
    updatedAt: serverTimestamp(),
  });
}

export const DEFAULT_ACADEMIC: AcademicSettings = { academicYear: '', semester: '', defaultClassDuration: 60 };

export async function getAcademicSettings(): Promise<AcademicSettings> {
  const snap = await getDoc(doc(db, 'settings', 'academic'));
  return { ...DEFAULT_ACADEMIC, ...(snap.exists() ? (snap.data() as Partial<AcademicSettings>) : {}) };
}

export async function saveAcademicSettings(input: AcademicSettings) {
  const duration = Math.floor(Number(input.defaultClassDuration));
  if (!duration || duration < 15 || duration > 300) throw new Error('Durasi kelas harus 15–300 menit.');
  await setDoc(doc(db, 'settings', 'academic'), {
    academicYear: input.academicYear.trim(),
    semester: input.semester.trim(),
    defaultClassDuration: duration,
    updatedAt: serverTimestamp(),
  });
}
