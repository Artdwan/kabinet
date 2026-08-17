import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { fmtDate } from "../../services/mockApi";
import { MetricCard } from "../../components/MetricCard";
import { Modal } from "../../components/Modal";
import { SUBJECTS } from "../../data/content";

interface StudentRow {
  id: string;
  name: string;
  avg: number;
  goal: number;
  done: number;
  total: number;
  overdue: number;
  lastActive: string | null;
  attendancePct: number | null;
  risk: "ok" | "attention" | "risk";
}

interface FreezeRow {
  id: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

interface WeakTopic {
  topicId: string;
  topicName: string;
  accuracy: number;
}

interface HomeworkStat {
  id: string;
  title: string;
  dueAt: string;
  groupDone: number;
  groupTotal: number;
  submittedCount: number;
  reviewedCount: number;
}

interface LessonBrief {
  id: string;
  startAt: string;
  title: string;
  status?: string;
}

interface LessonRow {
  id: string;
  startAt: string;
  title: string;
  durationMinutes: number;
  format: "online" | "offline";
  location: string;
  status: "scheduled" | "done" | "cancelled";
}

interface MaterialRow {
  id: string;
  title: string;
  type: string;
  url: string | null;
  content: string | null;
  createdAt: string;
}

interface PendingInvite {
  token: string;
  name: string;
  lastName: string;
  groupIds: string[];
}

const MATERIAL_TYPE_LABEL: Record<string, string> = {
  theory: "Теория", formula: "Формулы", example: "Пример", video: "Видео",
  pdf: "PDF", task: "Задания", recording: "Запись занятия", other: "Другое",
};

const LESSON_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Запланировано", cls: "tag-accent" },
  done: { label: "Проведено", cls: "tag-ok" },
  cancelled: { label: "Отменено", cls: "tag-bad" },
};

interface GroupWorkspace {
  id: string;
  name: string;
  subjectId: string;
  grade: number | null;
  description: string | null;
  students: StudentRow[];
  avgScore: number;
  weakTopics: WeakTopic[];
  homeworkStats: HomeworkStat[];
  upcomingLessons: LessonBrief[];
  recentLessons: LessonBrief[];
}

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Требует внимания", cls: "tag-bad" },
};

type Tab = "overview" | "students" | "lessons" | "homework" | "materials" | "progress";

export function TeacherGroupWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const { data: g } = useApiData<GroupWorkspace>(`/teacher/groups/${id}`);
  const { data: lessons = [] } = useApiData<LessonRow[]>(`/teacher/lessons?groupId=${id}`);
  const { data: materials = [], reload: reloadMaterials } = useApiData<MaterialRow[]>(`/teacher/materials?groupId=${id}`);
  const { data: invites = [], reload: reloadInvites } = useApiData<PendingInvite[]>("/teacher/student-invites");
  const { data: freezes = [], reload: reloadFreezes } = useApiData<FreezeRow[]>(id ? `/teacher/groups/${id}/freezes` : "");
  const [tab, setTab] = useState<Tab>("overview");

  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("theory");
  const [materialUrl, setMaterialUrl] = useState("");
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [freezeStudentId, setFreezeStudentId] = useState<string | null>(null);
  const [freezeStart, setFreezeStart] = useState("");
  const [freezeEnd, setFreezeEnd] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [savingFreeze, setSavingFreeze] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const activeFreezeFor = (studentId: string) => freezes.find((f) => f.studentId === studentId && f.startDate <= todayKey && todayKey <= f.endDate);

  const openFreeze = (studentId: string) => {
    setFreezeStudentId(studentId);
    setFreezeStart(""); setFreezeEnd(""); setFreezeReason("");
  };

  const addFreeze = async () => {
    if (!id || !freezeStudentId || !freezeStart || !freezeEnd) return;
    setSavingFreeze(true);
    try {
      await api.post(`/teacher/groups/${id}/members/${freezeStudentId}/freeze`, { startDate: freezeStart, endDate: freezeEnd, reason: freezeReason.trim() || undefined });
      show("Заморозка добавлена", "ok");
      setFreezeStudentId(null);
      reloadFreezes();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить заморозку", "bad");
    } finally {
      setSavingFreeze(false);
    }
  };

  const removeFreeze = async (freezeId: string) => {
    if (!id) return;
    try {
      await api.del(`/teacher/groups/${id}/freezes/${freezeId}`);
      show("Заморозка снята", "ok");
      reloadFreezes();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось снять заморозку", "bad");
    }
  };

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      show("Не удалось скопировать — выделите ссылку вручную", "bad");
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

  const addMaterial = async () => {
    if (!id || !materialTitle.trim()) return;
    setSavingMaterial(true);
    try {
      await api.post("/teacher/materials", { groupId: id, title: materialTitle.trim(), type: materialType, url: materialUrl.trim() || undefined });
      show("Материал добавлен", "ok");
      setMaterialTitle("");
      setMaterialUrl("");
      reloadMaterials();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить материал", "bad");
    } finally {
      setSavingMaterial(false);
    }
  };

  const deleteMaterial = async (materialId: string) => {
    try {
      await api.del(`/teacher/materials/${materialId}`);
      reloadMaterials();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить материал", "bad");
    }
  };

  if (!g) return <div className="card-meta">Загрузка…</div>;

  const subjectName = SUBJECTS.find((s) => s.id === g.subjectId)?.name ?? g.subjectId;
  const needAttention = g.students.filter((s) => s.risk !== "ok");
  const groupInvites = invites.filter((inv) => inv.groupIds.includes(g.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/teacher/groups")} style={{ marginBottom: 8 }}>
          <ArrowLeft size={14} /> К списку групп
        </button>
        <h1 style={{ margin: 0, fontSize: 24 }}>{g.name}</h1>
        <p className="card-meta">{subjectName}{g.grade ? ` · ${g.grade} класс` : ""} · учеников: {g.students.length}</p>
        {g.description && <p className="card-body" style={{ margin: "4px 0 0" }}>{g.description}</p>}
      </div>

      <div data-cols3>
        <MetricCard label="Средний балл группы" value={g.avgScore} />
        <MetricCard label="Учеников" value={g.students.length} />
        <MetricCard label="Требуют внимания" value={needAttention.length} tone={needAttention.length ? "bad" : "ok"} />
      </div>

      <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
        <button type="button" className="seg-opt" style={tab === "overview" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("overview")}>Обзор</button>
        <button type="button" className="seg-opt" style={tab === "students" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("students")}>Ученики</button>
        <button type="button" className="seg-opt" style={tab === "lessons" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("lessons")}>Занятия</button>
        <button type="button" className="seg-opt" style={tab === "homework" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("homework")}>Домашние задания</button>
        <button type="button" className="seg-opt" style={tab === "materials" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("materials")}>Материалы</button>
        <button type="button" className="seg-opt" style={tab === "progress" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("progress")}>Прогресс</button>
      </div>

      {tab === "overview" && (
        <div data-cols2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="card-title" style={{ fontSize: 15 }}>Ближайшие занятия</div>
                <Link to="/teacher/calendar" className="btn btn-ghost btn-sm">Календарь</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {g.upcomingLessons.length === 0 && <div className="card-meta">Занятий не запланировано.</div>}
                {g.upcomingLessons.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span>{l.title || "Занятие"}</span>
                    <span className="card-meta">{fmtDate(l.startAt.slice(0, 10))} · {l.startAt.slice(11, 16)}</span>
                  </div>
                ))}
              </div>
              <Link to={`/teacher/calendar?newLessonGroup=${g.id}`} className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start", marginTop: 10 }}>
                Добавить занятие
              </Link>
            </div>

            <div className="card">
              <div className="card-title" style={{ fontSize: 15 }}>Требуют внимания</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {needAttention.length === 0 && <div className="card-meta">Все ученики в норме.</div>}
                {needAttention.map((s) => (
                  <Link key={s.id} to={`/teacher/students/${s.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, textDecoration: "none", color: "inherit" }}>
                    <span>{s.name}</span>
                    <span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Слабые темы группы</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {g.weakTopics.length === 0 && <div className="card-meta">Пока нет данных по тестам.</div>}
              {g.weakTopics.map((t) => (
                <div key={t.topicId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span>{t.topicName}</span>
                  <span className="card-meta">{t.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "students" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupInvites.length > 0 && (
            <div className="card" style={{ borderColor: "var(--color-accent)" }}>
              <div className="card-title" style={{ fontSize: 14 }}>Ожидают регистрации ({groupInvites.length})</div>
              <p className="card-meta" style={{ margin: "4px 0 8px" }}>
                Приглашены в эту группу, но ещё не зарегистрировались — как только перейдут по ссылке, появятся в списке ниже.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groupInvites.map((inv) => (
                  <div key={inv.token} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13.5 }}>{inv.name} {inv.lastName}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="tag tag-accent">Ожидает регистрации</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyInviteLink(inv.token)}>
                        {copiedToken === inv.token ? "Скопировано" : "Ссылка"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancelInvite(inv.token)}>Отменить</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Посещаемость</th>
                <th>ДЗ</th>
                <th>Средний балл</th>
                <th>Последняя активность</th>
                <th>Статус</th>
                <th>Заморозка</th>
              </tr>
            </thead>
            <tbody>
              {g.students.map((s) => {
                const freeze = activeFreezeFor(s.id);
                return (
                  <tr key={s.id} onClick={() => navigate(`/teacher/students/${s.id}`)} style={{ cursor: "pointer" }}>
                    <td>{s.name}</td>
                    <td>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</td>
                    <td>{s.done}/{s.total}{s.overdue > 0 ? ` (${s.overdue} просрочено)` : ""}</td>
                    <td>{s.avg || "—"}</td>
                    <td>{s.lastActive ? fmtDate(s.lastActive.slice(0, 10)) : "—"}</td>
                    <td><span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {freeze ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="tag tag-neutral">До {fmtDate(freeze.endDate)}</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeFreeze(freeze.id)}>Снять</button>
                        </span>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openFreeze(s.id)}>Заморозить</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {g.students.length === 0 && <tr><td colSpan={7} className="card-meta">В группе пока нет учеников.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "lessons" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link to={`/teacher/calendar?newLessonGroup=${g.id}`} className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }}>
            Добавить занятие
          </Link>
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Время</th>
                <th>Тема</th>
                <th>Формат</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.startAt.slice(0, 10))}</td>
                  <td>{l.startAt.slice(11, 16)} · {l.durationMinutes} мин</td>
                  <td>{l.title || "—"}</td>
                  <td>{l.format === "online" ? "Онлайн" : "Очно"}{l.location ? ` · ${l.location}` : ""}</td>
                  <td><span className={`tag ${LESSON_STATUS_LABEL[l.status].cls}`}>{LESSON_STATUS_LABEL[l.status].label}</span></td>
                </tr>
              ))}
              {lessons.length === 0 && <tr><td colSpan={5} className="card-meta">Занятий пока не было.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 14 }}>Добавить материал</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <input className="input" style={{ flex: 2, minWidth: 180 }} value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Название" />
              <select className="input" style={{ flex: 1, minWidth: 160 }} value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                {Object.entries(MATERIAL_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input" style={{ flex: 2, minWidth: 180 }} value={materialUrl} onChange={(e) => setMaterialUrl(e.target.value)} placeholder="Ссылка (необязательно)" />
              <button type="button" className="btn btn-primary btn-sm" disabled={!materialTitle.trim() || savingMaterial} onClick={addMaterial}>Добавить</button>
            </div>
          </div>

          {materials.length === 0 ? (
            <div className="card-meta">Материалов пока нет.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {materials.map((m) => (
                <div key={m.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span className="tag tag-neutral" style={{ marginRight: 8 }}>{MATERIAL_TYPE_LABEL[m.type] ?? m.type}</span>
                    {m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.title}</a> : <span>{m.title}</span>}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteMaterial(m.id)} title="Удалить">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "homework" && (
        <table className="table">
          <thead>
            <tr>
              <th>Работа</th>
              <th>Дедлайн</th>
              <th>Выполнено группой</th>
              <th>Сдали</th>
              <th>Проверено</th>
            </tr>
          </thead>
          <tbody>
            {g.homeworkStats.map((h) => (
              <tr key={h.id}>
                <td>{h.title}</td>
                <td>{fmtDate(h.dueAt)}</td>
                <td>{h.groupDone}/{h.groupTotal}</td>
                <td>{h.submittedCount}/{g.students.length}</td>
                <td>{h.reviewedCount}/{g.students.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "progress" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Слабые темы группы</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {g.weakTopics.length === 0 && <div className="card-meta">Пока нет данных.</div>}
              {g.weakTopics.map((t) => (
                <div key={t.topicId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span>{t.topicName}</span>
                  <span className="card-meta">{t.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Последние занятия</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {g.recentLessons.length === 0 && <div className="card-meta">Проведённых занятий пока нет.</div>}
              {g.recentLessons.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span>{l.title || "Занятие"}</span>
                  <span className="card-meta">{fmtDate(l.startAt.slice(0, 10))} · {l.status === "cancelled" ? "отменено" : "проведено"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {freezeStudentId && (
        <Modal
          title={`Заморозить — ${g.students.find((s) => s.id === freezeStudentId)?.name ?? ""}`}
          onClose={() => setFreezeStudentId(null)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setFreezeStudentId(null)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!freezeStart || !freezeEnd || savingFreeze} onClick={addFreeze}>Заморозить</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="card-meta" style={{ margin: 0 }}>
              На этот период занятия группы не будут засчитываться ученику как пропущенные — он останется в группе, но не будет считаться обязанным присутствовать.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>С</label>
                <input className="input" type="date" value={freezeStart} onChange={(e) => setFreezeStart(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>По</label>
                <input className="input" type="date" value={freezeEnd} onChange={(e) => setFreezeEnd(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Причина (необязательно)</label>
              <input className="input" value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="Например, болезнь" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
