import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../services/StoreContext";
import { api, ApiError } from "../../services/apiClient";

export function JoinGroupPage() {
  const { groupId } = useParams();
  const { account, ready } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !account || account.role !== "student" || !groupId) return;
    api
      .post<{ groupName: string }>("/student/join-group", { groupId })
      .then((res) => {
        setGroupName(res.groupName);
        setTimeout(() => navigate("/", { replace: true }), 1500);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось присоединиться к группе"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account, groupId]);

  if (!ready) return null;
  if (!account) return <Navigate to={`/auth?joinGroup=${groupId}`} replace />;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-lg" style={{ width: "min(440px, 100%)", padding: "30px 28px", textAlign: "center" }}>
        {account.role !== "student" ? (
          <>
            <p className="card-body">Присоединиться к группе может только аккаунт ученика.</p>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => navigate("/")}>На главную</button>
          </>
        ) : error ? (
          <>
            <p className="card-body" style={{ color: "var(--color-bad)" }}>{error}</p>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => navigate("/")}>На главную</button>
          </>
        ) : groupName ? (
          <p className="card-body">Готово — вы добавлены в группу «{groupName}». Переходим в кабинет…</p>
        ) : (
          <p className="card-body">Присоединяем вас к группе…</p>
        )}
      </div>
    </div>
  );
}
