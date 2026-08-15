import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { fmtDate } from "../../services/mockApi";
import { StatusBadge } from "../../components/StatusBadge";
import { MetricCard } from "../../components/MetricCard";
import type { HomeworkStatus } from "../../types";

interface HomeworkRow {
  id: string;
  title: string;
  dueAt: string;
  done: number;
  total: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  status: HomeworkStatus;
}

interface ResultRow {
  id: string;
  testId: string;
  title: string;
  subjectId: string;
  date: string;
  score: number;
  minutes: number;
}

interface TopicAccuracyRow {
  topicId: string;
  topicName: string;
  accuracy: number;
}

interface StudentProfile {
  id: string;
  name: string;
  lastName: string;
  email: string;
  grade: number;
  goalScore: number;
  note: string | null;
  groups: { id: string; name: string }[];
  avg: number;
  lastActive: string | null;
  homeworks: HomeworkRow[];
  results: ResultRow[];
  topicAccuracy: TopicAccuracyRow[];
}

type Tab = "overview" | "homework" | "progress";

export function TeacherStudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: profile, reload } = useApiData<StudentProfile>(`/teacher/students/${id}`);
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [note, setNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  if (!profile) return <div className="card-meta">Загрузка…</div>;

  const noteValue = note ?? profile.note ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/teacher/students")} style={{ marginBottom: 8 }}>
          <ArrowLeft size={14} /> К списку учеников
        </button>
        <h1 style={{ margin: 0, fontSize: 24 }}>{profile.name} {profile.lastName}</h1>
        <p className="card-meta">{profile.email} · {profile.grade} класс · {profile.groups.map((g) => g.name).join(", ") || "без группы"}</p>
      </div>

      <div data-cols3>
        <MetricCard label="Текущий балл" value={profile.avg || 0} />
        <MetricCard label="Целевой балл" value={profile.goalScore} />
        <MetricCard label="До цели" value={Math.max(0, profile.goalScore - profile.avg)} />
      </div>

      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button type="button" className="seg-opt" style={tab === "overview" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("overview")}>Обзор</button>
        <button type="button" className="seg-opt" style={tab === "homework" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("homework")}>Домашние задания</button>
        <button type="button" className="seg-opt" style={tab === "progress" ? { color: "var(--color-accent)", background: "var(--color-accent-100)" } : undefined} onClick={() => setTab("progress")}>Прогресс</button>
      </div>

      {tab === "overview" && (
        <div data-cols2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-title" style={{ fontSize: 15 }}>Слабые темы</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {profile.topicAccuracy.length === 0 && <div className="card-meta">Пока нет данных по тестам.</div>}
                {profile.topicAccuracy.slice(0, 5).map((t) => (
                  <div key={t.topicId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span>{t.topicName}</span>
                    <span className="card-meta">{t.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ fontSize: 15 }}>Активность</div>
              <p className="card-meta" style={{ margin: 0 }}>
                Последняя активность: {profile.lastActive ? fmtDate(profile.lastActive.slice(0, 10)) : "нет данных"}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Заметка преподавателя</div>
            <textarea
              className="input"
              rows={5}
              value={noteValue}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например, комментарии после занятий, важная информация от родителей..."
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: "flex-start", marginTop: 8 }}
              disabled={savingNote}
              onClick={async () => {
                setSavingNote(true);
                try {
                  await api.patch(`/teacher/students/${profile.id}`, { note: noteValue });
                  show("Заметка сохранена", "ok");
                  reload();
                } catch (e) {
                  show(e instanceof ApiError ? e.message : "Не удалось сохранить заметку", "bad");
                } finally {
                  setSavingNote(false);
                }
              }}
            >
              Сохранить заметку
            </button>
          </div>
        </div>
      )}

      {tab === "homework" && (
        <table className="table">
          <thead>
            <tr>
              <th>Работа</th>
              <th>Дедлайн</th>
              <th>Прогресс</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {profile.homeworks.map((h) => (
              <tr key={h.id}>
                <td><Link to={`/homework/${h.id}`}>{h.title}</Link></td>
                <td>{fmtDate(h.dueAt)}</td>
                <td>{h.done}/{h.total}</td>
                <td><StatusBadge status={h.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "progress" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тест</th>
                <th>Время</th>
                <th>Балл</th>
              </tr>
            </thead>
            <tbody>
              {[...profile.results].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.title}</td>
                  <td>{r.minutes} мин</td>
                  <td>{r.score}</td>
                </tr>
              ))}
              {profile.results.length === 0 && (
                <tr><td colSpan={4} className="card-meta">Тестов пока не было.</td></tr>
              )}
            </tbody>
          </table>

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Точность по темам</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {profile.topicAccuracy.length === 0 && <div className="card-meta">Пока нет данных.</div>}
              {profile.topicAccuracy.map((t) => (
                <div key={t.topicId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span>{t.topicName}</span>
                  <span className="card-meta">{t.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
