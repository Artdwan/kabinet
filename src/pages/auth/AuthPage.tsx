import { useState } from "react";
import type { Role } from "../../types";
import { ACCOUNTS, ROLES } from "../../data/roles";
import { useStore } from "../../services/StoreContext";

const EXTRA_FIELD: Record<Role, { label: string; placeholder: string }> = {
  student: { label: "Класс и предметы", placeholder: "Например, 11 класс · математика, химия" },
  teacher: { label: "Предметы и группы", placeholder: "Например, математика · 2 группы" },
  parent: { label: "Код ученика от преподавателя", placeholder: "Например, ST-1001" },
};

export function AuthPage() {
  const { mutate } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title = mode === "login" ? "Вход в кабинет" : "Регистрация";
  const subtitle =
    mode === "login"
      ? "Продолжайте подготовку к ЦТ там, где остановились."
      : "Создайте аккаунт, чтобы получить доступ к заданиям, теории и тестам.";

  const loginAs = (r: Role) => {
    const account = ACCOUNTS.find((a) => a.role === r) || ACCOUNTS[0];
    mutate((d) => {
      d.account = account;
      d.auth = true;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
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
    if (mode === "register") {
      // РЕГИСТРАЦИЯ: позже POST /auth/register; здесь аккаунт кладётся в локальное хранилище.
      const account = {
        id: `acc-${Date.now()}`,
        role,
        login: email,
        name: name.split(" ")[0] || name,
        lastName: name.split(" ").slice(1).join(" "),
        extra,
      };
      mutate((d) => {
        d.registered.push(account);
        d.account = account;
        d.auth = true;
      });
    } else {
      loginAs(role);
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

        <div className="seg" style={{ alignSelf: "flex-start" }}>
          <button type="button" className="seg-opt" style={mode === "login" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setMode("login")}>
            Вход
          </button>
          <button type="button" className="seg-opt" style={mode === "register" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setMode("register")}>
            Регистрация
          </button>
        </div>

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
              <input type="radio" name="role" checked={role === r.id} onChange={() => setRole(r.id)} />
              <span className="dot" />
              <span>
                <div style={{ fontSize: 13.5 }}>{r.name}</div>
                <div className="card-meta">{r.hint}</div>
              </span>
            </label>
          ))}
        </div>

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
          {mode === "register" && (
            <div className="field">
              <label>{EXTRA_FIELD[role].label}</label>
              <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={EXTRA_FIELD[role].placeholder} />
            </div>
          )}

          {error && (
            <div style={{ border: "1px solid var(--color-bad)", background: "var(--color-bad-100)", color: "var(--color-bad)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block">
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => loginAs(role)}>
            Войти в демо: {ROLES.find((r) => r.id === role)?.name}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--color-text-3)", margin: 0, lineHeight: 1.5 }}>
          АВТОРИЗАЦИЯ: в рабочем приложении здесь POST /auth/login и /auth/register, роль приходит с сервера и
          определяет доступные разделы.
        </p>
      </div>
    </div>
  );
}
