import { Link } from "react-router-dom";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { MetricCard } from "../../components/MetricCard";

interface RosterRow {
  id: string;
  name: string;
  avg: number;
  goal: number;
  weak: string;
  risk: "ok" | "attention" | "risk";
}

interface QueueRow {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  submittedAt: string;
}

interface GroupRow {
  id: string;
  name: string;
  studentIds: string[];
}

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Риск", cls: "tag-bad" },
};

export function TeacherHomePage() {
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: queue = [] } = useApiData<QueueRow[]>("/teacher/review-queue");
  const { data: groups = [] } = useApiData<GroupRow[]>("/teacher/groups");

  const avg = roster.length ? Math.round(roster.reduce((s, r) => s + r.avg, 0) / roster.length) : 0;
  const needAttention = roster.filter((s) => s.risk !== "ok");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div data-cols3>
        <MetricCard label="Средний балл групп" value={avg} />
        <MetricCard label="Учеников" value={roster.length} />
        <MetricCard label="В очереди на проверку" value={queue.length} tone={queue.length ? "bad" : "ok"} />
      </div>

      <div data-cols2>
        <div className="card">
          <div className="card-title">Требуют внимания</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {needAttention.length === 0 && <div className="card-meta">Все ученики в норме.</div>}
            {needAttention.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                <div>
                  <div>{s.name}</div>
                  <div className="card-meta">Слабая тема: {s.weak || "—"}</div>
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
            {queue.length === 0 && <div className="card-meta">Все работы проверены.</div>}
            {queue.slice(0, 4).map((q) => (
              <Link key={q.id} to="/teacher/review" style={{ textDecoration: "none", color: "inherit", fontSize: 13.5 }}>
                <div>{q.title}</div>
                <div className="card-meta">{q.studentName} · сдано {fmtDate(q.submittedAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Группы</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {groups.length === 0 && <div className="card-meta">Групп пока нет.</div>}
          {groups.map((g) => (
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
