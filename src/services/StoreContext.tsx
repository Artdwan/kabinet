import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Store } from "../types/state";
import { mockApi } from "./mockApi";

interface StoreContextValue {
  store: Store;
  /** Deep-clones the store, runs `fn` mutating it in place, persists, and re-renders. */
  mutate: (fn: (draft: Store) => void) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => mockApi.load());

  const mutate = useCallback((fn: (draft: Store) => void) => {
    setStore((prev) => {
      const draft: Store = JSON.parse(JSON.stringify(prev));
      fn(draft);
      // TODO backend: PATCH к API вместо localStorage
      return mockApi.save(draft);
    });
  }, []);

  const reset = useCallback(() => {
    setStore(mockApi.reset());
  }, []);

  const value = useMemo(() => ({ store, mutate, reset }), [store, mutate, reset]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
