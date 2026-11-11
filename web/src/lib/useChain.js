import { useCallback, useEffect, useState } from 'react';

/** Runs an async chain read. Returns { data, error, loading, reload }. Never mocks data. */
export function useChain(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    run()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: undefined, error, loading: false }));
  }, [run]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}
