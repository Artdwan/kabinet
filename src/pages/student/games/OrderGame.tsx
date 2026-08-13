import { useMemo, useState } from "react";
import type { Trainer } from "../../../types";
import { MathText } from "../../../components/Formula";

interface Props {
  trainer: Trainer;
  onGameOver: (score: number) => void;
}

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function OrderGame({ trainer, onGameOver }: Props) {
  const rounds = trainer.rounds || [];
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);

  const round = rounds[roundIndex];
  const order = useMemo(() => shuffledIndices(round?.steps.length ?? 0), [round]);

  if (!round) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div className="card-title">Раунды закончились</div>
      </div>
    );
  }

  const pick = (stepIndex: number) => {
    if (result || chosen.includes(stepIndex)) return;
    const next = [...chosen, stepIndex];
    setChosen(next);
    if (next.length === round.steps.length) {
      const correct = next.every((v, i) => v === i);
      setResult(correct ? "correct" : "wrong");
      if (correct) setScore((s) => s + 1);
    }
  };

  const next = () => {
    if (roundIndex + 1 >= rounds.length) {
      onGameOver(score);
      return;
    }
    setRoundIndex((i) => i + 1);
    setChosen([]);
    setResult(null);
  };

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card-meta">Раунд {roundIndex + 1} из {rounds.length} · счёт {score}</div>
      <div style={{ fontSize: 15 }}>
        <MathText text={round.prompt} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {order.map((stepIndex) => {
          const pos = chosen.indexOf(stepIndex);
          return (
            <button
              key={stepIndex}
              type="button"
              onClick={() => pick(stepIndex)}
              disabled={!!result || pos >= 0}
              className="btn btn-secondary"
              style={{
                justifyContent: "flex-start",
                textAlign: "left",
                borderColor: pos >= 0 ? "var(--color-accent)" : undefined,
                opacity: pos >= 0 && !result ? 0.6 : 1,
              }}
            >
              {pos >= 0 && <span style={{ fontWeight: 700, marginRight: 8 }}>{pos + 1}.</span>}
              <MathText text={round.steps[stepIndex]} />
            </button>
          );
        })}
      </div>
      {result && (
        <div style={{ color: result === "correct" ? "var(--color-ok)" : "var(--color-bad)", fontSize: 13.5 }}>
          {result === "correct" ? "Верный порядок!" : "Порядок не совпал — сравните с исходным решением выше."}
        </div>
      )}
      {result && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={next}>
          {roundIndex + 1 >= rounds.length ? "Завершить" : "Следующий раунд"}
        </button>
      )}
    </div>
  );
}
