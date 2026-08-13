import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { HOMEWORKS, RECOMMENDATIONS, STUDENT, SUBJECTS, TOPIC_ACCURACY } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { allExercises, fmtDate, TODAY_ISO } from "../../services/mockApi";
import { allResults, strongTopics, topicName } from "../../services/selectors";
import { getHomeworkAttempt } from "../../services/actions";
import { MetricCard } from "../../components/MetricCard";
import { ScoreTrendChart } from "../../components/ScoreTrendChart";
import { TopicAccuracyBars } from "../../components/TopicAccuracyBars";
import { Chip, ChipRow } from "../../components/Chip";

const PERIODS = [
  { id: "month", label: "Месяц", days: 30 },
  { id: "3months", label: "3 месяца", days: 90 },
  { id: "year", label: "Год", days: 365 },
] as const;

export function StatsPage() {
  const { store } = useStore();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("3months");
  const [subject, setSubject] = useState<string | null>(null);

  const cutoffDays = PERIODS.find((p) => p.id === period)!.days;
  const cutoff = new Date(new Date(TODAY_ISO).getTime() - cutoffDays * 86400000).toISOString().slice(0, 10);

  const results = useMemo(
    () => allResults(store).filter((r) => r.date >= cutoff && (!subject || r.subjectId === subject)),
    [store, cutoff, subject],
  );

  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const last = results[results.length - 1];
  const best = results.length ? results.reduce((a, b) => (b.score > a.score ? b : a)) : undefined;

  let onTime = 0;
  let total = 0;
  let attempts = 0;
  let hints = 0;
  let exercisesDone = 0;
  HOMEWORKS.forEach((hw) => {
    const st = store.homework[hw.id];
    if (st?.submittedAt) {
      total += 1;
      if (st.submittedAt.slice(0, 10) <= hw.dueAt) onTime += 1;
    }
    allExercises(hw).forEach((ex) => {
      const a = getHomeworkAttempt(store, hw.id, ex.id);
      attempts += a.attempts;
      hints += a.hintsOpened;
      if (a.status === "correct" || a.status === "manual") exercisesDone += 1;
    });
  });
  const onTimePct = total ? Math.round((onTime / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <ChipRow>
          {PERIODS.map((p) => (
            <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</Chip>
          ))}
        </ChipRow>
        <ChipRow>
          <Chip active={subject === null} onClick={() => setSubject(null)}>Все предметы</Chip>
          {SUBJECTS.map((s) => (
            <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.name}</Chip>
          ))}
        </ChipRow>
      </div>

      <div data-cols3>
        <MetricCard label="Средний балл" value={avg || "—"} />
        <MetricCard label="Последний" value={last?.score ?? "—"} />
        <MetricCard label="Лучший" value={best?.score ?? "—"} tone="ok" />
      </div>
      <div data-cols3>
        <MetricCard label="Цель" value={STUDENT.goalScore} detail={avg ? `осталось ${Math.max(0, STUDENT.goalScore - avg)}` : undefined} />
        <MetricCard label="Сдано вовремя" value={`${onTimePct}%`} />
        <MetricCard label="Заданий решено" value={exercisesDone} />
      </div>

      <div data-cols2>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title">Динамика результатов</div>
            <ScoreTrendChart results={results} goal={STUDENT.goalScore} />
          </div>
          <div className="card">
            <div className="card-title">Точность по темам</div>
            <div style={{ marginTop: 8 }}>
              <TopicAccuracyBars items={TOPIC_ACCURACY} />
            </div>
          </div>
          <div className="card">
            <div className="card-title">Последние тесты</div>
            <table className="table" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тест</th>
                  <th>Время</th>
                  <th>Балл</th>
                </tr>
              </thead>
              <tbody>
                {[...results].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.title}</td>
                    <td>{r.minutes} мин</td>
                    <td>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Учебная дисциплина</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, fontSize: 12.5, color: "var(--color-text-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Сдано вовремя</span><span>{onTimePct}%</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Среднее время на задание</span><span>6 мин</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Всего попыток</span><span>{attempts}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Использовано подсказок</span><span>{hints}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Заданий решено</span><span>{exercisesDone}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Сильные темы</div>
            <ChipRow>
              {strongTopics(2).map((t) => (
                <span key={t.topicId} className="tag tag-ok">{topicName(t.topicId)} · {t.accuracy}%</span>
              ))}
            </ChipRow>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {RECOMMENDATIONS.map((r) => (
              <div key={r.id} className="card">
                <div className="card-kicker">Рекомендация</div>
                <div className="card-title" style={{ fontSize: 15 }}>{r.title}</div>
                <p className="card-body">{r.why}</p>
                <Link
                  to={r.action === "theory" ? `/theory/${r.targetId}` : r.action === "test" ? `/tests/${r.targetId}/run` : `/homework/${r.targetId}`}
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: "flex-start" }}
                >
                  Перейти <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
