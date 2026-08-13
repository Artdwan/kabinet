import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { SUBJECTS, THEORY_MATERIALS } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { Chip, ChipRow } from "../../components/Chip";

export function TheoryListPage() {
  const { store } = useStore();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string | null>(null);

  const filtered = THEORY_MATERIALS.filter((m) => {
    if (subject && m.subjectId !== subject) return false;
    if (query.trim()) {
      const hay = `${m.title} ${m.summary} ${m.blocks.map((b) => ("text" in b ? b.text : "")).join(" ")}`.toLowerCase();
      if (!hay.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--color-text-3)" }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Поиск по теории" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <ChipRow>
          <Chip active={subject === null} onClick={() => setSubject(null)}>Все предметы</Chip>
          {SUBJECTS.map((s) => (
            <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.name}</Chip>
          ))}
        </ChipRow>
      </div>

      {filtered.length === 0 ? (
        <div style={{ border: "1px dashed var(--color-line)", borderRadius: "var(--radius-md)", padding: 40, textAlign: "center", color: "var(--color-text-3)" }}>
          По этому запросу материалов нет.
        </div>
      ) : (
        <div data-cols3>
          {filtered.map((m) => {
            const subj = SUBJECTS.find((s) => s.id === m.subjectId);
            const st = store.theory[m.id];
            const progress = st?.progress ?? 0;
            return (
              <Link key={m.id} to={`/theory/${m.id}`} className="card elev-sm" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="card-kicker">{subj?.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {m.isNew && <span className="tag tag-accent">Новое</span>}
                    {st?.read && <span className="tag tag-ok">Изучено</span>}
                    {st?.favorite && <Star size={14} style={{ color: "var(--color-accent)" }} fill="var(--color-accent)" />}
                  </div>
                </div>
                <div className="card-title">{m.title}</div>
                <p className="card-body">{m.summary}</p>
                <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden", marginTop: 4 }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "var(--color-accent)" }} />
                </div>
                <div className="card-meta">Прочитано {progress}% · {m.minutes} мин</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
