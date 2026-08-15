import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account, Role } from "../types";
import type { Store } from "../types/state";
import { EMPTY_STORE } from "../types/state";
import { api, ApiError, getToken, setToken } from "./apiClient";

interface RegisterInput {
  role: Role;
  email: string;
  password: string;
  name: string;
  lastName?: string;
  extra?: string;
  inviteToken?: string;
}

interface StoreContextValue {
  store: Store;
  account: Account | null;
  ready: boolean;
  /** Optimistically mutates local state; the caller is responsible for also persisting via the API. */
  mutate: (fn: (draft: Store) => void) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  const loadStudentState = useCallback(async (acc: Account) => {
    if (acc.role !== "student") {
      setStore({ ...EMPTY_STORE, account: acc });
      return;
    }
    const state = await api.get<Omit<Store, "account">>("/student/state");
    setStore({ ...state, account: acc });
  }, []);

  const bootstrap = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    try {
      const { account: acc } = await api.get<{ account: Account }>("/auth/me");
      setAccount(acc);
      await loadStudentState(acc);
    } catch {
      setToken(null);
      setAccount(null);
    } finally {
      setReady(true);
    }
  }, [loadStudentState]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutate = useCallback((fn: (draft: Store) => void) => {
    setStore((prev) => {
      const draft: Store = JSON.parse(JSON.stringify(prev));
      fn(draft);
      return draft;
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, account: acc } = await api.post<{ token: string; account: Account }>("/auth/login", { email, password });
      setToken(token);
      setAccount(acc);
      await loadStudentState(acc);
    },
    [loadStudentState],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { token, account: acc } = await api.post<{ token: string; account: Account }>("/auth/register", input);
      setToken(token);
      setAccount(acc);
      await loadStudentState(acc);
    },
    [loadStudentState],
  );

  const logout = useCallback(() => {
    setToken(null);
    setAccount(null);
    setStore(EMPTY_STORE);
  }, []);

  const refresh = useCallback(async () => {
    if (account) await loadStudentState(account);
  }, [account, loadStudentState]);

  const value = useMemo(() => ({ store, account, ready, mutate, login, register, logout, refresh }), [store, account, ready, mutate, login, register, logout, refresh]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { ApiError };
