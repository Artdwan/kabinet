import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { fmtDate } from "../../services/mockApi";
import { Modal } from "../../components/Modal";
import { SUBJECTS } from "../../data/content";

interface RosterRow {
  id: string;
  name: string;
  groupIds: string[];
}

interface GroupRow {
  id: string;
  name: string;
  subjectId: string;
  grade: number | null;
  description: string | null;
  direction: "ct" | "school" | "improvement" | null;
  goal: string | null;
  scheduleNote: string | null;
  startDate: string | null;
  color: string | null;
  maxStudents: number | null;
  hwDefaults: string | null;
  studentIds: string[];
  nextLesson: { id: string; startAt: string; title: string } | null;
  currentTopic: string | null;
  avgScore: number;
  attentionCount: number;
  lastHomework: { title: string; done: number; total: number } | null;
}

interface HwDefaults {
  dueDays: string;
  hintsAllowed: boolean;
  showSolutions: "after_due" | "after_submit" | "manual";
  maxAttempts: string;
  remindersEnabled: boolean;
}

const DEFAULT_HW: HwDefaults = { dueDays: "7", hintsAllowed: true, showSolutions: "after_due", maxAttempts: "3", remindersEnabled: true };

const DIRECTION_LABEL: Record<string, string> = { ct: "Подготовка к ЦТ", school: "Школьная программа", improvement: "Повышение успеваемости" };

interface GroupFormState {
  name: string;
  subjectId: string;
  grade: string;
  description: string;
  direction: string;
  goal: string;
  scheduleNote: string;
  startDate: string;
  color: string;
  maxStudents: string;
  hw: HwDefaults;
}

function emptyForm(): GroupFormState {
  return { name: "", subjectId: SUBJECTS[0]?.id ?? "", grade: "", description: "", direction: "", goal: "", scheduleNote: "", startDate: "", color: "#e1ad66", maxStudents: "", hw: { ...DEFAULT_HW } };
}

function formFromGroup(g: GroupRow): GroupFormState {
  let hw = { ...DEFAULT_HW };
  if (g.hwDefaults) {
    try {
      const parsed = JSON.parse(g.hwDefaults);
      hw = { dueDays: String(parsed.dueDays ?? 7), hintsAllowed: Boolean(parsed.hintsAllowed), showSolutions: parsed.showSolutions ?? "after_due", maxAttempts: String(parsed.maxAttempts ?? 3), remindersEnabled: Boolean(parsed.remindersEnabled) };
    } catch { /* keep defaults */ }
  }
  return {
    name: g.name, subjectId: g.subjectId, grade: g.grade ? String(g.grade) : "", description: g.description || "",
    direction: g.direction || "", goal: g.goal || "", scheduleNote: g.scheduleNote || "", startDate: g.startDate || "",
    color: g.color || "#e1ad66", maxStudents: g.maxStudents ? String(g.maxStudents) : "", hw,
  };
}

export function TeacherGroupsPage() {
  const navigate = useNavigate();
  const { data: roster = [], reload: reloadRoster } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [], reload: reloadGroups } = useApiData<GroupRow[]>("/teacher/groups");
  const { show } = useToast();

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [membersGroupId, setMembersGroupId] = useState<string | null>(null);
  const membersGroup = groups.find((g) => g.id === membersGroupId) ?? null;
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [savingMembers, setSavingMembers] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [materialGroupId, setMaterialGroupId] = useState<string | null>(null);
  const materialGroup = groups.find((g) => g.id === materialGroupId) ?? null;
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("theory");
  const [materialUrl, setMaterialUrl] = useState("");
  const [savingMaterial, setSavingMaterial] = useState(false);

  const grades = useMemo(() => Array.from(new Set(groups.map((g) => g.grade).filter((g): g is number => g != null))).sort((a, b) => a - b), [groups]);
  const totalStudents = useMemo(() => new Set(groups.flatMap((g) => g.studentIds)).size, [groups]);
  const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;

  const rows = groups.filter((g) => {
    if (search.trim() && !g.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (subjectFilter && g.subjectId !== subjectFilter) return false;
    if (gradeFilter && String(g.grade ?? "") !== gradeFilter) return false;
    if (statusFilter === "attention" && g.attentionCount === 0) return false;
    return true;
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (g: GroupRow) => { setEditingId(g.id); setForm(formFromGroup(g)); setFormOpen(true); };

  const saveGroup = async () => {
    if (!form.name.trim() || !form.subjectId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), subjectId: form.subjectId,
        grade: form.grade.trim() ? Number(form.grade) : null,
        description: form.description.trim() || null,
        direction: form.direction || null,
        goal: form.goal.trim() || null,
        scheduleNote: form.scheduleNote.trim() || null,
        startDate: form.startDate || null,
        color: form.color || null,
        maxStudents: form.maxStudents.trim() ? Number(form.maxStudents) : null,
        hwDefaults: JSON.stringify({
          dueDays: Number(form.hw.dueDays) || 7,
          hintsAllowed: form.hw.hintsAllowed,
          showSolutions: form.hw.showSolutions,
          maxAttempts: Number(form.hw.maxAttempts) || 3,
          remindersEnabled: form.hw.remindersEnabled,
        }),
      };
      if (editingId) {
        await api.patch(`/teacher/groups/${editingId}`, payload);
        show("Группа обновлена", "ok");
      } else {
        await api.post("/teacher/groups", payload);
        show("Группа создана", "ok");
      }
      setFormOpen(false);
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить группу", "bad");
    } finally {
      setSaving(false);
    }
  };

  const openMembers = (g: GroupRow) => { setMembersGroupId(g.id); setMemberSearch(""); setSelectedStudents([]); setNewStudentName(""); setNewStudentLastName(""); setNewStudentEmail(""); setLinkCopied(false); };

  const availableStudents = roster.filter((r) => !membersGroup || !r.groupIds.includes(membersGroup.id)).filter((r) => !memberSearch.trim() || r.name.toLowerCase().includes(memberSearch.trim().toLowerCase()));

  const toggleSelected = (id: string) => setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addSelectedMembers = async () => {
    if (!membersGroup || selectedStudents.length === 0) return;
    setSavingMembers(true);
    try {
      for (const studentId of selectedStudents) {
        await api.post(`/teacher/groups/${membersGroup.id}/members`, { studentId });
      }
      show("Ученики добавлены в группу", "ok");
      setSelectedStudents([]);
      reloadGroups();
      reloadRoster();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить учеников", "bad");
    } finally {
      setSavingMembers(false);
    }
  };

  const createAndAddStudent = async () => {
    if (!membersGroup || !newStudentName.trim() || !newStudentEmail.trim()) return;
    setSavingMembers(true);
    try {
      await api.post("/teacher/students", { name: newStudentName.trim(), lastName: newStudentLastName.trim(), email: newStudentEmail.trim(), groupId: membersGroup.id });
      show("Ученик создан и добавлен в группу", "ok");
      setNewStudentName(""); setNewStudentLastName(""); setNewStudentEmail("");
      reloadGroups();
      reloadRoster();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать ученика", "bad");
    } finally {
      setSavingMembers(false);
    }
  };

  const removeStudent = async (groupId: string, studentId: string) => {
    try {
      await api.del(`/teacher/groups/${groupId}/members/${studentId}`);
      show("Ученик убран из группы", "ok");
      reloadGroups();
      reloadRoster();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось убрать ученика", "bad");
    }
  };

  const copyInviteLink = async () => {
    if (!membersGroup) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join-group/${membersGroup.id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      show("Не удалось скопировать — выделите ссылку вручную", "bad");
    }
  };

  const saveMaterial = async () => {
    if (!materialGroup || !materialTitle.trim()) return;
    setSavingMaterial(true);
    try {
      await api.post("/teacher/materials", { groupId: materialGroup.id, title: materialTitle.trim(), type: materialType, url: materialUrl.trim() || undefined });
      show("Материал добавлен", "ok");
      setMaterialGroupId(null);
      setMaterialTitle("");
      setMaterialUrl("");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить материал", "bad");
    } finally {
      setSavingMaterial(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Группы</h1>
          <p className="card-meta" style={{ margin: "2px 0 0" }}>Групп: {groups.length} · учеников: {totalStudents}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Создать группу</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)" }} />
          <input className="input" style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию" />
        </div>
        <select className="input" style={{ maxWidth: 200 }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">Все предметы</option>
          {SUBJECTS.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 140 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">Все классы</option>
          {grades.map((g) => <option key={g} value={g}>{g} класс</option>)}
        </select>
        <select className="input" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Все группы</option>
          <option value="attention">Есть отстающие</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card-meta">{groups.length === 0 ? "Групп пока нет — создайте первую." : "Ничего не найдено по этим фильтрам."}</div>
      ) : (
        <div data-cols3>
          {rows.map((g) => (
            <div key={g.id} className="card" style={{ borderTop: g.color ? `3px solid ${g.color}` : undefined }}>
              <Link to={`/teacher/groups/${g.id}`} className="card-title" style={{ fontSize: 15, textDecoration: "none", display: "block" }}>
                {g.name}{g.grade ? ` · ${g.grade} класс` : ""}
              </Link>
              <div className="card-meta">{subjectName(g.subjectId)} · {g.studentIds.length} человек{g.direction ? ` · ${DIRECTION_LABEL[g.direction]}` : ""}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8, fontSize: 12.5 }}>
                <div>{g.nextLesson ? `Ближайшее занятие: ${fmtDate(g.nextLesson.startAt.slice(0, 10))} · ${g.nextLesson.startAt.slice(11, 16)}` : "Занятий не запланировано"}</div>
                {g.currentTopic && <div>Тема: {g.currentTopic}</div>}
                {g.lastHomework && <div>ДЗ «{g.lastHomework.title}»: сдали {g.lastHomework.done} из {g.lastHomework.total}</div>}
                <div>Средний балл: {g.avgScore || "—"}</div>
                {g.attentionCount > 0 && <span className="tag tag-bad" style={{ alignSelf: "flex-start", marginTop: 2 }}>{g.attentionCount} {g.attentionCount === 1 ? "ученик отстаёт" : "учеников отстают"}</span>}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/teacher/groups/${g.id}`)}>Открыть</button>
                <Link to={`/teacher/calendar?newLessonGroup=${g.id}`} className="btn btn-secondary btn-sm">Занятие</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openMembers(g)}>Ученик</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMaterialGroupId(g.id)}>Материал</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>Настройки</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <Modal
          title={editingId ? "Настройки группы" : "Создать группу"}
          onClose={() => setFormOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!form.name.trim() || !form.subjectId || saving} onClick={saveGroup}>
                {editingId ? "Сохранить" : "Создать"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 2, minWidth: 180 }}>
                <label>Название</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Например, Мат10" />
              </div>
              <div className="field" style={{ minWidth: 90 }}>
                <label>Класс</label>
                <input className="input" type="number" min={1} max={11} value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} placeholder="10" />
              </div>
              <div className="field" style={{ minWidth: 44 }}>
                <label>Цвет</label>
                <input className="input" type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} style={{ padding: 2, height: 34 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Предмет</label>
                <select className="input" value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
                  {SUBJECTS.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label>Направление</label>
                <select className="input" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
                  <option value="">Не указано</option>
                  <option value="ct">Подготовка к ЦТ</option>
                  <option value="school">Школьная программа</option>
                  <option value="improvement">Повышение успеваемости</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Цель группы (необязательно)</label>
              <input className="input" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Например, средний балл 80+" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Расписание (необязательно)</label>
                <input className="input" value={form.scheduleNote} onChange={(e) => setForm((f) => ({ ...f, scheduleNote: e.target.value }))} placeholder="Пн, Ср 17:00" />
              </div>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Дата начала обучения</label>
                <input className="input" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Макс. учеников</label>
                <input className="input" type="number" min={1} value={form.maxStudents} onChange={(e) => setForm((f) => ({ ...f, maxStudents: e.target.value }))} placeholder="12" />
              </div>
            </div>
            <div className="field">
              <label>Описание (необязательно)</label>
              <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Например, подготовка к ЦТ, вечерняя группа" />
            </div>

            <div className="card-title" style={{ fontSize: 13.5, marginTop: 4 }}>Настройки ДЗ по умолчанию</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Срок выполнения, дней</label>
                <input className="input" type="number" min={1} value={form.hw.dueDays} onChange={(e) => setForm((f) => ({ ...f, hw: { ...f.hw, dueDays: e.target.value } }))} />
              </div>
              <div className="field" style={{ minWidth: 160 }}>
                <label>Попыток на задание</label>
                <input className="input" type="number" min={1} value={form.hw.maxAttempts} onChange={(e) => setForm((f) => ({ ...f, hw: { ...f.hw, maxAttempts: e.target.value } }))} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label>Показывать решения</label>
                <select className="input" value={form.hw.showSolutions} onChange={(e) => setForm((f) => ({ ...f, hw: { ...f.hw, showSolutions: e.target.value as HwDefaults["showSolutions"] } }))}>
                  <option value="after_due">После срока сдачи</option>
                  <option value="after_submit">После сдачи ответа</option>
                  <option value="manual">Только вручную</option>
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={form.hw.hintsAllowed} onChange={(e) => setForm((f) => ({ ...f, hw: { ...f.hw, hintsAllowed: e.target.checked } }))} />
              Разрешить подсказки
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={form.hw.remindersEnabled} onChange={(e) => setForm((f) => ({ ...f, hw: { ...f.hw, remindersEnabled: e.target.checked } }))} />
              Отправлять напоминания о дедлайне
            </label>
          </div>
        </Modal>
      )}

      {membersGroup && (
        <Modal
          title={`Ученики — ${membersGroup.name}`}
          onClose={() => setMembersGroupId(null)}
          actions={<button type="button" className="btn btn-secondary" onClick={() => setMembersGroupId(null)}>Закрыть</button>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {membersGroup.studentIds.length > 0 && (
              <div>
                <div className="card-title" style={{ fontSize: 13 }}>В группе</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {membersGroup.studentIds.map((id) => {
                    const student = roster.find((r) => r.id === id);
                    return (
                      <span key={id} className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {student?.name ?? id}
                        <button type="button" onClick={() => removeStudent(membersGroup.id, id)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 12, padding: 0 }} title="Убрать из группы">×</button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="card-title" style={{ fontSize: 13 }}>Добавить существующих учеников</div>
              <input className="input" style={{ marginTop: 6 }} value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Поиск по имени" />
              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {availableStudents.length === 0 && <div className="card-meta">Нет подходящих учеников.</div>}
                {availableStudents.map((r) => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedStudents.includes(r.id)} onChange={() => toggleSelected(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={selectedStudents.length === 0 || savingMembers} onClick={addSelectedMembers}>
                Добавить выбранных ({selectedStudents.length})
              </button>
            </div>

            <div>
              <div className="card-title" style={{ fontSize: 13 }}>Или создать нового ученика</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <input className="input" style={{ flex: 1, minWidth: 120 }} value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Имя" />
                <input className="input" style={{ flex: 1, minWidth: 120 }} value={newStudentLastName} onChange={(e) => setNewStudentLastName(e.target.value)} placeholder="Фамилия" />
              </div>
              <input className="input" style={{ marginTop: 6 }} type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="Email для входа" />
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={!newStudentName.trim() || !newStudentEmail.trim() || savingMembers} onClick={createAndAddStudent}>
                Создать и добавить
              </button>
            </div>

            <div>
              <div className="card-title" style={{ fontSize: 13 }}>Ссылка-приглашение</div>
              <p className="card-meta" style={{ margin: "4px 0 6px" }}>Ученик перейдёт по ссылке, войдёт или зарегистрируется — и автоматически окажется в этой группе.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyInviteLink}>{linkCopied ? "Скопировано" : "Скопировать ссылку"}</button>
            </div>
          </div>
        </Modal>
      )}

      {materialGroup && (
        <Modal
          title={`Материал — ${materialGroup.name}`}
          onClose={() => setMaterialGroupId(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setMaterialGroupId(null)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!materialTitle.trim() || savingMaterial} onClick={saveMaterial}>Добавить</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Название</label>
              <input className="input" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Например, Формулы сокращённого умножения" />
            </div>
            <div className="field">
              <label>Тип</label>
              <select className="input" value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                <option value="theory">Теория</option>
                <option value="formula">Формулы</option>
                <option value="example">Разобранный пример</option>
                <option value="video">Видео</option>
                <option value="pdf">PDF</option>
                <option value="task">Тренировочные задания</option>
                <option value="recording">Запись занятия</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className="field">
              <label>Ссылка (необязательно)</label>
              <input className="input" value={materialUrl} onChange={(e) => setMaterialUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
