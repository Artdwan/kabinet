import { Link } from "react-router-dom";
import { TRAINERS } from "../../data/roles";
import { useStore } from "../../services/StoreContext";

export function TrainersPage() {
  const { store } = useStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ color: "var(--color-text-2)", maxWidth: 640 }}>
        Короткие тренажёры для отработки техник запоминания. Задания генерируются, поэтому серия не повторяется.
      </p>
      <div data-cols3>
        {TRAINERS.map((t) => {
          const progress = store.games[t.id] || { best: 0, played: 0, lastScore: 0 };
          return (
            <Link key={t.id} to={`/trainers/${t.id}`} className="card elev-sm" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card-kicker">{t.subtitle}</div>
              <div className="card-title">{t.title}</div>
              <p className="card-body">{t.description}</p>
              <div className="card-meta">Рекорд: {progress.best} · Попыток: {progress.played}</div>
              <span className="btn btn-primary btn-sm btn-block">{progress.played > 0 ? "Играть ещё раз" : "Начать"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
