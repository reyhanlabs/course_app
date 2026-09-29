import { doc, serverTimestamp, where, writeBatch, collection } from 'firebase/firestore';
import { addDays } from '../lib/format';
import { db } from '../lib/firebase';
import type { BillingProfile, BillingProfileInput, Student } from '../types';
import { addAuditLog } from './audit';
import { currentUid, listDocs } from './db';

const COL = 'billingProfiles';

export async function listAllProfiles(): Promise<BillingProfile[]> {
  return listDocs<BillingProfile>(COL);
}

export async function listProfilesOfStudent(studentId: string): Promise<BillingProfile[]> {
  const rows = await listDocs<BillingProfile>(COL, where('studentId', '==', studentId));
  return rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

export function currentProfile(versions: BillingProfile[]): BillingProfile | null {
  return versions.find((v) => v.effectiveUntil === null) ?? null;
}

/**
 * Menetapkan tarif baru sebagai VERSI BARU. Versi yang masih berlaku ditutup
 * sehari sebelum effectiveFrom. Isi versi lama tidak pernah diubah (TEST 5).
 */
export async function setNewBillingProfile(student: Student, input: BillingProfileInput) {
  const toInt = (n: number) => Math.max(0, Math.floor(Number(n) || 0));
  const data = {
    billingType: input.billingType,
    sessionRate: toInt(input.sessionRate),
    monthlyRate: toInt(input.monthlyRate),
    discount: toInt(input.discount),
    additionalFee: toInt(input.additionalFee),
    additionalFeeLabel: input.additionalFeeLabel.trim() || 'Biaya tambahan',
    effectiveFrom: input.effectiveFrom,
    notes: input.notes.trim(),
  };
  if (!data.effectiveFrom) throw new Error('Tanggal berlaku wajib diisi.');
  if (data.billingType === 'PER_SESSION' && data.sessionRate === 0) throw new Error('Tarif per sesi wajib diisi.');
  if (data.billingType === 'MONTHLY' && data.monthlyRate === 0) throw new Error('Tarif bulanan wajib diisi.');

  const versions = await listProfilesOfStudent(student.id);
  const current = currentProfile(versions);
  if (versions.some((v) => v.effectiveFrom >= data.effectiveFrom)) {
    throw new Error('Sudah ada versi tarif yang berlaku pada/sesudah tanggal ini. Pilih tanggal yang lebih baru.');
  }

  const batch = writeBatch(db);
  if (current) {
    batch.update(doc(db, COL, current.id), {
      effectiveUntil: addDays(data.effectiveFrom, -1),
      status: 'ended',
      updatedAt: serverTimestamp(),
    });
  }
  const ref = doc(collection(db, COL));
  batch.set(ref, {
    ...data,
    studentId: student.id,
    studentName: student.fullName,
    effectiveUntil: null,
    status: 'active',
    parentUids: student.parentUids,
    createdBy: currentUid(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snapshot = (v: Partial<BillingProfile> | null) =>
    v ? { billingType: v.billingType, sessionRate: v.sessionRate, monthlyRate: v.monthlyRate, discount: v.discount, additionalFee: v.additionalFee } : null;
  addAuditLog(batch, {
    action: current && current.billingType !== data.billingType ? 'billing_type_changed' : 'billing_rate_changed',
    module: 'billing',
    recordId: student.id,
    oldData: snapshot(current),
    newData: { ...snapshot(data), effectiveFrom: data.effectiveFrom },
  });
  await batch.commit();
}
