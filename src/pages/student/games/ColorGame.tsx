import { useMemo, useState } from "react";
import type { Trainer } from "../../../types";
import { MathText } from "../../../components/Formula";

interface Props {
  trainer: Trainer;
  onGameOver: (score: number) => void;
}

const COLORS: { id: "red" | "blue" | "green"; label: string; hex: string }[] = [
  { id: "red", label: "Красный · степени", hex: "var(--color-bad)" },
  { id: "blue", label: "Синий · логарифмы/тригонометрия", hex: "#6f9bd6" },
  { id: "green", label: "Зелёный · коэффициенты", hex: "var(--color-ok)" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ColorGame({ trainer, onGameOver }: Props) {
  const items = useMemo(() => shuffle(trainer.items || []), [trainer]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const item = items[index];
  if (!item) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div className="card-title">Раунды закончились</div>
      </div>
    );
  }

  const choose = (color: "red" | "blue" | "green") => {
    if (feedback) return;
    const correct = color === item.color;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (index + 1 >= items.length) {
        onGameOver(score + (correct ? 1 : 0));
      } else {
        setIndex((i) => i + 1);
        setFeedback(null);
      }
    }, 700);
  };

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div className="card-meta">Элемент {index + 1} из {items.length} · счёт {score}</div>
      <div style={{ fontSize: 32, fontFamily: "var(--font-heading)" }}>
        <MathText text={item.text} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="btn btn-secondary"
            disabled={!!feedback}
            onClick={() => choose(c.id)}
            style={{ borderColor: c.hex, color: c.hex }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {feedback && (
        <div style={{ color: feedback === "correct" ? "var(--color-ok)" : "var(--color-bad)", fontSize: 13.5 }}>
          {feedback === "correct" ? "Верно!" : "Неверно"}
        </div>
      )}
    </div>
  );
}
