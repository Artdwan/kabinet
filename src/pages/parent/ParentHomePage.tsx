import { PARENT_ADVICE } from "../../data/roles";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { MetricCard } from "../../components/MetricCard";

interface Child {
  id: string;
  name: string;
  lastName: string;
  grade: number;
  goalScore: number;
}

interface HomeworkRow {
  id: string;
  title: string;
  dueAt: string;
  done: number;
  total: number;
  submittedAt: string | null;
  reviewedAt: string | null;
}

interface ProgressData {
  results: { score: number }[];
  homeworks: HomeworkRow[];
  latestFeedback: { teacher: string; text: string; grade: string; date: string } | null;
}

interface WeekDay {
  day: string;
  minutes: number;
  tasks: number;
}

export function ParentHomePage() {
  const { data: child } = useApiData<Child>("/parent/child");
  const { data: progress } = useApiData<ProgressData>("/parent/child/progress");
  const { data: week = [] } = useApiData<WeekDay[]>("/parent/child/week-activity");

  const results = progress?.results ?? [];
  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const goal = child?.goalScore ?? 85;
  const upcoming = (progress?.homeworks ?? []).filter((h) => !h.submittedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const maxMinutes = Math.max(...week.map((d) => d.minutes), 1);

  if (!child) return <div className="card-meta">Загрузка…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Прогресс: {child.name}</h1>
        <p style={{ color: "var(--color-text-2)", margin: 0 }}>{child.grade} класс · цель ЦТ {goal} баллов</p>
      </div>

      <div data-cols3>
        <MetricCard label="Средний балл ЦТ" value={avg} />
        <MetricCard label="Цель" value={goal} />
        <MetricCard label="До цели" value={Math.max(0, goal - avg)} />
      </div>

      <div data-cols2>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title">Активность за неделю</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 10 }}>
              {week.map((d) => (
                <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${(d.minutes / maxMinutes) * 90}px`,
                      background: d.minutes === 0 ? "var(--color-line)" : "var(--color-accent)",
                      borderRadius: 4,
                    }}
                    title={`${d.minutes} мин · ${d.tasks} заданий`}
                  />
                  <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Ближайшие дедлайны</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {upcoming.length === 0 && <div className="card-meta">Нет незавершённых работ.</div>}
              {upcoming.slice(0, 4).map((h) => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span>{h.title}</span>
                  <span className="card-meta">{fmtDate(h.dueAt)} · {h.done}/{h.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {progress?.latestFeedback && (
            <div className="card">
              <div className="card-kicker">Комментарий преподавателя</div>
              <div className="card-title" style={{ fontSize: 15 }}>{progress.latestFeedback.teacher}</div>
              <p className="card-body">{progress.latestFeedback.text}</p>
            </div>
          )}

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Как помочь дома</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {PARENT_ADVICE.map((tip, i) => (
                <p key={i} className="card-body" style={{ margin: 0 }}>{tip}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
