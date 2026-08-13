import { useEffect, useRef, useState } from "react";
import type { Trainer } from "../../../types";
import { generateEquation } from "./generateEquation";
import { MathText } from "../../../components/Formula";

interface Props {
  trainer: Trainer;
  onGameOver: (score: number) => void;
}

export function EquationsGame({ trainer, onGameOver }: Props) {
  const duration = trainer.seconds ?? 25;
  const [round, setRound] = useState(() => generateEquation());
  const [value, setValue] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lives, setLives] = useState(trainer.lives ?? 3);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [round]);

  useEffect(() => {
    if (locked || over) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, over, round]);

  function nextRound(currentLives: number) {
    if (currentLives <= 0) {
      setOver(true);
      onGameOver(score);
      return;
    }
    setRound(generateEquation());
    setValue("");
    setTimeLeft(duration);
    setLocked(false);
    setFeedback(null);
  }

  function handleTimeout() {
    if (locked || over) return;
    setLocked(true);
    setFeedback({ ok: false, text: `Время вышло. x = ${round.answer}` });
    setCombo(1);
    setLives((prev) => {
      const next = prev - 1;
      setTimeout(() => nextRound(next), 1200);
      return next;
    });
  }

  function submit() {
    if (locked || over) return;
    const n = parseFloat(value.replace(",", "."));
    setLocked(true);
    if (!Number.isNaN(n) && n === round.answer) {
      const gained = 10 * combo;
      setScore((s) => s + gained);
      setFeedback({ ok: true, text: `Верно! +${gained} очков` });
      setCombo((c) => Math.min(5, c + 1));
      setTimeout(() => nextRound(lives), 700);
    } else {
      setFeedback({ ok: false, text: `Неверно. x = ${round.answer}` });
      setCombo(1);
      setLives((prev) => {
        const next = prev - 1;
        setTimeout(() => nextRound(next), 1200);
        return next;
      });
    }
  }

  if (over) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div className="card-title">Игра окончена</div>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 40, margin: "10px 0" }}>{score}</div>
        <div className="card-meta">очков за игру</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
        <span>Счёт: <b>{score}</b></span>
        <span>Комбо: ×{combo}</span>
        <span>{"♥".repeat(lives)}{"♡".repeat(Math.max(0, (trainer.lives ?? 3) - lives))}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeLeft} с</span>
      </div>
      <div style={{ height: 4, width: "100%", background: "var(--color-line)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${(timeLeft / duration) * 100}%`, height: "100%", background: "var(--color-accent)", transition: "width 1s linear" }} />
      </div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-heading)" }}>
        <MathText text={round.prompt} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          className="input"
          style={{ width: 140, textAlign: "center", fontSize: 18 }}
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="x ="
        />
        <button type="button" className="btn btn-primary" disabled={locked || !value} onClick={submit}>
          Ответить
        </button>
      </div>
      {feedback && (
        <div style={{ color: feedback.ok ? "var(--color-ok)" : "var(--color-bad)", fontSize: 13.5 }}>{feedback.text}</div>
      )}
    </div>
  );
}
