import { Link } from "react-router-dom";
import { GROUPS, REVIEW_QUEUE, STUDENTS } from "../../data/roles";
import { useStore } from "../../services/StoreContext";
import { fmtDate } from "../../services/mockApi";
import { MetricCard } from "../../components/MetricCard";

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Риск", cls: "tag-bad" },
};

export function TeacherHomePage() {
  const { store } = useStore();
  const avg = Math.round(STUDENTS.reduce((s, st) => s + st.avg, 0) / STUDENTS.length);
  const needAttention = STUDENTS.filter((s) => s.risk !== "ok");
  const pendingReview = REVIEW_QUEUE.filter((q) => !store.teacher.reviewed[q.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div data-cols3>
        <MetricCard label="Средний балл групп" value={avg} />
        <MetricCard label="Учеников" value={STUDENTS.length} />
        <MetricCard label="В очереди на проверку" value={pendingReview.length} tone={pendingReview.length ? "bad" : "ok"} />
      </div>

      <div data-cols2>
        <div className="card">
          <div className="card-title">Требуют внимания</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {needAttention.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                <div>
                  <div>{s.name}</div>
                  <div className="card-meta">Слабая тема: {s.weak}</div>
                </div>
                <span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-title">Очередь проверки</div>
            <Link to="/teacher/review" className="btn btn-ghost btn-sm">Все</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {pendingReview.length === 0 && <div className="card-meta">Все работы проверены.</div>}
            {pendingReview.slice(0, 4).map((q) => (
              <Link key={q.id} to="/teacher/review" style={{ textDecoration: "none", color: "inherit", fontSize: 13.5 }}>
                <div>{q.title}</div>
                <div className="card-meta">{STUDENTS.find((s) => s.id === q.studentId)?.name} · сдано {fmtDate(q.submittedAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Группы</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {GROUPS.map((g) => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span>{g.name}</span>
              <span className="card-meta">{g.studentIds.length} учеников</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
