import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "bad";
}

interface ToastContextValue {
  show: (text: string, kind?: "ok" | "bad") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, kind: "ok" | "bad" = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 200 }}>
          <div className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-bad"}`}>
            {toast.kind === "ok" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
