import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { api } from "./apiClient";

// Общий счётчик обновлений: помощник меняет данные из панели, а перерисовать
// нужно страницу под ней. Перезагружать браузер ради этого не годится —
// закрылась бы сама панель вместе с перепиской.
let revision = 0;
const listeners = new Set<() => void>();

export function refreshAllApiData() {
  revision += 1;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}


export function useApiData<T>(path: string, deps: unknown[] = []): { data: T | undefined; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const globalRevision = useSyncExternalStore(subscribe, () => revision);

  const load = useCallback(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<T>(path)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить данные"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, globalRevision, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}
