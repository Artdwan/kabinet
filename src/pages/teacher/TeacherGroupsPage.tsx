import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
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

interface IndividualRow {
  id: string;
  name: string;
  grade: number | null;
  avg: number;
  goal: number;
  risk: "ok" | "attention" | "risk";
  lessonCount: number;
  nextLesson: { id: string; startAt: string; title: string } | null;
  lastLesson: { id: string; startAt: string; title: string } | null;
  scheduleSubjectId: string | null;
  scheduleSlots: ScheduleSlot[] | null;
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
  scheduleActive: boolean;
  scheduleFormat: "offline" | "online";
  scheduleLocation: string | null;
}

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Требует внимания", cls: "tag-bad" },
};

interface GroupRow {
  id: string;
  name: string;
  subjectId: string;
  grade: number | null;
  description: string | null;
  direction: "ct" | "school" | "improvement" | null;
  goal: string | null;
  scheduleSlots: ScheduleSlot[] | null;
  scheduleFormat: "offline" | "online";
  scheduleLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
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

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface ScheduleSlot {
  day: number;
  time: string;
}

function scheduleSummary(slots: ScheduleSlot[] | null): string | null {
  if (!slots || !slots.length) return null;
  return [...slots]
    .sort((a, b) => a.day - b.day)
    .map((s) => `${WEEKDAYS_SHORT[s.day]} ${s.time}`)
    .join(", ");
}

interface GroupFormState {
  name: string;
  subjectId: string;
  grade: string;
  description: string;
  direction: string;
  goal: string;
  scheduleSlots: ScheduleSlot[];
  scheduleFormat: "offline" | "online";
  scheduleLocation: string;
  startDate: string;
  endDate: string;
  active: boolean;
  color: string;
  maxStudents: string;
  hw: HwDefaults;
}

function emptyForm(): GroupFormState {
  return { name: "", subjectId: SUBJECTS[0]?.id ?? "", grade: "", description: "", direction: "", goal: "", scheduleSlots: [], scheduleFormat: "offline", scheduleLocation: "", startDate: "", endDate: "", active: true, color: "#e1ad66", maxStudents: "", hw: { ...DEFAULT_HW } };
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
    direction: g.direction || "", goal: g.goal || "", scheduleSlots: g.scheduleSlots || [],
    scheduleFormat: g.scheduleFormat || "offline", scheduleLocation: g.scheduleLocation || "",
    startDate: g.startDate || "",
    endDate: g.endDate || "", active: g.active,
    color: g.color || "#e1ad66", maxStudents: g.maxStudents ? String(g.maxStudents) : "", hw,
  };
}

export function TeacherGroupsPage() {
  const navigate = useNavigate();
  const { data: roster = [], reload: reloadRoster } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [], reload: reloadGroups } = useApiData<GroupRow[]>("/teacher/groups");
  const { data: individual = [], reload: reloadIndividual } = useApiData<IndividualRow[]>("/teacher/individual");
  const { show } = useToast();

  const [section, setSection] = useState<"groups" | "individual">("groups");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [indivSubjectFilter, setIndivSubjectFilter] = useState("");
  const [indivGradeFilter, setIndivGradeFilter] = useState("");
  const [indivStatusFilter, setIndivStatusFilter] = useState("");

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedIndividualIds, setSelectedIndividualIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
  const [newStudentStartScore, setNewStudentStartScore] = useState("");
  const [newStudentGoalScore, setNewStudentGoalScore] = useState("");
  const [newStudentStartGrade, setNewStudentStartGrade] = useState("");
  const [newStudentGoalGrade, setNewStudentGoalGrade] = useState("");
  const [savingMembers, setSavingMembers] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [materialGroupId, setMaterialGroupId] = useState<string | null>(null);
  const materialGroup = groups.find((g) => g.id === materialGroupId) ?? null;
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("theory");
  const [materialUrl, setMaterialUrl] = useState("");
  const [savingMaterial, setSavingMaterial] = useState(false);

  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonStudentId, setLessonStudentId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDate, setLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lessonTime, setLessonTime] = useState("17:00");
  const [lessonDuration, setLessonDuration] = useState("60");
  const [lessonFormat, setLessonFormat] = useState<"offline" | "online">("offline");
  const [lessonLocation, setLessonLocation] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [scheduleModalId, setScheduleModalId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ subjectId: string; slots: ScheduleSlot[]; startDate: string; endDate: string; active: boolean; format: "offline" | "online"; location: string }>({
    subjectId: "", slots: [], startDate: "", endDate: "", active: true, format: "offline", location: "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const grades = useMemo(() => Array.from(new Set(groups.map((g) => g.grade).filter((g): g is number => g != null))).sort((a, b) => a - b), [groups]);
  const indivGrades = useMemo(() => Array.from(new Set(individual.map((r) => r.grade).filter((g): g is number => g != null))).sort((a, b) => a - b), [individual]);
  const totalStudents = useMemo(() => new Set(groups.flatMap((g) => g.studentIds)).size, [groups]);
  const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;

  const rows = groups.filter((g) => {
    if (search.trim() && !g.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (subjectFilter && g.subjectId !== subjectFilter) return false;
    if (gradeFilter && String(g.grade ?? "") !== gradeFilter) return false;
    if (statusFilter === "attention" && g.attentionCount === 0) return false;
    return true;
  });

  const individualRows = individual.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (indivSubjectFilter && r.scheduleSubjectId !== indivSubjectFilter) return false;
    if (indivGradeFilter && String(r.grade ?? "") !== indivGradeFilter) return false;
    if (indivStatusFilter && r.risk !== indivStatusFilter) return false;
    return true;
  });

  const toggleGroupSelected = (id: string) => setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleIndividualSelected = (id: string) => setSelectedIndividualIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const bulkDeleteGroups = async () => {
    if (!selectedGroupIds.length) return;
    if (!window.confirm(`Удалить выбранные группы (${selectedGroupIds.length})? Их занятия и материалы будут удалены. Сами ученики останутся в системе.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedGroupIds) await api.del(`/teacher/groups/${id}`);
      show("Группы удалены", "ok");
      setSelectedGroupIds([]);
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить некоторые группы", "bad");
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkDeleteIndividual = async () => {
    if (!selectedIndividualIds.length) return;
    if (!window.confirm(`Удалить выбранных учеников (${selectedIndividualIds.length})? Это удалит их аккаунты и весь прогресс без возможности восстановления.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedIndividualIds) await api.del(`/teacher/students/${id}`);
      show("Ученики удалены", "ok");
      setSelectedIndividualIds([]);
      reloadIndividual();
      reloadRoster();
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить некоторых учеников", "bad");
    } finally {
      setBulkDeleting(false);
    }
  };

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
        scheduleSlots: form.scheduleSlots,
        scheduleFormat: form.scheduleFormat,
        scheduleLocation: form.scheduleLocation.trim() || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        active: form.active,
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

  const toggleScheduleDay = (day: number) => {
    setForm((f) => {
      const has = f.scheduleSlots.some((s) => s.day === day);
      const scheduleSlots = has
        ? f.scheduleSlots.filter((s) => s.day !== day)
        : [...f.scheduleSlots, { day, time: "17:00" }].sort((a, b) => a.day - b.day);
      return { ...f, scheduleSlots };
    });
  };

  const setScheduleTime = (day: number, time: string) => {
    setForm((f) => ({ ...f, scheduleSlots: f.scheduleSlots.map((s) => (s.day === day ? { ...s, time } : s)) }));
  };

  const deleteGroup = async () => {
    if (!editingId) return;
    if (!window.confirm("Удалить группу? Занятия и материалы этой группы будут удалены. Сами ученики останутся в системе.")) return;
    setSaving(true);
    try {
      await api.del(`/teacher/groups/${editingId}`);
      show("Группа удалена", "ok");
      setFormOpen(false);
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить группу", "bad");
    } finally {
      setSaving(false);
    }
  };

  const generateLessons = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { created } = await api.post<{ created: number }>(`/teacher/groups/${editingId}/generate-lessons`, {});
      show(created > 0 ? `Добавлено занятий: ${created}` : "Все занятия по расписанию уже в календаре", "ok");
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось внести занятия в календарь", "bad");
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
    const isGradeMode = membersGroup.direction === "school" || membersGroup.direction === "improvement";
    const scoreFields = isGradeMode
      ? { startGrade: newStudentStartGrade || undefined, goalGrade: newStudentGoalGrade || undefined }
      : { startScore: newStudentStartScore || undefined, goalScore: newStudentGoalScore || undefined };
    try {
      await api.post("/teacher/students", { name: newStudentName.trim(), lastName: newStudentLastName.trim(), email: newStudentEmail.trim(), groupId: membersGroup.id, ...scoreFields });
      show("Ученик создан и добавлен в группу", "ok");
      setNewStudentName(""); setNewStudentLastName(""); setNewStudentEmail("");
      setNewStudentStartScore(""); setNewStudentGoalScore(""); setNewStudentStartGrade(""); setNewStudentGoalGrade("");
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

  const openCreateLesson = () => {
    setLessonStudentId("");
    setLessonTitle("");
    setLessonDate(new Date().toISOString().slice(0, 10));
    setLessonTime("17:00");
    setLessonDuration("60");
    setLessonFormat("offline");
    setLessonLocation("");
    setLessonOpen(true);
  };

  const createIndividualLesson = async () => {
    if (!lessonStudentId || !lessonDate || !lessonTime) return;
    setCreatingLesson(true);
    try {
      await api.post("/teacher/lessons", {
        studentId: lessonStudentId,
        title: lessonTitle.trim(),
        startAt: `${lessonDate}T${lessonTime}`,
        durationMinutes: Number(lessonDuration) || 60,
        format: lessonFormat,
        location: lessonLocation.trim(),
      });
      show("Занятие добавлено", "ok");
      setLessonOpen(false);
      reloadIndividual();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать занятие", "bad");
    } finally {
      setCreatingLesson(false);
    }
  };

  const openScheduleSettings = (r: IndividualRow) => {
    setScheduleModalId(r.id);
    setScheduleForm({
      subjectId: r.scheduleSubjectId || "",
      slots: r.scheduleSlots || [],
      startDate: r.scheduleStartDate || "",
      endDate: r.scheduleEndDate || "",
      active: r.scheduleActive,
      format: r.scheduleFormat || "offline",
      location: r.scheduleLocation || "",
    });
  };

  const toggleIndivScheduleDay = (day: number) => {
    setScheduleForm((f) => {
      const has = f.slots.some((s) => s.day === day);
      const slots = has
        ? f.slots.filter((s) => s.day !== day)
        : [...f.slots, { day, time: "17:00" }].sort((a, b) => a.day - b.day);
      return { ...f, slots };
    });
  };

  const setIndivScheduleTime = (day: number, time: string) => {
    setScheduleForm((f) => ({ ...f, slots: f.slots.map((s) => (s.day === day ? { ...s, time } : s)) }));
  };

  const saveIndivSchedule = async () => {
    if (!scheduleModalId) return;
    setSavingSchedule(true);
    try {
      await api.patch(`/teacher/students/${scheduleModalId}`, {
        scheduleSubjectId: scheduleForm.subjectId || null,
        scheduleSlots: scheduleForm.slots,
        scheduleStartDate: scheduleForm.startDate || null,
        scheduleEndDate: scheduleForm.endDate || null,
        scheduleActive: scheduleForm.active,
        scheduleFormat: scheduleForm.format,
        scheduleLocation: scheduleForm.location.trim() || null,
      });
      show("Расписание сохранено", "ok");
      reloadIndividual();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить расписание", "bad");
    } finally {
      setSavingSchedule(false);
    }
  };

  const generateIndivLessons = async () => {
    if (!scheduleModalId) return;
    setSavingSchedule(true);
    try {
      const { created } = await api.post<{ created: number }>(`/teacher/students/${scheduleModalId}/generate-lessons`, {});
      show(created > 0 ? `Добавлено занятий: ${created}` : "Все занятия по расписанию уже в календаре", "ok");
      reloadIndividual();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось внести занятия в календарь", "bad");
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Занятия</h1>
          <p className="card-meta" style={{ margin: "2px 0 0" }}>Групп: {groups.length} · учеников в группах: {totalStudents} · индивидуально: {individual.length}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {section === "groups" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Создать группу</button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateLesson}>Добавить занятие</button>
          )}
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

      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button type="button" className="seg-opt" style={section === "groups" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setSection("groups")}>
          Группы
        </button>
        <button type="button" className="seg-opt" style={section === "individual" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setSection("individual")}>
          Индивидуальные
        </button>
      </div>

      {section === "groups" ? (
        <>
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

          {selectedGroupIds.length > 0 && (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px" }}>
              <span style={{ fontSize: 13.5 }}>Выбрано групп: {selectedGroupIds.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedGroupIds([])}>Снять выделение</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-bad)" }} disabled={bulkDeleting} onClick={bulkDeleteGroups}>Удалить выбранные</button>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="card-meta">{groups.length === 0 ? "Групп пока нет — создайте первую." : "Ничего не найдено по этим фильтрам."}</div>
          ) : view === "table" ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={selectedGroupIds.length === rows.length} onChange={() => setSelectedGroupIds(selectedGroupIds.length === rows.length ? [] : rows.map((g) => g.id))} /></th>
                  <th>Группа</th>
                  <th>Предмет</th>
                  <th>Учеников</th>
                  <th>Расписание</th>
                  <th>Средний балл</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} onClick={() => navigate(`/teacher/groups/${g.id}`)} style={{ cursor: "pointer" }}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={() => toggleGroupSelected(g.id)} /></td>
                    <td>{g.name}{g.grade ? ` · ${g.grade} класс` : ""}{g.direction ? ` · ${DIRECTION_LABEL[g.direction]}` : ""}</td>
                    <td>{subjectName(g.subjectId)}</td>
                    <td>{g.studentIds.length}</td>
                    <td>{scheduleSummary(g.scheduleSlots) || "—"}</td>
                    <td>{g.avgScore || "—"}</td>
                    <td>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.attentionCount > 0 && <span className="tag tag-bad">{g.attentionCount} отстают</span>}
                        {!g.active && <span className="tag tag-neutral">Неактивна</span>}
                        {g.active && g.endDate && <span className="tag tag-neutral">До {fmtDate(g.endDate)}</span>}
                        {g.active && !g.endDate && g.attentionCount === 0 && <span className="tag tag-ok">Активна</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div data-cols3>
              {rows.map((g) => (
                <div key={g.id} className="card" style={{ borderTop: g.color ? `3px solid ${g.color}` : undefined }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={() => toggleGroupSelected(g.id)} style={{ marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/teacher/groups/${g.id}`} className="card-title" style={{ fontSize: 15, textDecoration: "none", display: "block" }}>
                        {g.name}{g.grade ? ` · ${g.grade} класс` : ""}
                      </Link>
                      <div className="card-meta">{subjectName(g.subjectId)} · {g.studentIds.length} человек{g.direction ? ` · ${DIRECTION_LABEL[g.direction]}` : ""}</div>
                      {scheduleSummary(g.scheduleSlots) && <div className="card-meta">Расписание: {scheduleSummary(g.scheduleSlots)}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8, fontSize: 12.5 }}>
                    <div>{g.nextLesson ? `Ближайшее занятие: ${fmtDate(g.nextLesson.startAt.slice(0, 10))} · ${g.nextLesson.startAt.slice(11, 16)}` : "Занятий не запланировано"}</div>
                    {g.currentTopic && <div>Тема: {g.currentTopic}</div>}
                    {g.lastHomework && <div>ДЗ «{g.lastHomework.title}»: сдали {g.lastHomework.done} из {g.lastHomework.total}</div>}
                    <div>Средний балл: {g.avgScore || "—"}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.attentionCount > 0 && <span className="tag tag-bad" style={{ marginTop: 2 }}>{g.attentionCount} {g.attentionCount === 1 ? "ученик отстаёт" : "учеников отстают"}</span>}
                      {!g.active && <span className="tag tag-neutral" style={{ marginTop: 2 }}>Неактивна</span>}
                      {g.active && g.endDate && <span className="tag tag-neutral" style={{ marginTop: 2 }}>До {fmtDate(g.endDate)}</span>}
                    </div>
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
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)" }} />
              <input className="input" style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени" />
            </div>
            <select className="input" style={{ maxWidth: 200 }} value={indivSubjectFilter} onChange={(e) => setIndivSubjectFilter(e.target.value)}>
              <option value="">Все предметы</option>
              {SUBJECTS.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 140 }} value={indivGradeFilter} onChange={(e) => setIndivGradeFilter(e.target.value)}>
              <option value="">Все классы</option>
              {indivGrades.map((g) => <option key={g} value={g}>{g} класс</option>)}
            </select>
            <select className="input" style={{ maxWidth: 220 }} value={indivStatusFilter} onChange={(e) => setIndivStatusFilter(e.target.value)}>
              <option value="">Все ученики</option>
              <option value="risk">Требует внимания</option>
              <option value="attention">Внимание</option>
              <option value="ok">В норме</option>
            </select>
          </div>

          {selectedIndividualIds.length > 0 && (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px" }}>
              <span style={{ fontSize: 13.5 }}>Выбрано учеников: {selectedIndividualIds.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIndividualIds([])}>Снять выделение</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-bad)" }} disabled={bulkDeleting} onClick={bulkDeleteIndividual}>Удалить выбранные</button>
              </div>
            </div>
          )}

          {individualRows.length === 0 ? (
            <div className="card-meta">{individual.length === 0 ? "Учеников пока нет." : "Ничего не найдено по этому запросу."}</div>
          ) : view === "table" ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={selectedIndividualIds.length === individualRows.length} onChange={() => setSelectedIndividualIds(selectedIndividualIds.length === individualRows.length ? [] : individualRows.map((r) => r.id))} /></th>
                  <th>Ученик</th>
                  <th>Ближайшее занятие</th>
                  <th>Расписание</th>
                  <th>Средний балл</th>
                  <th>Занятий</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {individualRows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/teacher/students/${r.id}`)} style={{ cursor: "pointer" }}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIndividualIds.includes(r.id)} onChange={() => toggleIndividualSelected(r.id)} /></td>
                    <td>{r.name}{r.grade ? ` · ${r.grade} класс` : ""}</td>
                    <td>{r.nextLesson ? `${fmtDate(r.nextLesson.startAt.slice(0, 10))} · ${r.nextLesson.startAt.slice(11, 16)}` : "—"}</td>
                    <td>{scheduleSummary(r.scheduleSlots) || "—"}</td>
                    <td>{r.avg || "—"} / цель {r.goal}</td>
                    <td>{r.lessonCount}</td>
                    <td>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className={`tag ${RISK_LABEL[r.risk].cls}`}>{RISK_LABEL[r.risk].label}</span>
                        {r.scheduleSlots && r.scheduleSlots.length > 0 && !r.scheduleActive && <span className="tag tag-neutral">Расписание неактивно</span>}
                        {r.scheduleActive && r.scheduleEndDate && <span className="tag tag-neutral">До {fmtDate(r.scheduleEndDate)}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div data-cols3>
              {individualRows.map((r) => (
                <div key={r.id} className="card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <input type="checkbox" checked={selectedIndividualIds.includes(r.id)} onChange={() => toggleIndividualSelected(r.id)} style={{ marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <Link to={`/teacher/students/${r.id}`} className="card-title" style={{ fontSize: 15, textDecoration: "none" }}>{r.name}</Link>
                      <span className={`tag ${RISK_LABEL[r.risk].cls}`}>{RISK_LABEL[r.risk].label}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8, fontSize: 12.5 }}>
                    <div>{r.nextLesson ? `Ближайшее занятие: ${fmtDate(r.nextLesson.startAt.slice(0, 10))} · ${r.nextLesson.startAt.slice(11, 16)}` : "Занятий не запланировано"}</div>
                    <div>Средний балл: {r.avg || "—"} · цель {r.goal}</div>
                    <div>Индивидуальных занятий: {r.lessonCount}</div>
                    {scheduleSummary(r.scheduleSlots) && <div>Расписание: {scheduleSummary(r.scheduleSlots)}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.scheduleSlots && r.scheduleSlots.length > 0 && !r.scheduleActive && <span className="tag tag-neutral" style={{ marginTop: 2 }}>Расписание неактивно</span>}
                      {r.scheduleActive && r.scheduleEndDate && <span className="tag tag-neutral" style={{ marginTop: 2 }}>До {fmtDate(r.scheduleEndDate)}</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/teacher/students/${r.id}`)}>Открыть</button>
                    <Link to={`/teacher/calendar?newLessonStudent=${r.id}`} className="btn btn-secondary btn-sm">Занятие</Link>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openScheduleSettings(r)}>Настройки</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {formOpen && (
        <Modal
          title={editingId ? "Настройки группы" : "Создать группу"}
          onClose={() => setFormOpen(false)}
          actions={
            <>
              {editingId && <button type="button" className="btn btn-ghost" style={{ color: "var(--color-bad)", marginRight: "auto" }} disabled={saving} onClick={deleteGroup}>Удалить группу</button>}
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
            <div className="field">
              <label>Расписание (необязательно)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAYS_SHORT.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    className="btn btn-sm"
                    style={form.scheduleSlots.some((s) => s.day === day)
                      ? { color: "var(--color-accent)", background: "var(--color-accent-100)", border: "1px solid var(--color-accent)" }
                      : { background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
                    onClick={() => toggleScheduleDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.scheduleSlots.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {[...form.scheduleSlots].sort((a, b) => a.day - b.day).map((slot) => (
                    <div key={slot.day} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, minWidth: 32 }}>{WEEKDAYS_SHORT[slot.day]}</span>
                      <input
                        className="input"
                        type="time"
                        style={{ maxWidth: 110 }}
                        value={slot.time}
                        onChange={(e) => setScheduleTime(slot.day, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Формат занятий</label>
                <select className="input" value={form.scheduleFormat} onChange={(e) => setForm((f) => ({ ...f, scheduleFormat: e.target.value as "offline" | "online" }))}>
                  <option value="offline">Очно</option>
                  <option value="online">Онлайн</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Место / ссылка (необязательно)</label>
                <input className="input" value={form.scheduleLocation} onChange={(e) => setForm((f) => ({ ...f, scheduleLocation: e.target.value }))} placeholder="Кабинет 12 или ссылка на звонок" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Дата начала обучения</label>
                <input className="input" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Дата окончания (необязательно)</label>
                <input className="input" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Макс. учеников</label>
                <input className="input" type="number" min={1} value={form.maxStudents} onChange={(e) => setForm((f) => ({ ...f, maxStudents: e.target.value }))} placeholder="12" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Группа активна {!form.active && "— занятия по расписанию из этой группы будут удалены из календаря"}
            </label>
            {editingId && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={form.scheduleSlots.length === 0 || saving} onClick={generateLessons}>
                  Внести в календарь
                </button>
                {form.scheduleSlots.length === 0 && <span className="card-meta">Сначала укажите дни расписания выше</span>}
              </div>
            )}
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
              {membersGroup.direction === "school" || membersGroup.direction === "improvement" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input className="input" style={{ flex: 1 }} type="number" min={1} max={10} value={newStudentStartGrade} onChange={(e) => setNewStudentStartGrade(e.target.value)} placeholder="Начальная отметка" />
                  <input className="input" style={{ flex: 1 }} type="number" min={1} max={10} value={newStudentGoalGrade} onChange={(e) => setNewStudentGoalGrade(e.target.value)} placeholder="Желаемая отметка" />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input className="input" style={{ flex: 1 }} type="number" min={0} max={100} value={newStudentStartScore} onChange={(e) => setNewStudentStartScore(e.target.value)} placeholder="Начальный балл ЦТ" />
                  <input className="input" style={{ flex: 1 }} type="number" min={0} max={100} value={newStudentGoalScore} onChange={(e) => setNewStudentGoalScore(e.target.value)} placeholder="Целевой балл ЦТ" />
                </div>
              )}
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

      {lessonOpen && (
        <Modal
          title="Добавить индивидуальное занятие"
          onClose={() => setLessonOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setLessonOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!lessonStudentId || !lessonDate || !lessonTime || creatingLesson} onClick={createIndividualLesson}>
                Создать
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Ученик</label>
              <select className="input" value={lessonStudentId} onChange={(e) => setLessonStudentId(e.target.value)}>
                <option value="">Выберите...</option>
                {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Тема занятия (необязательно)</label>
              <input className="input" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Например, квадратные уравнения" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 150 }}>
                <label>Дата</label>
                <input className="input" type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 110 }}>
                <label>Время</label>
                <input className="input" type="time" value={lessonTime} onChange={(e) => setLessonTime(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 110 }}>
                <label>Длительность, мин</label>
                <input className="input" type="number" value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Формат</label>
                <select className="input" value={lessonFormat} onChange={(e) => setLessonFormat(e.target.value as "offline" | "online")}>
                  <option value="offline">Очно</option>
                  <option value="online">Онлайн</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Место / ссылка</label>
                <input className="input" value={lessonLocation} onChange={(e) => setLessonLocation(e.target.value)} placeholder="Кабинет 12 или ссылка на звонок" />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {scheduleModalId && (
        <Modal
          title={`Расписание — ${individual.find((r) => r.id === scheduleModalId)?.name ?? ""}`}
          onClose={() => setScheduleModalId(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setScheduleModalId(null)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={savingSchedule} onClick={saveIndivSchedule}>Сохранить</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Предмет</label>
              <select className="input" value={scheduleForm.subjectId} onChange={(e) => setScheduleForm((f) => ({ ...f, subjectId: e.target.value }))}>
                <option value="">Не указан</option>
                {SUBJECTS.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Расписание (необязательно)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAYS_SHORT.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    className="btn btn-sm"
                    style={scheduleForm.slots.some((s) => s.day === day)
                      ? { color: "var(--color-accent)", background: "var(--color-accent-100)", border: "1px solid var(--color-accent)" }
                      : { background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
                    onClick={() => toggleIndivScheduleDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {scheduleForm.slots.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {[...scheduleForm.slots].sort((a, b) => a.day - b.day).map((slot) => (
                    <div key={slot.day} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, minWidth: 32 }}>{WEEKDAYS_SHORT[slot.day]}</span>
                      <input
                        className="input"
                        type="time"
                        style={{ maxWidth: 110 }}
                        value={slot.time}
                        onChange={(e) => setIndivScheduleTime(slot.day, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Формат занятий</label>
                <select className="input" value={scheduleForm.format} onChange={(e) => setScheduleForm((f) => ({ ...f, format: e.target.value as "offline" | "online" }))}>
                  <option value="offline">Очно</option>
                  <option value="online">Онлайн</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Место / ссылка (необязательно)</label>
                <input className="input" value={scheduleForm.location} onChange={(e) => setScheduleForm((f) => ({ ...f, location: e.target.value }))} placeholder="Кабинет 12 или ссылка на звонок" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Дата начала</label>
                <input className="input" type="date" value={scheduleForm.startDate} onChange={(e) => setScheduleForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Дата окончания (необязательно)</label>
                <input className="input" type="date" value={scheduleForm.endDate} onChange={(e) => setScheduleForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={scheduleForm.active} onChange={(e) => setScheduleForm((f) => ({ ...f, active: e.target.checked }))} />
              Расписание активно {!scheduleForm.active && "— занятия по расписанию будут удалены из календаря"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={scheduleForm.slots.length === 0 || savingSchedule} onClick={generateIndivLessons}>
                Внести в календарь
              </button>
              {scheduleForm.slots.length === 0 && <span className="card-meta">Сначала укажите дни расписания выше</span>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
