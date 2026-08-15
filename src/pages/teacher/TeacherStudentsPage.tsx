import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";

interface RosterRow {
  id: string;
  name: string;
  grade: number;
  avg: number;
  goal: number;
  done: number;
  total: number;
  overdue: number;
  weak: string;
  lastActive: string | null;
  risk: "ok" | "attention" | "risk";
  groupIds: string[];
  groupNames: string[];
}

interface GroupRow {
  id: string;
  name: string;
}

interface CreatedStudent {
  id: string;
  email: string;
  password: string;
  name: string;
  lastName: string;
}

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Требует внимания", cls: "tag-bad" },
};

export function TeacherStudentsPage() {
  const navigate = useNavigate();
  const { data: roster = [], reload: reloadRoster } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [], reload: reloadGroups } = useApiData<GroupRow[]>("/teacher/groups");
  const { show } = useToast();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  const [addOpen, setAddOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentGroup, setNewStudentGroup] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("11");
  const [newStudentGoal, setNewStudentGoal] = useState("85");
  const [newStudentNote, setNewStudentNote] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const grades = useMemo(() => Array.from(new Set(roster.map((r) => r.grade))).sort((a, b) => a - b), [roster]);

  const rows = roster.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (groupFilter && !r.groupIds.includes(groupFilter)) return false;
    if (gradeFilter && r.grade !== Number(gradeFilter)) return false;
    if (statusFilter && r.risk !== statusFilter) return false;
    return true;
  });

  const resetForm = () => {
    setNewStudentName("");
    setNewStudentLastName("");
    setNewStudentEmail("");
    setNewStudentGroup("");
    setNewStudentGrade("11");
    setNewStudentGoal("85");
    setNewStudentNote("");
  };

  const createStudent = async () => {
    if (!newStudentName.trim() || !newStudentEmail.trim()) return;
    setCreatingStudent(true);
    try {
      const created = await api.post<CreatedStudent>("/teacher/students", {
        name: newStudentName.trim(),
        lastName: newStudentLastName.trim(),
        email: newStudentEmail.trim(),
        groupId: newStudentGroup || undefined,
        grade: newStudentGrade || undefined,
        goalScore: newStudentGoal || undefined,
        note: newStudentNote.trim() || undefined,
      });
      setCreatedStudent(created);
      resetForm();
      show("Ученик создан", "ok");
      reloadGroups();
      reloadRoster();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать ученика", "bad");
    } finally {
      setCreatingStudent(false);
    }
  };

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      show("Не удалось скопировать — выделите текст вручную", "bad");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>Учеников: {roster.length}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>Добавить ученика</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => show("Импорт списка появится в одном из следующих обновлений", "ok")}>
            Импортировать список
          </button>
          <div className="seg">
            <button type="button" className="seg-opt" style={view === "table" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("table")} title="Таблица">
              <List size={16} />
            </button>
            <button type="button" className="seg-opt" style={view === "cards" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("cards")} title="Карточки">
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)" }} />
          <input className="input" style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени" />
        </div>
        <select className="input" style={{ maxWidth: 200 }} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">Все группы</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 140 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">Все классы</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g} класс</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="ok">В норме</option>
          <option value="attention">Внимание</option>
          <option value="risk">Требует внимания</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card-meta">{roster.length === 0 ? "Учеников пока нет — добавьте первого." : "Ничего не найдено по этим фильтрам."}</div>
      ) : view === "table" ? (
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Группа</th>
              <th>Цель</th>
              <th>Текущий результат</th>
              <th>Домашние задания</th>
              <th>Последняя активность</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/teacher/students/${r.id}`)} style={{ cursor: "pointer" }}>
                <td>{r.name}</td>
                <td>{r.groupNames.join(", ") || "—"}{r.grade ? ` · ${r.grade} класс` : ""}</td>
                <td>{r.goal}</td>
                <td>{r.avg || "—"}</td>
                <td>{r.overdue > 0 ? `${r.overdue} просрочено` : "нет просроченных"}</td>
                <td>{r.lastActive ? fmtDate(r.lastActive.slice(0, 10)) : "—"}</td>
                <td><span className={`tag ${RISK_LABEL[r.risk].cls}`}>{RISK_LABEL[r.risk].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div data-cols3>
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="card"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => navigate(`/teacher/students/${r.id}`)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="card-title" style={{ fontSize: 15 }}>{r.name}</div>
                <span className={`tag ${RISK_LABEL[r.risk].cls}`}>{RISK_LABEL[r.risk].label}</span>
              </div>
              <div className="card-meta">{r.groupNames.join(", ") || "Без группы"}{r.grade ? ` · ${r.grade} класс` : ""}</div>
              <div className="card-meta">Цель {r.goal} · результат {r.avg || "—"}</div>
              <div className="card-meta">{r.overdue > 0 ? `${r.overdue} просрочено` : "нет просроченных"}</div>
              <div className="card-meta">Активность: {r.lastActive ? fmtDate(r.lastActive.slice(0, 10)) : "—"}</div>
            </button>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal
          title="Добавить ученика"
          onClose={() => setAddOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!newStudentName.trim() || !newStudentEmail.trim() || creatingStudent} onClick={createStudent}>
                Создать
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Имя</label>
                <input className="input" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Максим" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Фамилия</label>
                <input className="input" value={newStudentLastName} onChange={(e) => setNewStudentLastName(e.target.value)} placeholder="Ковалевич" />
              </div>
            </div>
            <div className="field">
              <label>Email для входа</label>
              <input className="input" type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="ученик@example.com" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 120 }}>
                <label>Класс</label>
                <input className="input" type="number" min={1} max={11} value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Целевой балл ЦТ</label>
                <input className="input" type="number" min={0} max={100} value={newStudentGoal} onChange={(e) => setNewStudentGoal(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Группа (необязательно)</label>
                <select className="input" value={newStudentGroup} onChange={(e) => setNewStudentGroup(e.target.value)}>
                  <option value="">Без группы</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Заметка преподавателя (необязательно)</label>
              <input className="input" value={newStudentNote} onChange={(e) => setNewStudentNote(e.target.value)} placeholder="Например, приходит по вечерам, слабая алгебра" />
            </div>
          </div>
        </Modal>
      )}

      {createdStudent && (
        <Modal
          title={`Ученик «${createdStudent.name} ${createdStudent.lastName}» создан`}
          onClose={() => { setCreatedStudent(null); setAddOpen(false); }}
          actions={<button type="button" className="btn btn-primary" onClick={() => { setCreatedStudent(null); setAddOpen(false); }}>Готово</button>}
        >
          <p className="card-body" style={{ margin: "0 0 8px" }}>
            Передайте ученику логин и пароль для первого входа, а родителю — ссылку для привязки аккаунта.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              ["Email", createdStudent.email],
              ["Пароль", createdStudent.password],
              ["Ссылка для родителя", `${window.location.origin}/auth?linkChild=${createdStudent.id}`],
            ] as const).map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="card-meta" style={{ minWidth: 130 }}>{label}:</span>
                <code style={{ padding: "5px 9px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", fontSize: 12.5, wordBreak: "break-all", flex: 1 }}>
                  {value}
                </code>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(label, value)}>
                  {copiedField === label ? "Скопировано" : "Копировать"}
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
