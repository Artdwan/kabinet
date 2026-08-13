import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { HOMEWORKS, SUBJECTS } from "../../data/content";
import { useToast } from "../../services/ToastContext";
import { Switch } from "../../components/Switch";

export function TeacherAssignPage() {
  const { show } = useToast();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ color: "var(--color-text-2)", maxWidth: 640 }}>
        Материалы и домашние работы, назначенные ученикам. Здесь преподаватель управляет доступностью
        мгновенной проверки и решений.
      </p>
      {HOMEWORKS.map((hw) => {
        const subj = SUBJECTS.find((s) => s.id === hw.subjectId);
        return (
          <div key={hw.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <span className="card-kicker">{subj?.name}</span>
                <div className="card-title">{hw.title}</div>
                <p className="card-body">{hw.summary}</p>
              </div>
              <Link to={`/homework/${hw.id}`} className="btn btn-secondary btn-sm">
                <Eye size={14} /> Как ученик
              </Link>
            </div>
            <Switch
              checked={hw.allowInstantCheck}
              onChange={() =>
                // НАСТРОЙКА: в рабочем приложении это PATCH /homeworks/{id} — доступность проверки и решений.
                show("НАСТРОЙКА: в рабочем приложении это PATCH /homeworks/{id} — доступность проверки и решений.", "ok")
              }
              label="Мгновенная проверка ответов"
            />
          </div>
        );
      })}
    </div>
  );
}
