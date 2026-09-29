import { collection, doc, serverTimestamp, type WriteBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { currentUid } from './db';

export type AuditAction =
  | 'student_class_changed'
  | 'class_teacher_changed'
  | 'user_account_created'
  | 'user_status_changed';

/** Audit log ditulis di batch yang sama dengan perubahan datanya (atomik). */
export function addAuditLog(
  batch: WriteBatch,
  entry: {
    action: AuditAction;
    module: string;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  },
) {
  batch.set(doc(collection(db, 'auditLogs')), {
    userId: currentUid(),
    action: entry.action,
    module: entry.module,
    recordId: entry.recordId,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
    timestamp: serverTimestamp(),
  });
}
