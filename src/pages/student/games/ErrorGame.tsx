import { useState } from "react";
import type { Trainer } from "../../../types";
import { MathText } from "../../../components/Formula";

interface Props {
  trainer: Trainer;
  onGameOver: (score: number) => void;
}

export function ErrorGame({ trainer, onGameOver }: Props) {
  const rounds = trainer.rounds || [];
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const round = rounds[roundIndex];
  if (!round) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div className="card-title">Раунды закончились</div>
      </div>
    );
  }

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === round.badIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (roundIndex + 1 >= rounds.length) {
      onGameOver(score);
      return;
    }
    setRoundIndex((i) => i + 1);
    setPicked(null);
  };

  const correct = picked === round.badIndex;

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card-meta">Раунд {roundIndex + 1} из {rounds.length} · счёт {score}</div>
      <div style={{ fontSize: 15 }}>
        <MathText text={round.prompt} />
      </div>
      <p className="card-meta">Найдите шаг с ошибкой:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {round.steps.map((step, i) => {
          const isBad = i === round.badIndex;
          const isPicked = i === picked;
          let borderColor = "var(--color-line)";
          if (picked !== null) {
            if (isBad) borderColor = "var(--color-bad)";
            else if (isPicked) borderColor = "var(--color-text-3)";
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={picked !== null}
              className="btn btn-secondary"
              style={{ justifyContent: "flex-start", textAlign: "left", borderColor }}
            >
              <MathText text={step} />
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div style={{ fontSize: 13.5, color: correct ? "var(--color-ok)" : "var(--color-bad)" }}>
          {correct ? "Верно! " : "Не совсем. "}
          {round.why}
        </div>
      )}
      {picked !== null && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={next}>
          {roundIndex + 1 >= rounds.length ? "Завершить" : "Следующий раунд"}
        </button>
      )}
    </div>
  );
}
