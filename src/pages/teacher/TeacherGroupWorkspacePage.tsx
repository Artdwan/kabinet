import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { MetricCard } from "../../components/MetricCard";
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

type Tab = "overview" | "students" | "homework" | "progress";

export function TeacherGroupWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: g } = useApiData<GroupWorkspace>(`/teacher/groups/${id}`);
  const [tab, setTab] = useState<Tab>("overview");

  if (!g) return <div className="card-meta">Загрузка…</div>;

  const subjectName = SUBJECTS.find((s) => s.id === g.subjectId)?.name ?? g.subjectId;
  const needAttention = g.students.filter((s) => s.risk !== "ok");

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

      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button type="button" className="seg-opt" style={tab === "overview" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("overview")}>Обзор</button>
        <button type="button" className="seg-opt" style={tab === "students" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("students")}>Ученики</button>
        <button type="button" className="seg-opt" style={tab === "homework" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("homework")}>Домашние задания</button>
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
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Посещаемость</th>
              <th>ДЗ</th>
              <th>Средний балл</th>
              <th>Последняя активность</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {g.students.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/teacher/students/${s.id}`)} style={{ cursor: "pointer" }}>
                <td>{s.name}</td>
                <td>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</td>
                <td>{s.done}/{s.total}{s.overdue > 0 ? ` (${s.overdue} просрочено)` : ""}</td>
                <td>{s.avg || "—"}</td>
                <td>{s.lastActive ? fmtDate(s.lastActive.slice(0, 10)) : "—"}</td>
                <td><span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span></td>
              </tr>
            ))}
            {g.students.length === 0 && <tr><td colSpan={6} className="card-meta">В группе пока нет учеников.</td></tr>}
          </tbody>
        </table>
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
    </div>
  );
}
