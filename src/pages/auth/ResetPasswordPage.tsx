import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось выполнить запрос. Проверьте соединение.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-lg" style={{ width: "min(440px, 100%)", padding: "34px 32px", gap: 18 }}>
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            Подготовка к ЦТ
          </div>
          <h1 style={{ fontSize: 28, margin: "10px 0 6px" }}>Новый пароль</h1>
        </div>

        {!token ? (
          <p className="card-body">Ссылка неполная — откройте её из письма ещё раз.</p>
        ) : done ? (
          <>
            <p className="card-body">Пароль обновлён. Теперь можно войти с новым паролем.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate("/auth")}>Войти</button>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Новый пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
            </div>
            <div className="field">
              <label>Повторите пароль</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && (
              <div style={{ border: "1px solid var(--color-bad)", background: "var(--color-bad-100)", color: "var(--color-bad)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12.5 }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Сохранить пароль</button>
          </form>
        )}
      </div>
    </div>
  );
}
