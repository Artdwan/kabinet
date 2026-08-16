import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import { SUBJECTS } from "../../data/content";

interface ScheduleSlot {
  day: number;
  time: string;
}

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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
  direction: "ct" | "school" | "improvement" | null;
}

interface CreatedStudent {
  id: string;
  email: string;
  password: string;
  name: string;
  lastName: string;
}

interface PendingInvite {
  token: string;
  name: string;
  lastName: string;
  grade: number | null;
  goalScore: number | null;
  groupIds: string[];
  groupNames: string[];
  createdAt: string;
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
  const { data: invites = [], reload: reloadInvites } = useApiData<PendingInvite[]>("/teacher/student-invites");
  const { show } = useToast();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"invite" | "password">("invite");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentGroupIds, setNewStudentGroupIds] = useState<string[]>([]);
  const [newStudentGrade, setNewStudentGrade] = useState("11");
  const [newStudentDirection, setNewStudentDirection] = useState<"ct" | "school">("ct");
  const [newStudentStartScore, setNewStudentStartScore] = useState("");
  const [newStudentGoal, setNewStudentGoal] = useState("85");
  const [newStudentStartGrade, setNewStudentStartGrade] = useState("");
  const [newStudentGoalGrade, setNewStudentGoalGrade] = useState("");
  const [newStudentNote, setNewStudentNote] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);

  const [indivScheduleEnabled, setIndivScheduleEnabled] = useState(false);
  const [indivSubjectId, setIndivSubjectId] = useState("");
  const [indivSlots, setIndivSlots] = useState<ScheduleSlot[]>([]);
  const [indivFormat, setIndivFormat] = useState<"offline" | "online">("offline");
  const [indivLocation, setIndivLocation] = useState("");
  const [indivStartDate, setIndivStartDate] = useState("");
  const [indivEndDate, setIndivEndDate] = useState("");
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const grades = useMemo(() => Array.from(new Set(roster.map((r) => r.grade))).sort((a, b) => a - b), [roster]);

  const rows = roster.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (groupFilter && !r.groupIds.includes(groupFilter)) return false;
    if (gradeFilter && r.grade !== Number(gradeFilter)) return false;
    if (statusFilter && r.risk !== statusFilter) return false;
    return true;
  });

  const toggleSelected = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)));

  const bulkDeleteStudents = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Удалить выбранных учеников (${selectedIds.length})? Это удалит их аккаунты и весь прогресс без возможности восстановления.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) await api.del(`/teacher/students/${id}`);
      show("Ученики удалены", "ok");
      setSelectedIds([]);
      reloadRoster();
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить некоторых учеников", "bad");
    } finally {
      setBulkDeleting(false);
    }
  };

  const isGradeMode = newStudentDirection === "school";

  const toggleNewStudentGroup = (id: string) => setNewStudentGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleIndivSlotDay = (day: number) => {
    setIndivSlots((prev) => {
      const has = prev.some((s) => s.day === day);
      return has ? prev.filter((s) => s.day !== day) : [...prev, { day, time: "17:00" }].sort((a, b) => a.day - b.day);
    });
  };
  const setIndivSlotTime = (day: number, time: string) => {
    setIndivSlots((prev) => prev.map((s) => (s.day === day ? { ...s, time } : s)));
  };

  const resetForm = () => {
    setNewStudentName("");
    setNewStudentLastName("");
    setNewStudentEmail("");
    setNewStudentGroupIds([]);
    setNewStudentGrade("11");
    setNewStudentDirection("ct");
    setNewStudentStartScore("");
    setNewStudentGoal("85");
    setNewStudentStartGrade("");
    setNewStudentGoalGrade("");
    setNewStudentNote("");
    setIndivScheduleEnabled(false);
    setIndivSubjectId("");
    setIndivSlots([]);
    setIndivFormat("offline");
    setIndivLocation("");
    setIndivStartDate("");
    setIndivEndDate("");
  };

  const createStudent = async () => {
    if (!newStudentName.trim()) return;
    if (addMode === "password" && !newStudentEmail.trim()) return;
    setCreatingStudent(true);
    const scoreFields = isGradeMode
      ? { startGrade: newStudentStartGrade || undefined, goalGrade: newStudentGoalGrade || undefined }
      : { startScore: newStudentStartScore || undefined, goalScore: newStudentGoal || undefined };
    const scheduleFields = indivScheduleEnabled
      ? {
          scheduleSubjectId: indivSubjectId || undefined,
          scheduleSlots: indivSlots,
          scheduleFormat: indivFormat,
          scheduleLocation: indivLocation.trim() || undefined,
          scheduleStartDate: indivStartDate || undefined,
          scheduleEndDate: indivEndDate || undefined,
        }
      : {};
    try {
      if (addMode === "invite") {
        const { token } = await api.post<{ token: string }>("/teacher/student-invites", {
          name: newStudentName.trim(),
          lastName: newStudentLastName.trim(),
          groupIds: newStudentGroupIds,
          grade: newStudentGrade || undefined,
          ...scoreFields,
          ...scheduleFields,
          note: newStudentNote.trim() || undefined,
        });
        setCreatedInviteLink(`${window.location.origin}/invite/${token}`);
        show("Приглашение создано", "ok");
        reloadInvites();
      } else {
        const created = await api.post<CreatedStudent>("/teacher/students", {
          name: newStudentName.trim(),
          lastName: newStudentLastName.trim(),
          email: newStudentEmail.trim(),
          groupIds: newStudentGroupIds,
          grade: newStudentGrade || undefined,
          ...scoreFields,
          ...scheduleFields,
          note: newStudentNote.trim() || undefined,
        });
        setCreatedStudent(created);
        show("Ученик создан", "ok");
        reloadRoster();
      }
      resetForm();
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось выполнить действие", "bad");
    } finally {
      setCreatingStudent(false);
    }
  };

  const cancelInvite = async (token: string) => {
    try {
      await api.del(`/teacher/student-invites/${token}`);
      show("Приглашение отменено", "ok");
      reloadInvites();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось отменить приглашение", "bad");
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

      {invites.length > 0 && (
        <div className="card" style={{ borderColor: "var(--color-accent)" }}>
          <div className="card-title" style={{ fontSize: 14 }}>Ожидают регистрации ({invites.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {invites.map((inv) => (
              <div key={inv.token} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5 }}>
                  {inv.name} {inv.lastName}
                  {inv.groupNames.length > 0 && <span className="card-meta"> · {inv.groupNames.join(", ")}</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="tag tag-accent">Ожидает регистрации</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(inv.token, `${window.location.origin}/invite/${inv.token}`)}>
                    {copiedField === inv.token ? "Скопировано" : "Ссылка"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancelInvite(inv.token)}>Отменить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px" }}>
          <span style={{ fontSize: 13.5 }}>Выбрано учеников: {selectedIds.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>Снять выделение</button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-bad)" }} disabled={bulkDeleting} onClick={bulkDeleteStudents}>Удалить выбранные</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card-meta">{roster.length === 0 ? "Учеников пока нет — добавьте первого." : "Ничего не найдено по этим фильтрам."}</div>
      ) : view === "table" ? (
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={selectedIds.length === rows.length} onChange={toggleSelectAll} /></th>
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
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelected(r.id)} /></td>
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
            <div key={r.id} className="card" style={{ cursor: "pointer" }} onClick={() => navigate(`/teacher/students/${r.id}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelected(r.id)} onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }} />
                  <div className="card-title" style={{ fontSize: 15 }}>{r.name}</div>
                </div>
                <span className={`tag ${RISK_LABEL[r.risk].cls}`}>{RISK_LABEL[r.risk].label}</span>
              </div>
              <div className="card-meta">{r.groupNames.join(", ") || "Без группы"}{r.grade ? ` · ${r.grade} класс` : ""}</div>
              <div className="card-meta">Цель {r.goal} · результат {r.avg || "—"}</div>
              <div className="card-meta">{r.overdue > 0 ? `${r.overdue} просрочено` : "нет просроченных"}</div>
              <div className="card-meta">Активность: {r.lastActive ? fmtDate(r.lastActive.slice(0, 10)) : "—"}</div>
            </div>
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
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newStudentName.trim() || (addMode === "password" && !newStudentEmail.trim()) || creatingStudent}
                onClick={createStudent}
              >
                {addMode === "invite" ? "Создать приглашение" : "Создать"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              <button type="button" className="seg-opt" style={addMode === "invite" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setAddMode("invite")}>
                Пригласить ссылкой
              </button>
              <button type="button" className="seg-opt" style={addMode === "password" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setAddMode("password")}>
                Создать с паролем
              </button>
            </div>
            <p className="card-meta" style={{ margin: 0 }}>
              {addMode === "invite"
                ? "Ученик сам выберет email и пароль по ссылке-приглашению. В списке появится как «Ожидает регистрации», пока не зарегистрируется."
                : "Вы сразу указываете email, система выдаст пароль для первого входа."}
            </p>
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
            {addMode === "password" && (
              <div className="field">
                <label>Email для входа</label>
                <input className="input" type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="ученик@example.com" />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 120 }}>
                <label>Класс</label>
                <input className="input" type="number" min={1} max={11} value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label>Направление</label>
                <select className="input" value={newStudentDirection} onChange={(e) => setNewStudentDirection(e.target.value as "ct" | "school")}>
                  <option value="ct">Подготовка к ЦТ</option>
                  <option value="school">Школьная программа</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Группы (необязательно, можно выбрать несколько)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto", border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: 8 }}>
                {groups.length === 0 && <div className="card-meta">Групп пока нет.</div>}
                {groups.map((g) => (
                  <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={newStudentGroupIds.includes(g.id)} onChange={() => toggleNewStudentGroup(g.id)} />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
            {isGradeMode ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Начальная отметка</label>
                  <input className="input" type="number" min={1} max={10} value={newStudentStartGrade} onChange={(e) => setNewStudentStartGrade(e.target.value)} placeholder="6" />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Желаемая отметка</label>
                  <input className="input" type="number" min={1} max={10} value={newStudentGoalGrade} onChange={(e) => setNewStudentGoalGrade(e.target.value)} placeholder="9" />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Начальный балл ЦТ</label>
                  <input className="input" type="number" min={0} max={100} value={newStudentStartScore} onChange={(e) => setNewStudentStartScore(e.target.value)} placeholder="40" />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Целевой балл ЦТ</label>
                  <input className="input" type="number" min={0} max={100} value={newStudentGoal} onChange={(e) => setNewStudentGoal(e.target.value)} />
                </div>
              </div>
            )}
            <div className="field">
              <label>Заметка преподавателя (необязательно)</label>
              <input className="input" value={newStudentNote} onChange={(e) => setNewStudentNote(e.target.value)} placeholder="Например, приходит по вечерам, слабая алгебра" />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={indivScheduleEnabled} onChange={(e) => setIndivScheduleEnabled(e.target.checked)} />
              Сразу настроить индивидуальные занятия
            </label>
            {indivScheduleEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12, border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)" }}>
                <div className="field">
                  <label>Предмет</label>
                  <select className="input" value={indivSubjectId} onChange={(e) => setIndivSubjectId(e.target.value)}>
                    <option value="">Не указан</option>
                    {SUBJECTS.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Расписание</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {WEEKDAYS_SHORT.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        className="btn btn-sm"
                        style={indivSlots.some((sl) => sl.day === day)
                          ? { color: "var(--color-accent)", background: "var(--color-accent-100)", border: "1px solid var(--color-accent)" }
                          : { background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
                        onClick={() => toggleIndivSlotDay(day)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {indivSlots.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {[...indivSlots].sort((a, b) => a.day - b.day).map((slot) => (
                        <div key={slot.day} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13.5, minWidth: 32 }}>{WEEKDAYS_SHORT[slot.day]}</span>
                          <input className="input" type="time" style={{ maxWidth: 110 }} value={slot.time} onChange={(e) => setIndivSlotTime(slot.day, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div className="field" style={{ minWidth: 140 }}>
                    <label>Формат</label>
                    <select className="input" value={indivFormat} onChange={(e) => setIndivFormat(e.target.value as "offline" | "online")}>
                      <option value="offline">Очно</option>
                      <option value="online">Онлайн</option>
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 180 }}>
                    <label>Место / ссылка</label>
                    <input className="input" value={indivLocation} onChange={(e) => setIndivLocation(e.target.value)} placeholder="Кабинет 12 или ссылка на звонок" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label>Дата начала</label>
                    <input className="input" type="date" value={indivStartDate} onChange={(e) => setIndivStartDate(e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label>Дата окончания (необязательно)</label>
                    <input className="input" type="date" value={indivEndDate} onChange={(e) => setIndivEndDate(e.target.value)} />
                  </div>
                </div>
                <p className="card-meta" style={{ margin: 0 }}>После создания зайдите в Занятия → Индивидуальные → Настройки, чтобы внести занятия в календарь.</p>
              </div>
            )}
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

      {createdInviteLink && (
        <Modal
          title="Приглашение создано"
          onClose={() => { setCreatedInviteLink(null); setAddOpen(false); }}
          actions={<button type="button" className="btn btn-primary" onClick={() => { setCreatedInviteLink(null); setAddOpen(false); }}>Готово</button>}
        >
          <p className="card-body" style={{ margin: "0 0 8px" }}>
            Отправьте ученику эту ссылку — он перейдёт по ней, зарегистрируется сам, и появится в списке учеников.
            Пока он не зарегистрировался, приглашение будет отмечено как «Ожидает регистрации».
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ padding: "5px 9px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", fontSize: 12.5, wordBreak: "break-all", flex: 1 }}>
              {createdInviteLink}
            </code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy("invite-link", createdInviteLink)}>
              {copiedField === "invite-link" ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
