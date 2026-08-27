import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import type { StudentRow } from "../../services/crm";

/** Дети клиентов. Учебная часть (успеваемость, занятия) живёт в разделах
 *  преподавателя — отсюда на неё ведёт ссылка, если аккаунт связан. */
export function CrmStudentsPage() {
  const { data: students = [] } = useApiData<StudentRow[]>("/crm/students");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      students.filter((s) =>
        `${s.name} ${s.grade} ${s.client.name}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [students, q],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field" style={{ margin: 0, maxWidth: 360 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, opacity: 0.5 }} />
          <input
            className="input"
            style={{ paddingLeft: 30 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по ученику, классу или клиенту..."
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Класс</th>
              <th>Платит</th>
              <th>Телефон</th>
              <th>Абонементов</th>
              <th>Учебный аккаунт</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.grade}</td>
                <td>
                  {s.client.name}
                  <div className="card-meta">{s.client.who}</div>
                </td>
                <td>{s.client.phone || "—"}</td>
                <td>{s.subscriptionCount}</td>
                <td>
                  {s.userId ? (
                    <Link to={`/teacher/students/${s.userId}`} className="tag tag-ok">
                      {s.account ? s.account.name : "открыть"}
                    </Link>
                  ) : (
                    <span className="tag tag-neutral">не связан</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>Учеников пока нет — добавьте их в карточке клиента.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
