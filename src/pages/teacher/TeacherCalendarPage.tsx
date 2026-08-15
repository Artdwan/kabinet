import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import { SUBJECTS } from "../../data/content";

interface LessonRow {
  id: string;
  groupId: string | null;
  groupName: string | null;
  studentId: string | null;
  studentName: string | null;
  title: string;
  startAt: string;
  durationMinutes: number;
  format: "online" | "offline";
  location: string;
  status: "scheduled" | "done" | "cancelled";
  seriesId: string | null;
  note: string | null;
}

interface LessonDetail extends LessonRow {
  attendance: { studentId: string; name: string; status: "present" | "absent" | "excused" | null }[];
}

interface GroupRow {
  id: string;
  name: string;
  subjectId: string;
  grade: number | null;
}

interface RosterRow {
  id: string;
  name: string;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonthGrid(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfWeek(first);
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Запланировано", cls: "tag-accent" },
  done: { label: "Проведено", cls: "tag-ok" },
  cancelled: { label: "Отменено", cls: "tag-bad" },
};

const EVENT_COLORS = [
  { bg: "#3a2c14", accent: "#f5a623" },
  { bg: "#16302c", accent: "#35c5a2" },
  { bg: "#182640", accent: "#5b9dff" },
  { bg: "#331a33", accent: "#c77dff" },
  { bg: "#331414", accent: "#ff6b6b" },
  { bg: "#123024", accent: "#4ade80" },
];

function eventColor(key: string): { bg: string; accent: string } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 22 * 60;
const PX_PER_MIN = 1.6;
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;
const HOUR_LABELS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => DAY_START_MIN / 60 + i);

function minutesOfDay(iso: string): number {
  const [, time] = iso.split("T");
  const [h, m] = (time || "00:00").split(":").map(Number);
  return h * 60 + m;
}

export function TeacherCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { show } = useToast();
  const [view, setView] = useState<"day" | "week" | "month" | "year">("week");
  const [refDate, setRefDate] = useState(new Date());
  const [miniMonth, setMiniMonth] = useState(new Date());
  const { data: groups = [] } = useApiData<GroupRow[]>("/teacher/groups");
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");

  const [groupFilter, setGroupFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  const rangeStart =
    view === "year" ? new Date(refDate.getFullYear(), 0, 1) :
    view === "month" ? startOfMonthGrid(refDate) :
    view === "week" ? startOfWeek(refDate) :
    new Date(new Date(refDate).setHours(0, 0, 0, 0));
  const days = view === "year" ? 366 : view === "month" ? 42 : view === "week" ? 7 : 1;
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + days);

  const { data: lessonsRaw = [], reload } = useApiData<LessonRow[]>(
    `/teacher/lessons?from=${toDateInput(rangeStart)}&to=${toDateInput(rangeEnd)}`,
    [view, refDate.toDateString()],
  );

  const groupInfo = useMemo(() => {
    const map = new Map<string, GroupRow>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const lessons = useMemo(() => {
    return lessonsRaw.filter((l) => {
      if (groupFilter && l.groupId !== groupFilter) return false;
      if (subjectFilter && (!l.groupId || groupInfo.get(l.groupId)?.subjectId !== subjectFilter)) return false;
      if (gradeFilter && (!l.groupId || String(groupInfo.get(l.groupId)?.grade ?? "") !== gradeFilter)) return false;
      return true;
    });
  }, [lessonsRaw, groupFilter, subjectFilter, gradeFilter, groupInfo]);

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonRow[]>();
    lessons.forEach((l) => {
      const key = l.startAt.slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(l);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.startAt.localeCompare(b.startAt)));
    return map;
  }, [lessons]);

  const upcomingCount = lessonsRaw.length;

  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState(toDateInput(new Date()));
  const [createTime, setCreateTime] = useState("17:00");
  const [createTarget, setCreateTarget] = useState(""); // "group:<id>" or "student:<id>"
  const [createTitle, setCreateTitle] = useState("");
  const [createDuration, setCreateDuration] = useState("60");
  const [createFormat, setCreateFormat] = useState<"offline" | "online">("offline");
  const [createLocation, setCreateLocation] = useState("");
  const [createRepeat, setCreateRepeat] = useState(false);
  const [createUntil, setCreateUntil] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const preselectGroup = searchParams.get("newLessonGroup");
    if (preselectGroup) {
      setCreateTarget(`group:${preselectGroup}`);
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("newLessonGroup");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail, reload: reloadDetail } = useApiData<LessonDetail>(detailId ? `/teacher/lessons/${detailId}` : "", [detailId]);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, "present" | "absent" | "excused">>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  useEffect(() => {
    if (detail) {
      const draft: Record<string, "present" | "absent" | "excused"> = {};
      detail.attendance.forEach((a) => { if (a.status) draft[a.studentId] = a.status; });
      setAttendanceDraft(draft);
    }
  }, [detail]);

  const openCreateForDay = (date: Date) => {
    setCreateDate(toDateInput(date));
    setCreateOpen(true);
  };

  const createLesson = async () => {
    if (!createTarget || !createDate || !createTime) return;
    const [kind, id] = createTarget.split(":");
    setCreating(true);
    try {
      await api.post("/teacher/lessons", {
        groupId: kind === "group" ? id : undefined,
        studentId: kind === "student" ? id : undefined,
        title: createTitle.trim(),
        startAt: `${createDate}T${createTime}`,
        durationMinutes: Number(createDuration) || 60,
        format: createFormat,
        location: createLocation.trim(),
        repeatWeekly: createRepeat,
        repeatUntil: createRepeat && createUntil ? `${createUntil}T${createTime}` : undefined,
      });
      show("Занятие добавлено", "ok");
      setCreateOpen(false);
      setCreateTitle("");
      setCreateLocation("");
      setCreateRepeat(false);
      setCreateUntil("");
      reload();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать занятие", "bad");
    } finally {
      setCreating(false);
    }
  };

  const saveAttendance = async () => {
    if (!detail) return;
    setSavingAttendance(true);
    try {
      await api.post(`/teacher/lessons/${detail.id}/attendance`, {
        attendance: Object.entries(attendanceDraft).map(([studentId, status]) => ({ studentId, status })),
      });
      show("Посещаемость сохранена", "ok");
      reload();
      reloadDetail();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить", "bad");
    } finally {
      setSavingAttendance(false);
    }
  };

  const cancelLesson = async (scope: "single" | "series") => {
    if (!detail) return;
    try {
      await api.patch(`/teacher/lessons/${detail.id}`, { status: "cancelled", scope: scope === "series" ? "series" : undefined });
      show("Занятие отменено", "ok");
      setDetailId(null);
      reload();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось отменить", "bad");
    }
  };

  const deleteLesson = async () => {
    if (!detail) return;
    try {
      await api.del(`/teacher/lessons/${detail.id}`);
      show("Занятие удалено", "ok");
      setDetailId(null);
      reload();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить", "bad");
    }
  };

  const gridDays: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    gridDays.push(d);
  }

  const todayKey = toDateInput(new Date());

  const step = (dir: 1 | -1) => {
    const d = new Date(refDate);
    if (view === "year") d.setFullYear(d.getFullYear() + dir);
    else if (view === "month") d.setDate(d.getDate() + dir * 30);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setRefDate(d);
    setMiniMonth(d);
  };

  const grades = useMemo(() => Array.from(new Set(groups.map((g) => g.grade).filter((g): g is number => g != null))).sort((a, b) => a - b), [groups]);

  const miniGridStart = startOfMonthGrid(miniMonth);
  const miniDays: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(miniGridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const renderHourGrid = (dayList: Date[], columnLabel: (d: Date) => string) => (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${dayList.length}, 1fr)`, borderBottom: "1px solid var(--color-line)" }}>
        <div />
        {dayList.map((d) => {
          const key = toDateInput(d);
          return (
            <div
              key={key}
              style={{
                padding: "8px 4px", textAlign: "center", cursor: "pointer",
                background: key === todayKey ? "var(--color-accent-100)" : undefined,
                borderLeft: "1px solid var(--color-line)",
              }}
              onClick={() => openCreateForDay(d)}
            >
              <div className="card-meta" style={{ fontWeight: 600 }}>{columnLabel(d)}</div>
              <div style={{ fontSize: 15, color: key === todayKey ? "var(--color-accent)" : undefined }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${dayList.length}, 1fr)` }}>
        <div style={{ position: "relative", height: GRID_HEIGHT }}>
          {HOUR_LABELS.map((h) => (
            <div key={h} style={{ position: "absolute", top: (h * 60 - DAY_START_MIN) * PX_PER_MIN - 8, right: 8, fontSize: 12.5, color: "var(--color-text-3)" }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {dayList.map((d) => {
          const key = toDateInput(d);
          const dayLessons = lessonsByDay.get(key) || [];
          return (
            <div
              key={key}
              style={{
                position: "relative", height: GRID_HEIGHT, borderLeft: "1px solid var(--color-line)",
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px)`,
                cursor: "pointer",
              }}
              onClick={() => openCreateForDay(d)}
            >
              {dayLessons.map((l) => {
                const start = Math.max(minutesOfDay(l.startAt), DAY_START_MIN);
                const top = (start - DAY_START_MIN) * PX_PER_MIN;
                const height = Math.max(40, l.durationMinutes * PX_PER_MIN);
                const color = eventColor(l.groupId || l.studentId || l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDetailId(l.id); }}
                    style={{
                      position: "absolute", left: 4, right: 4, top, height,
                      background: color.bg, borderLeft: `4px solid ${color.accent}`,
                      borderRadius: 8, padding: "8px 10px", textAlign: "left", cursor: "pointer",
                      overflow: "hidden", color: "var(--color-text-1)",
                      opacity: l.status === "cancelled" ? 0.5 : 1,
                      boxShadow: "var(--shadow-sm)",
                    }}
                    title={`${l.startAt.slice(11, 16)} ${l.groupName || l.studentName || ""}`}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: color.accent }}>
                      {l.startAt.slice(11, 16)}{l.seriesId ? " ↻" : ""}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, textDecoration: l.status === "cancelled" ? "line-through" : undefined }}>
                      {l.groupName || l.studentName}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <aside style={{ width: 220, flex: "none", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{MONTH_NAMES[miniMonth.getMonth()]} {miniMonth.getFullYear()}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, fontSize: 10.5 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: "center", color: "var(--color-text-3)" }}>{w[0]}</div>
            ))}
            {miniDays.map((d) => {
              const key = toDateInput(d);
              const inMonth = d.getMonth() === miniMonth.getMonth();
              const selected = key === toDateInput(refDate);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setRefDate(d); if (view === "month") setMiniMonth(d); }}
                  style={{
                    aspectRatio: "1", borderRadius: 6, border: "none", cursor: "pointer",
                    background: selected ? "var(--color-accent)" : key === todayKey ? "var(--color-accent-100)" : "transparent",
                    color: selected ? "#1a1410" : inMonth ? "var(--color-text-1)" : "var(--color-text-3)",
                    fontSize: 11,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card-title" style={{ fontSize: 13 }}>Фильтры</div>
          <select className="input" style={{ fontSize: 12.5 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
            <option value="">Все классы</option>
            {grades.map((g) => <option key={g} value={g}>{g} класс</option>)}
          </select>
          <select className="input" style={{ fontSize: 12.5 }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">Все предметы</option>
            {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" style={{ fontSize: 12.5 }} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Все группы</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="card-meta" style={{ padding: "0 4px" }}>
          Занятий в этом периоде: {upcomingCount}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, minWidth: 160, textAlign: "center" }}>
              {view === "year"
                ? `${refDate.getFullYear()}`
                : view === "month"
                  ? `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`
                  : view === "week"
                    ? `Неделя с ${toDateInput(rangeStart)}`
                    : `${refDate.getDate()} ${MONTH_NAMES[refDate.getMonth()].toLowerCase()}`}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRefDate(new Date()); setMiniMonth(new Date()); }}>Сегодня</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="seg">
              <button type="button" className="seg-opt" style={view === "day" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("day")}>День</button>
              <button type="button" className="seg-opt" style={view === "week" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("week")}>Неделя</button>
              <button type="button" className="seg-opt" style={view === "month" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("month")}>Месяц</button>
              <button type="button" className="seg-opt" style={view === "year" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("year")}>Год</button>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setCreateDate(toDateInput(new Date())); setCreateOpen(true); }}>
              Добавить занятие
            </button>
          </div>
        </div>

        {view === "year" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {Array.from({ length: 12 }, (_, m) => {
              const monthDate = new Date(refDate.getFullYear(), m, 1);
              const monthGridStart = startOfMonthGrid(monthDate);
              const cells = Array.from({ length: 42 }, (_, i) => {
                const d = new Date(monthGridStart);
                d.setDate(d.getDate() + i);
                return d;
              });
              return (
                <div key={m} className="card" style={{ padding: 10 }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13.5, fontWeight: 600, color: "var(--color-text-1)", marginBottom: 6 }}
                    onClick={() => { setRefDate(monthDate); setMiniMonth(monthDate); setView("month"); }}
                  >
                    {MONTH_NAMES[m]}
                  </button>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, fontSize: 9.5 }}>
                    {WEEKDAYS.map((w) => (
                      <div key={w} style={{ textAlign: "center", color: "var(--color-text-3)" }}>{w[0]}</div>
                    ))}
                    {cells.map((d) => {
                      const key = toDateInput(d);
                      const inMonth = d.getMonth() === m;
                      const hasLessons = inMonth && (lessonsByDay.get(key)?.length ?? 0) > 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!inMonth}
                          onClick={() => { setRefDate(d); setView("day"); }}
                          style={{
                            aspectRatio: "1", border: "none", borderRadius: 4, cursor: inMonth ? "pointer" : "default",
                            background: key === todayKey ? "var(--color-accent-100)" : "transparent",
                            color: inMonth ? "var(--color-text-1)" : "var(--color-text-3)",
                            opacity: inMonth ? 1 : 0.3,
                            fontSize: 9.5, position: "relative",
                          }}
                        >
                          {d.getDate()}
                          {hasLessons && (
                            <span style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "var(--color-accent)" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "month" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="card-meta" style={{ textAlign: "center", fontWeight: 600 }}>{w}</div>
            ))}
            {gridDays.map((d) => {
              const key = toDateInput(d);
              const dayLessons = lessonsByDay.get(key) || [];
              const inMonth = d.getMonth() === refDate.getMonth();
              return (
                <div
                  key={key}
                  className="card"
                  style={{
                    minHeight: 90,
                    padding: 8,
                    opacity: inMonth ? 1 : 0.45,
                    borderColor: key === todayKey ? "var(--color-accent)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => openCreateForDay(d)}
                >
                  <div style={{ fontSize: 12.5, color: "var(--color-text-3)" }}>{d.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    {dayLessons.map((l) => {
                      const color = eventColor(l.groupId || l.studentId || l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDetailId(l.id); }}
                          className="tag"
                          style={{
                            textAlign: "left", fontSize: 11, whiteSpace: "normal", cursor: "pointer",
                            background: color.bg, color: color.accent,
                            opacity: l.status === "cancelled" ? 0.5 : 1,
                            textDecoration: l.status === "cancelled" ? "line-through" : undefined,
                          }}
                        >
                          {l.startAt.slice(11, 16)} {l.groupName || l.studentName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "week" ? (
          renderHourGrid(gridDays, (d) => WEEKDAYS[(d.getDay() + 6) % 7])
        ) : (
          renderHourGrid(gridDays, () => "Сегодня")
        )}
      </div>

      {createOpen && (
        <Modal
          title="Добавить занятие"
          onClose={() => setCreateOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!createTarget || !createDate || !createTime || creating} onClick={createLesson}>
                Создать
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Группа или ученик</label>
              <select className="input" value={createTarget} onChange={(e) => setCreateTarget(e.target.value)}>
                <option value="">Выберите...</option>
                <optgroup label="Группы">
                  {groups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                </optgroup>
                <optgroup label="Ученики (индивидуально)">
                  {roster.map((r) => <option key={r.id} value={`student:${r.id}`}>{r.name}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>Тема занятия (необязательно)</label>
              <input className="input" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Например, квадратные уравнения" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 150 }}>
                <label>Дата</label>
                <input className="input" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 110 }}>
                <label>Время</label>
                <input className="input" type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 110 }}>
                <label>Длительность, мин</label>
                <input className="input" type="number" value={createDuration} onChange={(e) => setCreateDuration(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 140 }}>
                <label>Формат</label>
                <select className="input" value={createFormat} onChange={(e) => setCreateFormat(e.target.value as "offline" | "online")}>
                  <option value="offline">Очно</option>
                  <option value="online">Онлайн</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Место / ссылка</label>
                <input className="input" value={createLocation} onChange={(e) => setCreateLocation(e.target.value)} placeholder="Кабинет 12 или ссылка на звонок" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={createRepeat} onChange={(e) => setCreateRepeat(e.target.checked)} />
              Повторять каждую неделю
            </label>
            {createRepeat && (
              <div className="field">
                <label>Повторять до</label>
                <input className="input" type="date" value={createUntil} onChange={(e) => setCreateUntil(e.target.value)} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {detailId && detail && (
        <Modal
          title={detail.groupName || detail.studentName || "Занятие"}
          onClose={() => setDetailId(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={deleteLesson}>Удалить</button>
              {detail.status === "scheduled" && (
                <button type="button" className="btn btn-secondary" onClick={() => cancelLesson(detail.seriesId ? "series" : "single")}>
                  {detail.seriesId ? "Отменить серию" : "Отменить"}
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={savingAttendance} onClick={saveAttendance}>
                Сохранить посещаемость
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="card-meta">{detail.startAt.slice(0, 10)} · {detail.startAt.slice(11, 16)} · {detail.durationMinutes} мин</span>
              <span className={`tag ${STATUS_LABEL[detail.status].cls}`}>{STATUS_LABEL[detail.status].label}</span>
            </div>
            {detail.title && <p className="card-body" style={{ margin: 0 }}>{detail.title}</p>}
            <p className="card-meta" style={{ margin: 0 }}>{detail.format === "online" ? "Онлайн" : "Очно"}{detail.location ? ` · ${detail.location}` : ""}</p>

            <div style={{ marginTop: 6 }}>
              <div className="card-title" style={{ fontSize: 14 }}>Посещаемость</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {detail.attendance.map((a) => (
                  <div key={a.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5 }}>{a.name}</span>
                    <div className="seg">
                      {(["present", "absent", "excused"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className="seg-opt"
                          style={attendanceDraft[a.studentId] === st ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined}
                          onClick={() => setAttendanceDraft((d) => ({ ...d, [a.studentId]: st }))}
                        >
                          {st === "present" ? "Был" : st === "absent" ? "Не был" : "Уваж."}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {detail.attendance.length === 0 && <div className="card-meta">Нет участников.</div>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
