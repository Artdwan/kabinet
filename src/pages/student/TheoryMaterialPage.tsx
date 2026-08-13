import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CheckCircle2, Star, XCircle } from "lucide-react";
import { homeworkById, SUBJECTS, THEORY_MATERIALS } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { ContentBlocks, headingAnchors } from "../../components/ContentBlockRenderer";
import { MathText } from "../../components/Formula";

export function TheoryMaterialPage() {
  const { materialId } = useParams();
  const { store } = useStore();
  const actions = useActions();

  const material = THEORY_MATERIALS.find((m) => m.id === materialId);
  if (!material) return <Navigate to="/theory" replace />;

  const subject = SUBJECTS.find((s) => s.id === material.subjectId);
  const st = store.theory[material.id];
  const favorite = st?.favorite ?? false;
  const read = st?.read ?? false;
  const anchors = headingAnchors(material.blocks);
  const relatedHomeworks = material.relatedHomeworkIds.map((id) => homeworkById(id)).filter(Boolean);

  return (
    <div data-readergrid>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-meta">Теория / {subject?.name}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: "6px 0" }}>{material.title}</h1>
            <button type="button" className="btn btn-icon btn-secondary" onClick={() => actions.toggleFavoriteTheory(material.id)} aria-label="В избранное">
              <Star size={16} style={{ color: favorite ? "var(--color-accent)" : undefined }} fill={favorite ? "var(--color-accent)" : "none"} />
            </button>
          </div>
          <p style={{ color: "var(--color-text-2)" }}>{material.summary}</p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => actions.toggleStudiedTheory(material.id)}>
            {read ? "Материал изучен" : "Отметить как изученный"}
          </button>
        </div>

        <ContentBlocks blocks={material.blocks} />

        <div className="card">
          <div className="card-title">Проверь себя</div>
          <p className="card-meta">Короткие вопросы по материалу — ответы не идут в статистику.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
            {material.quiz.map((q) => (
              <QuizItem key={q.id} materialId={material.id} q={q} answered={st?.quiz[q.id]} onAnswer={(state) => actions.answerTheoryQuiz(material.id, q.id, state)} />
            ))}
          </div>
        </div>
      </div>

      <div data-sticky style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {anchors.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Оглавление</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {anchors.map((a) => (
                <a key={a.id} href={`#${a.id}`} style={{ fontSize: 12.5, color: "var(--color-text-2)", textDecoration: "none" }}>
                  {a.text}
                </a>
              ))}
            </div>
          </div>
        )}
        {relatedHomeworks.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Связанные работы</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {relatedHomeworks.map((h) => (
                <Link key={h!.id} to={`/homework/${h!.id}`} style={{ fontSize: 12.5, color: "var(--color-accent)", textDecoration: "none" }}>
                  {h!.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizItem({
  q,
  answered,
  onAnswer,
}: {
  materialId: string;
  q: (typeof THEORY_MATERIALS)[number]["quiz"][number];
  answered?: { value: string; status: "correct" | "wrong" };
  onAnswer: (state: { value: string; status: "correct" | "wrong" }) => void;
}) {
  const [text, setText] = useState("");

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(",", ".");
  const submit = (value: string) => {
    const status = norm(value) === norm(q.answer) ? "correct" : "wrong";
    onAnswer({ value, status });
  };

  return (
    <div>
      <div style={{ fontSize: 13.5, marginBottom: 8 }}>
        <MathText text={q.prompt} />
      </div>
      {q.type === "single" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.options?.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: "flex-start" }}
              onClick={() => submit(opt.id)}
            >
              <MathText text={opt.label} />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" style={{ maxWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => submit(text)}>
            Проверить
          </button>
        </div>
      )}
      {answered && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            fontSize: 12.5,
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
            background: answered.status === "correct" ? "var(--color-ok-100)" : "var(--color-bad-100)",
            color: answered.status === "correct" ? "var(--color-ok)" : "var(--color-bad)",
          }}
        >
          {answered.status === "correct" ? <CheckCircle2 size={14} style={{ flex: "none" }} /> : <XCircle size={14} style={{ flex: "none" }} />}
          <span>
            {answered.status === "correct" ? "Верно." : "Неверно."} {q.explain}
          </span>
        </div>
      )}
    </div>
  );
}
