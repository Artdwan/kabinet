import { Link } from "react-router-dom";
import { Check, Gamepad2 } from "lucide-react";
import { REVIEW_CARDS, REVIEW_INTERVALS, TECHNIQUES, WAVES, WEEK_PLAN, ZONES } from "../../data/roles";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { topicName } from "../../services/selectors";

export function TechniquesPage() {
  const { store } = useStore();
  const actions = useActions();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Техники запоминания</h2>
        <div data-cols3>
          {TECHNIQUES.map((tq) => {
            const progress = store.techniques[tq.id] || { practiced: 0, done: [] };
            return (
              <div key={tq.id} className="card">
                <div className="card-kicker">{tq.subtitle} · {tq.minutes} мин</div>
                <div className="card-title">{tq.title}</div>
                <p className="card-body">{tq.summary}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tq.steps.map((step, i) => {
                    const done = progress.done.includes(i);
                    return (
                      <label key={i} className="checkbox" style={{ fontSize: 12.5 }}>
                        <input type="checkbox" checked={done} onChange={() => actions.toggleTechniqueStep(tq.id, i)} />
                        <span className="box"><Check size={11} /></span>
                        <span style={{ color: done ? "var(--color-text-2)" : "var(--color-text)", textDecoration: done ? "line-through" : undefined }}>{step}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span className="card-meta">Практик: {progress.practiced}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.recordTechniquePractice(tq.id)}>
                    Отметить практику
                  </button>
                </div>
                {tq.trainerId && (
                  <Link to={`/trainers/${tq.trainerId}`} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
                    <Gamepad2 size={14} /> Тренажёр
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Интервальное повторение</h2>
        <p className="card-meta" style={{ marginBottom: 12 }}>5-карточный бокс: карточка двигается по этапам, если вы её вспомнили, и возвращается на первый, если забыли.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
          {REVIEW_INTERVALS.map((interval) => {
            const cards = REVIEW_CARDS.filter((c) => (store.reviewCards[c.id]?.box ?? c.box) === interval.n);
            return (
              <div key={interval.n} className="card" style={{ minHeight: 140 }}>
                <div className="card-kicker">Этап {interval.n}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-2)" }}>{interval.label}</div>
                <div className="card-meta">{interval.hint}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {cards.map((c) => (
                    <div key={c.id} style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: 8 }}>
                      <div style={{ fontSize: 11.5 }}>{c.title}</div>
                      <div className="card-meta">{topicName(c.topicId)}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10.5, padding: "3px 6px" }} onClick={() => actions.advanceReviewCard(c.id, true, 5)}>
                          Помню
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10.5, padding: "3px 6px", color: "var(--color-bad)" }} onClick={() => actions.advanceReviewCard(c.id, false, 5)}>
                          Забыл
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Зоны повторения</h2>
        <div data-cols3>
          {ZONES.map((z) => (
            <div key={z.id} className="card" style={{ borderColor: z.color }}>
              <div className="card-title" style={{ fontSize: 15, color: z.color }}>{z.name}</div>
              <p className="card-body">{z.desc}</p>
              <div className="card-meta">{z.freq}</div>
            </div>
          ))}
        </div>
      </section>

      <section data-cols2>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Недельная архитектура</h2>
          <table className="table">
            <tbody>
              {WEEK_PLAN.map((d) => (
                <tr key={d.day}>
                  <td style={{ whiteSpace: "nowrap" }}>{d.day}</td>
                  <td className="card-meta">{d.block}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Три волны в день</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WAVES.map((w) => (
              <div key={w.n} className="card">
                <div className="card-kicker">{w.when}</div>
                <div className="card-body" style={{ fontSize: 13.5 }}>{w.what}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
