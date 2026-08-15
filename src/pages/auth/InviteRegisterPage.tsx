import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../../services/StoreContext";
import { api, ApiError } from "../../services/apiClient";

interface InviteInfo {
  name: string;
  lastName: string;
  teacherName: string;
  groupName: string | null;
}

export function InviteRegisterPage() {
  const { token } = useParams();
  const { account, logout, register } = useStore();
  const [invite, setInvite] = useState<InviteInfo | null | "invalid">(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<InviteInfo>(`/auth/student-invite/${token}`)
      .then((info) => {
        setInvite(info);
        setName(`${info.name} ${info.lastName}`.trim());
      })
      .catch(() => setInvite("invalid"));
  }, [token]);

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
    if (!name.trim()) {
      setError("Укажите имя и фамилию.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      await register({ role: "student", email, password, name: firstName, lastName: rest.join(" "), extra: "", inviteToken: token });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось выполнить запрос. Проверьте соединение.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-lg" style={{ width: "min(480px, 100%)", padding: "30px 28px" }}>
        {invite === null ? (
          <p className="card-body">Загрузка приглашения…</p>
        ) : invite === "invalid" ? (
          <p className="card-body">Ссылка недействительна или уже использована — попросите преподавателя прислать новую.</p>
        ) : account ? (
          <>
            <p className="card-body">Вы уже вошли как {account.name}. Чтобы зарегистрироваться по приглашению, сначала выйдите из текущего аккаунта.</p>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={logout}>Выйти</button>
          </>
        ) : done ? (
          <p className="card-body">Готово — аккаунт создан{invite.groupName ? `, вы добавлены в группу «${invite.groupName}»` : ""}. Открываем кабинет…</p>
        ) : (
          <>
            <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Регистрация ученика</h1>
            <p className="card-body" style={{ margin: "0 0 18px" }}>
              Вас пригласил преподаватель {invite.teacherName}{invite.groupName ? ` в группу «${invite.groupName}»` : ""}. Придумайте email и пароль для входа.
            </p>
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Имя и фамилия</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="field">
                <label>Пароль</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
              </div>
              {error && (
                <div style={{ border: "1px solid var(--color-bad)", background: "var(--color-bad-100)", color: "var(--color-bad)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
                  {error}
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Создать аккаунт</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
