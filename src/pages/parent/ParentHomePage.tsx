import { CHILD_LINK, PARENT_ADVICE, PARENT_WEEK } from "../../data/roles";
import { HOMEWORKS, STUDENT } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { fmtDate, homeworkProgress, TODAY_ISO } from "../../services/mockApi";
import { avgScore } from "../../services/selectors";
import { MetricCard } from "../../components/MetricCard";

export function ParentHomePage() {
  const { store } = useStore();
  const avg = avgScore(store);
  const upcoming = HOMEWORKS.filter((h) => h.dueAt >= TODAY_ISO && !store.homework[h.id]?.submittedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const feedbackHw = HOMEWORKS.find((h) => h.feedback);
  const maxMinutes = Math.max(...PARENT_WEEK.map((d) => d.minutes), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Прогресс: {CHILD_LINK.name}</h1>
        <p style={{ color: "var(--color-text-2)", margin: 0 }}>{CHILD_LINK.grade} класс · цель ЦТ {STUDENT.goalScore} баллов</p>
      </div>

      <div data-cols3>
        <MetricCard label="Средний балл ЦТ" value={avg} />
        <MetricCard label="Цель" value={STUDENT.goalScore} />
        <MetricCard label="До цели" value={Math.max(0, STUDENT.goalScore - avg)} />
      </div>

      <div data-cols2>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title">Активность за неделю</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 10 }}>
              {PARENT_WEEK.map((d) => (
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
              {upcoming.slice(0, 4).map((h) => {
                const p = homeworkProgress(h, store.homework[h.id]);
                return (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span>{h.title}</span>
                    <span className="card-meta">{fmtDate(h.dueAt)} · {p.done}/{p.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {feedbackHw?.feedback && (
            <div className="card">
              <div className="card-kicker">Комментарий преподавателя</div>
              <div className="card-title" style={{ fontSize: 15 }}>{feedbackHw.feedback.teacher}</div>
              <p className="card-body">{feedbackHw.feedback.text}</p>
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
