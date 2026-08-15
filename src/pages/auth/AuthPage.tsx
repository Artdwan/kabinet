import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Role } from "../../types";
import { ROLES } from "../../data/roles";
import { useStore } from "../../services/StoreContext";
import { api, ApiError } from "../../services/apiClient";

const EXTRA_FIELD: Record<Role, { label: string; placeholder: string }> = {
  student: { label: "Класс и предметы", placeholder: "Например, 11 класс · математика, химия" },
  teacher: { label: "Предметы и группы", placeholder: "Например, математика · 2 группы" },
  parent: { label: "Код ученика от преподавателя", placeholder: "ID аккаунта ученика" },
};

export function AuthPage() {
  const { login, register } = useStore();
  const [searchParams] = useSearchParams();
  const linkChild = searchParams.get("linkChild");
  const [mode, setMode] = useState<"login" | "register" | "forgot">(linkChild ? "register" : "login");
  const [role, setRole] = useState<Role>(linkChild ? "parent" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [extra, setExtra] = useState(linkChild || "");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = mode === "login" ? "Вход в кабинет" : mode === "register" ? "Регистрация" : "Восстановление пароля";
  const subtitle =
    mode === "login"
      ? "Продолжайте подготовку к ЦТ там, где остановились."
      : mode === "register"
        ? "Создайте аккаунт, чтобы получить доступ к заданиям, теории и тестам."
        : "Укажите email — пришлём ссылку для сброса пароля.";

  const handleError = (e: unknown) => {
    setError(e instanceof ApiError ? e.message : "Не удалось выполнить запрос. Проверьте соединение.");
  };

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Введите корректный email.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setInfo("Если такой email зарегистрирован, на него отправлено письмо со ссылкой для сброса пароля.");
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Введите корректный email.");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Укажите имя и фамилию.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const [firstName, ...rest] = name.trim().split(" ");
        await register({ role, email, password, name: firstName, lastName: rest.join(" "), extra });
      } else {
        await login(email, password);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        className="card elev-lg"
        style={{ width: "min(520px, 100%)", padding: "34px 32px", gap: 18 }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            Подготовка к ЦТ
          </div>
          <h1 style={{ fontSize: 32, margin: "10px 0 6px" }}>{title}</h1>
          <p style={{ color: "var(--color-text-2)", fontSize: 14, margin: 0 }}>{subtitle}</p>
        </div>

        {linkChild && (
          <div style={{ border: "1px solid var(--color-accent)", background: "var(--color-accent-100)", color: "var(--color-accent)", borderRadius: "var(--radius-sm)", padding: "10px 12px", fontSize: 12.5 }}>
            Вы регистрируетесь как родитель — аккаунт будет автоматически привязан к ученику.
          </div>
        )}

        {mode !== "forgot" && (
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            <button type="button" className="seg-opt" style={mode === "login" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => { setMode("login"); setError(null); setInfo(null); }}>
              Вход
            </button>
            <button type="button" className="seg-opt" style={mode === "register" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => { setMode("register"); setError(null); setInfo(null); }}>
              Регистрация
            </button>
          </div>
        )}

        {mode !== "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ROLES.map((r) => (
              <label
                key={r.id}
                className="radio"
                style={{
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  justifyContent: "flex-start",
                }}
              >
                <input type="radio" name="role" checked={role === r.id} disabled={!!linkChild} onChange={() => setRole(r.id)} />
                <span className="dot" />
                <span>
                  <div style={{ fontSize: 13.5 }}>{r.name}</div>
                  <div className="card-meta">{r.hint}</div>
                </span>
              </label>
            ))}
          </div>
        )}

        {mode === "forgot" ? (
          <form onSubmit={onForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            {info && (
              <div style={{ border: "1px solid var(--color-ok)", background: "var(--color-ok-100)", color: "var(--color-ok)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
                {info}
              </div>
            )}
            {error && (
              <div style={{ border: "1px solid var(--color-bad)", background: "var(--color-bad-100)", color: "var(--color-bad)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Отправить ссылку</button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setMode("login"); setError(null); setInfo(null); }}>Назад ко входу</button>
          </form>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && (
              <div className="field">
                <label>Имя и фамилия</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Максим Ковалевич" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
            </div>
            {mode === "login" && (
              <button type="button" onClick={() => { setMode("forgot"); setError(null); setInfo(null); }} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "var(--color-accent)", fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                Забыли пароль?
              </button>
            )}
            {mode === "register" && (
              <div className="field">
                <label>{EXTRA_FIELD[role].label}</label>
                <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={EXTRA_FIELD[role].placeholder} readOnly={!!linkChild} />
              </div>
            )}

            {error && (
              <div style={{ border: "1px solid var(--color-bad)", background: "var(--color-bad-100)", color: "var(--color-bad)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 11, color: "var(--color-text-3)", margin: 0, lineHeight: 1.5 }}>
          Данные передаются на сервер и сохраняются в базе данных — прогресс синхронизирован между устройствами.
        </p>
      </div>
    </div>
  );
}
