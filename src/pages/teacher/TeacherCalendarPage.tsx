import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";

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

export function TeacherCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { show } = useToast();
  const [view, setView] = useState<"week" | "month">("month");
  const [refDate, setRefDate] = useState(new Date());
  const { data: groups = [] } = useApiData<GroupRow[]>("/teacher/groups");
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");

  const rangeStart = view === "month" ? startOfMonthGrid(refDate) : startOfWeek(refDate);
  const days = view === "month" ? 42 : 7;
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + days);

  const { data: lessons = [], reload } = useApiData<LessonRow[]>(
    `/teacher/lessons?from=${toDateInput(rangeStart)}&to=${toDateInput(rangeEnd)}`,
    [view, refDate.toDateString()],
  );

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            const d = new Date(refDate);
            d.setDate(d.getDate() + (view === "month" ? -30 : -7));
            setRefDate(d);
          }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, minWidth: 160, textAlign: "center" }}>
            {view === "month" ? `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}` : `Неделя с ${toDateInput(rangeStart)}`}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            const d = new Date(refDate);
            d.setDate(d.getDate() + (view === "month" ? 30 : 7));
            setRefDate(d);
          }}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRefDate(new Date())}>Сегодня</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="seg">
            <button type="button" className="seg-opt" style={view === "week" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("week")}>Неделя</button>
            <button type="button" className="seg-opt" style={view === "month" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setView("month")}>Месяц</button>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setCreateDate(toDateInput(new Date())); setCreateOpen(true); }}>
            Добавить занятие
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="card-meta" style={{ textAlign: "center", fontWeight: 600 }}>{w}</div>
        ))}
        {gridDays.map((d) => {
          const key = toDateInput(d);
          const dayLessons = lessonsByDay.get(key) || [];
          const inMonth = view === "week" || d.getMonth() === refDate.getMonth();
          return (
            <div
              key={key}
              className="card"
              style={{
                minHeight: view === "month" ? 90 : 140,
                padding: 8,
                opacity: inMonth ? 1 : 0.45,
                borderColor: key === todayKey ? "var(--color-accent)" : undefined,
                cursor: "pointer",
              }}
              onClick={() => openCreateForDay(d)}
            >
              <div style={{ fontSize: 12.5, color: "var(--color-text-3)" }}>{d.getDate()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {dayLessons.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDetailId(l.id); }}
                    className={`tag ${l.status === "cancelled" ? "tag-bad" : l.status === "done" ? "tag-ok" : "tag-accent"}`}
                    style={{ textAlign: "left", fontSize: 11, whiteSpace: "normal", cursor: "pointer" }}
                  >
                    {l.startAt.slice(11, 16)} {l.groupName || l.studentName}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
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
