import { doc, type Transaction } from 'firebase/firestore';
import { formatDocNumber } from '../lib/billing';
import { db } from '../lib/firebase';

/**
 * Penomoran berurutan per bulan (INV/202610/0001) memakai dokumen counters/{kind-YYYYMM}.
 * WAJIB dipanggil di dalam transaksi. Karena Firestore mewajibkan semua baca
 * sebelum tulis, fungsi ini dipisah jadi read + commit.
 */
export async function readCounter(tx: Transaction, kind: 'invoice' | 'payment' | 'receipt', date: string) {
  const yyyymm = date.slice(0, 7).replace('-', '');
  const ref = doc(db, 'counters', `${kind}-${yyyymm}`);
  const snap = await tx.get(ref);
  const next = snap.exists() ? Number(snap.data().next) || 1 : 1;
  return {
    number: (prefix: string) => formatDocNumber(prefix, yyyymm, next),
    commit: () => tx.set(ref, { next: next + 1 }),
  };
}
