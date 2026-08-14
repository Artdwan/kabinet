import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Flag, X } from "lucide-react";
import { ctTestById } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { fmtClock } from "../../services/mockApi";
import { MathText } from "../../components/Formula";
import { Modal } from "../../components/Modal";

export function TestRunnerPage() {
  const { testId } = useParams();
  const { store } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [localElapsed, setLocalElapsed] = useState(0);
  const lastSynced = useRef(0);

  const test = testId ? ctTestById(testId) : undefined;
  const session = testId ? store.tests[testId] : undefined;

  useEffect(() => {
    if (testId && !store.tests[testId]) {
      actions.startTest(testId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    if (session) setLocalElapsed(session.elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    if (!testId || session?.finishedAt) return;
    const int = setInterval(() => {
      setLocalElapsed((prev) => {
        const next = prev + 1;
        if (next - lastSynced.current >= 5) {
          lastSynced.current = next;
          actions.tickElapsed(testId, next);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, session?.finishedAt]);

  if (!test || !testId) return <Navigate to="/tests" replace />;
  if (!session) return null;

  const questions = session.only ? test.questions.filter((q) => session.only!.includes(q.id)) : test.questions;
  const q = questions[session.current];
  const answeredCount = questions.filter((qq) => {
    const v = session.answers[qq.id];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
  }).length;

  const goTo = (i: number) => {
    actions.setCurrent(testId, i);
    setVisited((v) => new Set(v).add(i));
  };

  const finish = async () => {
    actions.tickElapsed(testId, localElapsed);
    const { counted } = await actions.finishTest(testId);
    setConfirmOpen(false);
    navigate(`/tests/${testId}/result`, { replace: true, state: { counted } });
  };

  const setAnswer = (value: string | string[]) => actions.answerQuestion(testId, q.id, value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 19 }}>{test.title}</div>
          <div className="card-meta">Вопрос {session.current + 1} из {questions.length}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag tag-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtClock(localElapsed)}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/tests")}>
            <X size={14} /> Выйти
          </button>
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }}>
        <div style={{ width: `${((session.current + 1) / questions.length) * 100}%`, height: "100%", background: "var(--color-accent)" }} />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 16, marginBottom: 14 }}>
            <MathText text={q.text} />
          </div>
          <button
            type="button"
            className="btn btn-icon btn-secondary"
            onClick={() => actions.toggleFlag(testId, q.id)}
            aria-label="Пометить для возврата"
            style={{ color: session.flagged[q.id] ? "var(--color-accent)" : undefined }}
          >
            <Flag size={15} />
          </button>
        </div>

        {q.type === "single" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options?.map((opt) => (
              <label key={opt.id} className="radio" style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px", justifyContent: "flex-start" }}>
                <input type="radio" name={q.id} checked={session.answers[q.id] === opt.id} onChange={() => setAnswer(opt.id)} />
                <span className="dot" />
                <MathText text={opt.label} />
              </label>
            ))}
          </div>
        )}
        {q.type === "multi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options?.map((opt) => {
              const current = (session.answers[q.id] as string[]) || [];
              const checked = current.includes(opt.id);
              return (
                <label key={opt.id} className="checkbox" style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setAnswer(checked ? current.filter((c) => c !== opt.id) : [...current, opt.id])}
                  />
                  <span className="box">✓</span>
                  <MathText text={opt.label} />
                </label>
              );
            })}
          </div>
        )}
        {q.type === "short" && (
          <input
            className="input"
            style={{ maxWidth: 260 }}
            value={(session.answers[q.id] as string) || ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Ваш ответ"
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="btn btn-secondary" disabled={session.current === 0} onClick={() => goTo(session.current - 1)}>
          Назад
        </button>
        {session.current < questions.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => goTo(session.current + 1)}>
            Далее
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)}>
            Завершить тест
          </button>
        )}
      </div>

      <div>
        <div className="card-meta" style={{ marginBottom: 8 }}>Навигатор по вопросам · отвечено {answeredCount} из {questions.length}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {questions.map((qq, i) => {
            const answered = session.answers[qq.id] !== undefined && session.answers[qq.id] !== "" && !(Array.isArray(session.answers[qq.id]) && !(session.answers[qq.id] as string[]).length);
            const marked = session.flagged[qq.id];
            const skipped = visited.has(i) && !answered;
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => goTo(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12.5,
                  border: `1.5px solid ${marked ? "var(--color-accent)" : answered ? "var(--color-ok)" : skipped ? "var(--color-text-3)" : "var(--color-line)"}`,
                  background: i === session.current ? "var(--color-surface-2)" : answered ? "var(--color-ok-100)" : "transparent",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {confirmOpen && (
        <Modal
          title="Завершить тест?"
          onClose={() => setConfirmOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>
                Вернуться к тесту
              </button>
              <button type="button" className="btn btn-primary" onClick={finish}>
                Завершить
              </button>
            </>
          }
        >
          Отвечено {answeredCount} из {questions.length} вопросов. После завершения изменить ответы будет нельзя.
        </Modal>
      )}
    </div>
  );
}
