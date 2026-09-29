import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { errorMessage } from '../lib/errors';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Memuat data async dengan state loading/error dan fungsi reload. Data lama tetap tampil saat reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e) => !cancelled && setState({ data: null, loading: false, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
