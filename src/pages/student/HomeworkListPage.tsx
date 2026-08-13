import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Search } from "lucide-react";
import { useStore } from "../../services/StoreContext";
import { HOMEWORKS, SUBJECTS, TOPICS } from "../../data/content";
import type { HomeworkStatus } from "../../types";
import { fmtDate, homeworkProgress } from "../../services/mockApi";
import { liveStatus } from "../../services/selectors";
import { ctaForStatus, StatusBadge } from "../../components/StatusBadge";
import { ProgressRing } from "../../components/ProgressRing";
import { Chip, ChipRow } from "../../components/Chip";

const TABS: { id: HomeworkStatus | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "in_progress", label: "В работе" },
  { id: "submitted", label: "Сданы" },
  { id: "reviewed", label: "Проверены" },
  { id: "overdue", label: "Просрочены" },
];

export function HomeworkListPage() {
  const { store } = useStore();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [tab, setTab] = useState<HomeworkStatus | "all">("all");

  const withStatus = useMemo(
    () => HOMEWORKS.map((hw) => ({ hw, status: liveStatus(hw, store) })),
    [store],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: withStatus.length };
    TABS.forEach((t) => {
      if (t.id !== "all") c[t.id] = withStatus.filter((x) => x.status === t.id).length;
    });
    return c;
  }, [withStatus]);

  const filtered = withStatus.filter(({ hw, status }) => {
    if (tab !== "all" && status !== tab) return false;
    if (subject && hw.subjectId !== subject) return false;
    if (query.trim()) {
      const topicName = TOPICS.find((t) => t.id === hw.topicId)?.name || "";
      const hay = `${hw.title} ${hw.summary} ${topicName}`.toLowerCase();
      if (!hay.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--color-text-3)" }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Поиск по названию или теме"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ChipRow>
          <Chip active={subject === null} onClick={() => setSubject(null)}>
            Все предметы
          </Chip>
          {SUBJECTS.map((s) => (
            <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>
              {s.name}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", borderBottom: "1px solid var(--color-line)", paddingBottom: 2 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="btn btn-sm"
            style={{
              color: tab === t.id ? "var(--color-accent)" : "var(--color-text-2)",
              borderBottom: tab === t.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              borderRadius: 0,
              whiteSpace: "nowrap",
            }}
          >
            {t.label} · {counts[t.id]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ border: "1px dashed var(--color-line)", borderRadius: "var(--radius-md)", padding: 40, textAlign: "center", color: "var(--color-text-3)" }}>
          <div style={{ marginBottom: 10 }}>Ничего не найдено</div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setQuery("");
              setSubject(null);
              setTab("all");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div data-colsauto>
          {filtered.map(({ hw, status }) => {
            const subj = SUBJECTS.find((s) => s.id === hw.subjectId);
            const p = homeworkProgress(hw, store.homework[hw.id]);
            const overdue = status === "overdue";
            return (
              <Link key={hw.id} to={`/homework/${hw.id}`} className="card elev-sm" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="card-kicker">{subj?.name}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {hw.feedback && <MessageSquare size={14} style={{ color: "var(--color-accent)" }} />}
                    <StatusBadge status={status} />
                  </div>
                </div>
                <div className="card-title">{hw.title}</div>
                <p className="card-body">{hw.summary}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <div className="card-meta" style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                    <span>Назначено {fmtDate(hw.assignedAt)}</span>
                    <span style={{ color: overdue ? "var(--color-bad)" : undefined }}>Дедлайн {fmtDate(hw.dueAt)}</span>
                    <span>{p.done} из {p.total}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ProgressRing percent={p.percent} size={40} stroke={3.5} />
                  </div>
                </div>
                <span className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 6 }}>
                  {ctaForStatus(status)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
