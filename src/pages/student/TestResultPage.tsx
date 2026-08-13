import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, CheckCircle2, MinusCircle, RotateCcw, XCircle } from "lucide-react";
import { ctTestById, RECOMMENDATIONS, TOPIC_ACCURACY } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { fmtClock } from "../../services/mockApi";
import { checkCtAnswer, scoreSession } from "../../services/testScoring";
import { avgScore, topicName } from "../../services/selectors";
import { MetricCard } from "../../components/MetricCard";
import { MathText } from "../../components/Formula";

export function TestResultPage() {
  const { testId } = useParams();
  const { store } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const test = testId ? ctTestById(testId) : undefined;
  const session = testId ? store.tests[testId] : undefined;
  if (!test || !testId || !session) return <Navigate to="/tests" replace />;

  const result = scoreSession(test, session);
  const questions = session.only ? test.questions.filter((q) => session.only!.includes(q.id)) : test.questions;
  const avg = avgScore(store);
  const delta = result.score - avg;

  const topicMap = new Map<string, { correct: number; total: number }>();
  questions.forEach((q) => {
    const v = session.answers[q.id];
    const isCorrect = checkCtAnswer(q, v);
    const entry = topicMap.get(q.topicId) || { correct: 0, total: 0 };
    entry.total += 1;
    if (isCorrect) entry.correct += 1;
    topicMap.set(q.topicId, entry);
  });

  const wrongIds = questions.filter((q) => !checkCtAnswer(q, session.answers[q.id])).map((q) => q.id);
  const weakTopic = TOPIC_ACCURACY[0];
  const recommendation = RECOMMENDATIONS.find((r) => r.topicId === weakTopic.topicId) || RECOMMENDATIONS[0];

  const retryMistakes = () => {
    actions.startTest(testId, wrongIds);
    navigate(`/tests/${testId}/run`);
  };

  const retakeAll = () => {
    actions.startTest(testId, null);
    navigate(`/tests/${testId}/run`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 820, margin: "0 auto" }}>
      <div>
        <div className="card-meta">{test.title}</div>
        <h1 style={{ marginTop: 4 }}>Результат: {result.score} баллов</h1>
      </div>

      <div data-cols3>
        <MetricCard label="Правильно" value={result.correctCount} tone="ok" />
        <MetricCard label="Ошибки" value={result.wrongCount} tone={result.wrongCount ? "bad" : "neutral"} />
        <MetricCard label="Пропущено" value={result.skippedCount} />
      </div>
      <div data-cols3>
        <MetricCard label="Время" value={fmtClock(session.elapsed)} />
        <MetricCard label="Средний балл" value={avg} />
        <MetricCard label="Изменение среднего" value={`${delta >= 0 ? "+" : ""}${delta}`} tone={delta >= 0 ? "ok" : "bad"} />
      </div>

      <div className="card">
        <div className="card-title" style={{ fontSize: 15 }}>Точность по темам</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {Array.from(topicMap.entries()).map(([topicId, v]) => {
            const pct = Math.round((v.correct / v.total) * 100);
            return (
              <div key={topicId}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{topicName(topicId)}</span>
                  <span>{v.correct}/{v.total}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct < 60 ? "var(--color-bad)" : pct < 80 ? "var(--color-accent)" : "var(--color-ok)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-kicker">Рекомендация</div>
        <div className="card-title">{recommendation.title}</div>
        <p className="card-body">{recommendation.why}</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {wrongIds.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={retryMistakes}>
            <RotateCcw size={15} /> Повторить ошибки
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={retakeAll}>
          Пройти ещё раз
        </button>
        <Link to="/tests" className="btn btn-ghost">
          К каталогу тестов <ArrowRight size={14} />
        </Link>
      </div>

      <div>
        <h2 style={{ fontSize: 18 }}>Разбор вопросов</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map((q, i) => {
            const v = session.answers[q.id];
            const correct = checkCtAnswer(q, v);
            const open = openId === q.id;
            const userAnswerText = Array.isArray(v) ? v.map((id) => q.options?.find((o) => o.id === id)?.label || id).join(", ") : q.type === "single" ? q.options?.find((o) => o.id === v)?.label || "—" : (v as string) || "—";
            const correctAnswerText = Array.isArray(q.answer)
              ? q.answer.map((id) => q.options?.find((o) => o.id === id)?.label || id).join(", ")
              : q.type === "single"
                ? q.options?.find((o) => o.id === q.answer)?.label || String(q.answer)
                : String(q.answer);
            return (
              <div key={q.id} className="card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : q.id)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  <span style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
                    {correct ? (
                      <CheckCircle2 size={16} style={{ color: "var(--color-ok)", flex: "none", marginTop: 2 }} />
                    ) : v === undefined || v === "" ? (
                      <MinusCircle size={16} style={{ color: "var(--color-text-3)", flex: "none", marginTop: 2 }} />
                    ) : (
                      <XCircle size={16} style={{ color: "var(--color-bad)", flex: "none", marginTop: 2 }} />
                    )}
                    <span>
                      {i + 1}. <MathText text={q.text} />
                    </span>
                  </span>
                </button>
                {open && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-text-2)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>Ваш ответ: <MathText text={userAnswerText} /></div>
                    <div>Правильный ответ: <MathText text={correctAnswerText} /></div>
                    {q.hint && <div>Подсказка: {q.hint}</div>}
                    {q.solution && <div>Решение: <MathText text={q.solution} /></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
