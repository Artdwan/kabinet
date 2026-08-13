import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStore } from "../../services/StoreContext";
import { HOMEWORKS, RECOMMENDATIONS, STUDENT } from "../../data/content";
import { fmtDate, homeworkProgress } from "../../services/mockApi";
import {
  allResults,
  avgScore,
  bestResult,
  inProgressHomeworks,
  lastResult,
  latestFeedbackHomework,
  remainingExercises,
  unfinishedTestSession,
  weakTopics,
} from "../../services/selectors";
import { MetricCard } from "../../components/MetricCard";
import { ScoreTrendChart } from "../../components/ScoreTrendChart";
import { TopicAccuracyBars } from "../../components/TopicAccuracyBars";

export function HomePage() {
  const { store } = useStore();
  const avg = avgScore(store);
  const last = lastResult(store);
  const best = bestResult(store);
  const results = allResults(store);
  const remaining = remainingExercises(store);
  const inProgress = inProgressHomeworks(store);
  const unfinishedTest = unfinishedTestSession(store);
  const recommendation = RECOMMENDATIONS[0];
  const feedbackHw = latestFeedbackHomework();

  const lastPlaceId = store.lastPlace?.id;
  const focusHw = HOMEWORKS.find((h) => h.id === lastPlaceId) || HOMEWORKS.find((h) => h.status === "in_progress") || HOMEWORKS[0];
  const focusStarted = Boolean(store.homework[focusHw.id]?.startedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Добрый вечер, {STUDENT.name}</h1>
        <p style={{ color: "var(--color-text-2)", margin: 0 }}>
          До ЦТ ещё есть время, чтобы подтянуть слабые темы. Осталось выполнить {remaining} заданий в текущих
          работах.
        </p>
      </div>

      <div className="card elev-md" style={{ padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="card-kicker">Следующий шаг</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: "4px 0" }}>{focusHw.title}</div>
          <div className="card-meta">{focusHw.summary}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to={`/homework/${focusHw.id}`} className="btn btn-primary">
            {focusStarted ? "Продолжить с места остановки" : "Открыть работу"} <ArrowRight size={15} />
          </Link>
          {unfinishedTest ? (
            <Link to={`/tests/${unfinishedTest.testId}/run`} className="btn btn-secondary">
              Вернуться к тесту
            </Link>
          ) : (
            <Link to="/tests" className="btn btn-secondary">
              Начать тест
            </Link>
          )}
        </div>
      </div>

      <div data-cols3>
        <MetricCard label="Средний балл ЦТ" value={avg} />
        <MetricCard
          label="Последний результат"
          value={last?.score ?? "—"}
          tone={last ? (last.score >= avg ? "ok" : "bad") : "neutral"}
          detail={last ? fmtDate(last.date) : undefined}
        />
        <MetricCard label="Лучший результат" value={best?.score ?? "—"} tone="ok" detail={best ? fmtDate(best.date) : undefined} />
      </div>

      <div data-cols2>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title">Динамика результатов</div>
            <ScoreTrendChart results={results} goal={STUDENT.goalScore} />
          </div>

          <div className="card">
            <div className="card-title">На сегодня</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "var(--color-text-2)" }}>
              <li>Задания 5–9: дробные уравнения</li>
              <li>Тренировка по растворам, 15 минут · Слабая тема · точность 52 %</li>
              <li>Повторить теорию: ОДЗ и посторонние корни · Материал прочитан на 60 %</li>
            </ul>
          </div>

          <div className="card">
            <div className="card-title">Домашние работы в процессе</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
              {inProgress.length === 0 && <div className="card-meta">Сейчас нет работ в процессе.</div>}
              {inProgress.map((hw) => {
                const p = homeworkProgress(hw, store.homework[hw.id]);
                return (
                  <Link key={hw.id} to={`/homework/${hw.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                      <span>{hw.title}</span>
                      <span className="card-meta">
                        {p.done} из {p.total}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }}>
                      <div style={{ width: `${p.percent}%`, height: "100%", background: "var(--color-accent)" }} />
                    </div>
                    <div className="card-meta" style={{ marginTop: 4 }}>Дедлайн {fmtDate(hw.dueAt)}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title">Слабые темы</div>
            <div style={{ marginTop: 8 }}>
              <TopicAccuracyBars items={weakTopics(3)} />
            </div>
          </div>

          <div className="card">
            <div className="card-kicker">Рекомендация</div>
            <div className="card-title">{recommendation.title}</div>
            <p className="card-body">{recommendation.why}</p>
            <Link
              to={recommendation.action === "theory" ? `/theory/${recommendation.targetId}` : recommendation.action === "test" ? `/tests/${recommendation.targetId}/run` : `/homework/${recommendation.targetId}`}
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start" }}
            >
              Перейти <ArrowRight size={13} />
            </Link>
          </div>

          {feedbackHw?.feedback && (
            <div className="card">
              <div className="card-kicker">Обратная связь</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="card-title">{feedbackHw.feedback.teacher}</div>
                <span className="tag tag-accent">{feedbackHw.feedback.grade}</span>
              </div>
              <p className="card-body">{feedbackHw.feedback.text}</p>
              <Link to={`/homework/${feedbackHw.id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
                Открыть работу <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
