import { useState } from "react";
import { Link } from "react-router-dom";
import { CT_TESTS, SUBJECTS, TOPIC_ACCURACY } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { Chip, ChipRow } from "../../components/Chip";
import { allResults, unfinishedTestSession } from "../../services/selectors";

const FORMATS: { id: "all" | "thematic" | "full"; label: string }[] = [
  { id: "all", label: "Все форматы" },
  { id: "thematic", label: "Тематические" },
  { id: "full", label: "Полный вариант" },
];

export function TestsCatalogPage() {
  const { store } = useStore();
  const [subject, setSubject] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "thematic" | "full">("all");
  const weakTopicId = TOPIC_ACCURACY[0]?.topicId;
  const unfinished = unfinishedTestSession(store);
  const results = allResults(store);

  const filtered = CT_TESTS.filter((t) => {
    if (subject && t.subjectId !== subject) return false;
    if (format !== "all" && t.format !== format) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {unfinished && (
        <div className="card" style={{ borderColor: "var(--color-accent)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="card-title" style={{ fontSize: 15 }}>Незавершённый тест</div>
            <div className="card-meta">{CT_TESTS.find((t) => t.id === unfinished.testId)?.title}</div>
          </div>
          <Link to={`/tests/${unfinished.testId}/run`} className="btn btn-primary btn-sm">
            Продолжить
          </Link>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <ChipRow>
          <Chip active={subject === null} onClick={() => setSubject(null)}>Все предметы</Chip>
          {SUBJECTS.map((s) => (
            <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.name}</Chip>
          ))}
        </ChipRow>
        <ChipRow>
          {FORMATS.map((f) => (
            <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</Chip>
          ))}
        </ChipRow>
      </div>

      {filtered.length === 0 ? (
        <div style={{ border: "1px dashed var(--color-line)", borderRadius: "var(--radius-md)", padding: 40, textAlign: "center", color: "var(--color-text-3)" }}>
          Под эти фильтры тестов нет.
        </div>
      ) : (
        <div data-cols3>
          {filtered.map((t) => {
            const subj = SUBJECTS.find((s) => s.id === t.subjectId);
            const lastResultForTest = [...results].reverse().find((r) => r.testId === t.id);
            const session = store.tests[t.id];
            const inProgress = session && !session.finishedAt && Object.keys(session.answers || {}).length > 0;
            const cta = inProgress ? "Продолжить" : lastResultForTest ? "Пройти ещё раз" : "Начать тест";
            return (
              <div key={t.id} className="card elev-sm">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="card-kicker">{subj?.name}</span>
                  <span className="tag tag-neutral">{t.format === "full" ? "Полный вариант" : "Тематический"}</span>
                </div>
                {t.topicId === weakTopicId && <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>Рекомендуем по слабой теме</span>}
                <div className="card-title">{t.title}</div>
                <p className="card-body">{t.description}</p>
                <div className="card-meta">
                  {t.questions.length} заданий · {t.minutes} мин · Сложность: {t.difficulty}
                </div>
                <div className="card-meta">{lastResultForTest ? `Последний результат: ${lastResultForTest.score}` : "Ещё не проходили"}</div>
                <Link to={`/tests/${t.id}/run`} className="btn btn-primary btn-sm btn-block">
                  {cta}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
