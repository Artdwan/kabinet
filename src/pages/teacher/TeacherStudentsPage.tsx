import { useState } from "react";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Chip, ChipRow } from "../../components/Chip";
import { SUBJECTS } from "../../data/content";

interface RosterRow {
  id: string;
  name: string;
  grade: number;
  avg: number;
  goal: number;
  done: number;
  total: number;
  weak: string;
  lastActive: string | null;
  risk: "ok" | "attention" | "risk";
}

interface GroupRow {
  id: string;
  name: string;
  subjectId: string;
  studentIds: string[];
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
  risk: { label: "Риск", cls: "tag-bad" },
};

export function TeacherStudentsPage() {
  const [group, setGroup] = useState<string | null>(null);
  const { data: roster = [], reload: reloadRoster } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [], reload: reloadGroups } = useApiData<GroupRow[]>("/teacher/groups");
  const { show } = useToast();

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSubject, setNewGroupSubject] = useState(SUBJECTS[0]?.id ?? "");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [addEmail, setAddEmail] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const rows = roster.filter((s) => {
    if (!group) return true;
    return groups.find((g) => g.id === group)?.studentIds.includes(s.id);
  });

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      await api.post("/teacher/groups", { name: newGroupName.trim(), subjectId: newGroupSubject });
      setNewGroupName("");
      show("Группа создана", "ok");
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать группу", "bad");
    } finally {
      setCreatingGroup(false);
    }
  };

  const addStudent = async () => {
    if (!group || !addEmail.trim()) return;
    setAddingStudent(true);
    try {
      await api.post(`/teacher/groups/${group}/members`, { email: addEmail.trim() });
      setAddEmail("");
      show("Ученик добавлен в группу", "ok");
      reloadGroups();
      reloadRoster();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить ученика", "bad");
    } finally {
      setAddingStudent(false);
    }
  };

  const createStudent = async () => {
    if (!newStudentName.trim() || !newStudentEmail.trim()) return;
    setCreatingStudent(true);
    try {
      const created = await api.post<CreatedStudent>("/teacher/students", {
        name: newStudentName.trim(),
        lastName: newStudentLastName.trim(),
        email: newStudentEmail.trim(),
        groupId: group || undefined,
      });
      setCreatedStudent(created);
      setNewStudentName("");
      setNewStudentLastName("");
      setNewStudentEmail("");
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
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Новая группа</label>
          <input className="input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Например, 10 «Б» · химия" />
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Предмет</label>
          <select className="input" value={newGroupSubject} onChange={(e) => setNewGroupSubject(e.target.value)}>
            {SUBJECTS.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!newGroupName.trim() || creatingGroup} onClick={createGroup}>
          Создать группу
        </button>
      </div>

      <ChipRow>
        <Chip active={group === null} onClick={() => setGroup(null)}>Все группы</Chip>
        {groups.map((g) => (
          <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</Chip>
        ))}
      </ChipRow>

      {groups.length === 0 && (
        <div className="card-meta">Групп пока нет — создайте первую, чтобы добавлять учеников.</div>
      )}

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Создать ученика — имя</label>
          <input className="input" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Максим" />
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Фамилия</label>
          <input className="input" value={newStudentLastName} onChange={(e) => setNewStudentLastName(e.target.value)} placeholder="Ковалевич" />
        </div>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Email</label>
          <input className="input" type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="ученик@example.com" />
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!newStudentName.trim() || !newStudentEmail.trim() || creatingStudent} onClick={createStudent}>
          Создать
        </button>
        <span className="card-meta" style={{ width: "100%" }}>
          {group ? `Будет сразу добавлен в «${groups.find((g) => g.id === group)?.name}».` : "Выберите группу выше, чтобы сразу добавить ученика в неё (необязательно)."}
        </span>
      </div>

      {createdStudent && (
        <div className="card" style={{ borderColor: "var(--color-ok)" }}>
          <div className="card-title" style={{ fontSize: 15 }}>
            Ученик «{createdStudent.name} {createdStudent.lastName}» создан
          </div>
          <p className="card-body" style={{ margin: 0 }}>
            Передайте ученику логин и пароль для первого входа, а родителю — ссылку для привязки аккаунта.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
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
        </div>
      )}

      {group && (
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 260 }}>
            <label>Добавить уже зарегистрированного ученика в «{groups.find((g) => g.id === group)?.name}» по email</label>
            <input className="input" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="ученик@example.com" />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={!addEmail.trim() || addingStudent} onClick={addStudent}>
            Добавить
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card-meta">Учеников пока нет.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Средний балл</th>
              <th>Цель</th>
              <th>Выполнено</th>
              <th>Слабая тема</th>
              <th>Активность</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.avg}</td>
                <td>{s.goal}</td>
                <td>{s.done}/{s.total}</td>
                <td>{s.weak || "—"}</td>
                <td>{s.lastActive ? fmtDate(s.lastActive.slice(0, 10)) : "—"}</td>
                <td><span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
