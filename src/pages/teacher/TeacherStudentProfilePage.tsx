import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { fmtDate } from "../../services/mockApi";
import { StatusBadge } from "../../components/StatusBadge";
import { MetricCard } from "../../components/MetricCard";
import { Modal } from "../../components/Modal";
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

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!profile) return <div className="card-meta">Загрузка…</div>;

  const noteValue = note ?? profile.note ?? "";

  const openEdit = () => {
    setEditName(profile.name);
    setEditLastName(profile.lastName);
    setEditGrade(String(profile.grade));
    setEditGoal(String(profile.goalScore));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/teacher/students/${profile.id}`, {
        name: editName.trim(), lastName: editLastName.trim(),
        grade: editGrade || undefined, goalScore: editGoal || undefined,
      });
      show("Данные ученика обновлены", "ok");
      setEditOpen(false);
      reload();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить", "bad");
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async () => {
    if (!window.confirm(`Удалить ученика «${profile.name} ${profile.lastName}»? Это удалит весь его прогресс, результаты и заметки без возможности восстановления.`)) return;
    setDeleting(true);
    try {
      await api.del(`/teacher/students/${profile.id}`);
      show("Ученик удалён", "ok");
      navigate("/teacher/students");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить ученика", "bad");
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/teacher/students")} style={{ marginBottom: 8 }}>
            <ArrowLeft size={14} /> К списку учеников
          </button>
          <h1 style={{ margin: 0, fontSize: 24 }}>{profile.name} {profile.lastName}</h1>
          <p className="card-meta">{profile.email} · {profile.grade} класс · {profile.groups.map((g) => g.name).join(", ") || "без группы"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openEdit}>Редактировать</button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-bad)" }} disabled={deleting} onClick={deleteStudent}>Удалить</button>
        </div>
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

      {editOpen && (
        <Modal
          title="Редактировать ученика"
          onClose={() => setEditOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" disabled={!editName.trim() || saving} onClick={saveEdit}>Сохранить</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Имя</label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>Фамилия</label>
                <input className="input" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>Класс</label>
                <input className="input" type="number" min={1} max={11} value={editGrade} onChange={(e) => setEditGrade(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Целевой балл ЦТ</label>
                <input className="input" type="number" min={0} max={100} value={editGoal} onChange={(e) => setEditGoal(e.target.value)} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
