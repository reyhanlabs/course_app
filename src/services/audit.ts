import { collection, doc, serverTimestamp, type Transaction, type WriteBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { currentUid } from './db';

export type AuditAction =
  | 'student_class_changed'
  | 'class_teacher_changed'
  | 'user_account_created'
  | 'user_status_changed'
  | 'billing_rate_changed'
  | 'billing_type_changed'
  | 'invoice_created'
  | 'invoice_edited'
  | 'invoice_issued'
  | 'invoice_cancelled'
  | 'payment_created'
  | 'payment_verified'
  | 'payment_rejected';

/** Audit log ditulis di batch/transaksi yang sama dengan perubahan datanya (atomik). */
export function addAuditLog(
  writer: WriteBatch | Transaction,
  entry: {
    action: AuditAction;
    module: string;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  },
) {
  (writer as WriteBatch).set(doc(collection(db, 'auditLogs')), {
    userId: currentUid(),
    action: entry.action,
    module: entry.module,
    recordId: entry.recordId,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
    timestamp: serverTimestamp(),
  });
}
