import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Flag, Lightbulb, Lock, XCircle } from "lucide-react";
import type { Attempt, Exercise } from "../../types";
import { solutionAvailability } from "../../services/mockApi";
import { MathText } from "../Formula";
import { DraftWorkspace } from "./DraftWorkspace";

interface Props {
  exercise: Exercise;
  attempt: Attempt;
  submitted: boolean;
  flaggedNote?: string;
  onAnswer: (value: string | string[]) => void;
  onCheck: () => void;
  onHint: () => void;
  onSolution: () => void;
  onDraft: (text: string) => void;
  onDrawing: (dataUrl: string | null) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}

const STATUS_META: Record<Attempt["status"], { label: string; cls: string } | null> = {
  not_started: null,
  saved: { label: "Сохранено", cls: "tag-neutral" },
  correct: { label: "Верно", cls: "tag-ok" },
  wrong: { label: "Неверно", cls: "tag-bad" },
  manual: { label: "Отправлено на проверку", cls: "tag-accent" },
};

export function ExerciseCard({ exercise, attempt, submitted, flaggedNote, onAnswer, onCheck, onHint, onSolution, onDraft, onDrawing, onAddFiles, onRemoveFile }: Props) {
  const [multiSel, setMultiSel] = useState<string[]>(Array.isArray(attempt.value) ? attempt.value : []);
  const avail = solutionAvailability(exercise, attempt, submitted);
  const statusMeta = STATUS_META[attempt.status];
  const canCheck = exercise.type === "manual" ? attempt.draftText.trim().length > 0 || attempt.files.length > 0 || !!attempt.drawing : String(attempt.value || "").length > 0 || (Array.isArray(attempt.value) && attempt.value.length > 0);

  const toggleMulti = (id: string) => {
    const next = multiSel.includes(id) ? multiSel.filter((x) => x !== id) : [...multiSel, id];
    setMultiSel(next);
    onAnswer(next);
  };

  return (
    <div
      id={`ex-${exercise.id}`}
      className="card"
      style={{
        scrollMarginTop: 90,
        borderColor: flaggedNote ? "var(--color-bad)" : attempt.status === "correct" ? "var(--color-ok)" : "var(--color-line)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <span
            style={{
              flex: "none",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--color-surface-2)",
              display: "grid",
              placeItems: "center",
              fontSize: 12.5,
              color: "var(--color-text-2)",
            }}
          >
            {exercise.no}
          </span>
          <div style={{ fontSize: 14, paddingTop: 3 }}>
            <MathText text={exercise.prompt} />
          </div>
        </div>
        {statusMeta && <span className={`tag ${statusMeta.cls}`} style={{ flex: "none" }}>{statusMeta.label}</span>}
      </div>

      {flaggedNote && (
        <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bad-100)", color: "var(--color-bad)", fontSize: 12.5 }}>
          <Flag size={14} style={{ flex: "none", marginTop: 2 }} />
          <span>{flaggedNote}</span>
        </div>
      )}

      {exercise.type !== "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exercise.type === "single" &&
            exercise.options?.map((opt) => (
              <label key={opt.id} className="radio" style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: "9px 12px", justifyContent: "flex-start" }}>
                <input type="radio" name={exercise.id} checked={attempt.value === opt.id} onChange={() => onAnswer(opt.id)} />
                <span className="dot" />
                <span style={{ fontSize: 13.5 }}>
                  <MathText text={opt.label} />
                </span>
              </label>
            ))}
          {exercise.type === "multi" &&
            exercise.options?.map((opt) => (
              <label key={opt.id} className="checkbox" style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
                <input type="checkbox" checked={multiSel.includes(opt.id)} onChange={() => toggleMulti(opt.id)} />
                <span className="box">✓</span>
                <span style={{ fontSize: 13.5 }}>
                  <MathText text={opt.label} />
                </span>
              </label>
            ))}
          {(exercise.type === "number" || exercise.type === "text") && (
            <input
              className="input"
              style={{ maxWidth: 260 }}
              value={typeof attempt.value === "string" ? attempt.value : ""}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="Ваш ответ"
              inputMode={exercise.type === "number" ? "decimal" : "text"}
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canCheck} onClick={onCheck}>
          {exercise.type === "manual" ? "Отправить на проверку" : "Проверить"}
        </button>
        {attempt.attempts > 0 && <span className="card-meta">Попытка {attempt.attempts}</span>}
      </div>

      {exercise.type === "manual" && (
        <p className="card-meta">Задание проверяется преподавателем вручную — приложите решение ниже.</p>
      )}

      <DraftWorkspace
        draftText={attempt.draftText}
        drawing={attempt.drawing}
        files={attempt.files}
        onDraftChange={onDraft}
        onDrawingChange={onDrawing}
        onAddFiles={onAddFiles}
        onRemoveFile={onRemoveFile}
      />

      <HintsAndSolution exercise={exercise} attempt={attempt} avail={avail} onHint={onHint} onSolution={onSolution} />
    </div>
  );
}

function HintsAndSolution({
  exercise,
  attempt,
  avail,
  onHint,
  onSolution,
}: {
  exercise: Exercise;
  attempt: Attempt;
  avail: { available: boolean; note: string };
  onHint: () => void;
  onSolution: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasHints = exercise.hints.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm"
        style={{ paddingLeft: 0 }}
      >
        <Lightbulb size={14} /> Подсказки и решение {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {hasHints && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {exercise.hints.slice(0, attempt.hintsOpened).map((h, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--color-text-2)", padding: "8px 10px", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)" }}>
                  <MathText text={h} />
                </div>
              ))}
              {attempt.hintsOpened < exercise.hints.length && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onHint} style={{ alignSelf: "flex-start" }}>
                  Показать подсказку {attempt.hintsOpened + 1} из {exercise.hints.length}
                </button>
              )}
            </div>
          )}

          <div>
            {!avail.available ? (
              <div className="card-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={13} /> {avail.note}
              </div>
            ) : attempt.solutionOpened ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                <div className="card-meta">{avail.note}</div>
                <ol style={{ margin: 0, paddingLeft: 18, color: "var(--color-text-2)" }}>
                  {exercise.solution.steps.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <MathText text={s} />
                    </li>
                  ))}
                </ol>
                <div style={{ color: "var(--color-ok)", fontStyle: "italic" }}>
                  <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Ответ: <MathText text={exercise.solution.answerText} />
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSolution}>
                Показать решение
              </button>
            )}
          </div>

          {attempt.status === "wrong" && (
            <div className="card-meta" style={{ color: "var(--color-bad)", display: "flex", alignItems: "center", gap: 6 }}>
              <XCircle size={13} /> Ответ пока неверный — используйте подсказки или попробуйте ещё раз.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
