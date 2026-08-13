import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trainerById } from "../../../data/roles";
import { useStore } from "../../../services/StoreContext";
import { useActions } from "../../../services/actions";
import { EquationsGame } from "./EquationsGame";
import { OrderGame } from "./OrderGame";
import { ColorGame } from "./ColorGame";
import { ErrorGame } from "./ErrorGame";

export function GamePage() {
  const { trainerId } = useParams();
  const navigate = useNavigate();
  const { store } = useStore();
  const actions = useActions();
  const [key, setKey] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const trainer = trainerId ? trainerById(trainerId) : undefined;
  if (!trainer) return <Navigate to="/trainers" replace />;

  const progress = store.games[trainer.id] || { best: 0, played: 0, lastScore: 0 };

  const onGameOver = (score: number) => {
    actions.saveGameRecord(trainer.id, score);
    setLastScore(score);
  };

  const restart = () => {
    setLastScore(null);
    setKey((k) => k + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620, margin: "0 auto" }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/trainers")} style={{ paddingLeft: 0, alignSelf: "flex-start" }}>
        <ArrowLeft size={14} /> К тренажёрам
      </button>
      <div>
        <div className="card-kicker">{trainer.subtitle}</div>
        <h1 style={{ margin: "4px 0 6px" }}>{trainer.title}</h1>
        <p style={{ color: "var(--color-text-2)", margin: 0 }}>{trainer.description}</p>
        <div className="card-meta" style={{ marginTop: 6 }}>Рекорд: {progress.best} · Попыток: {progress.played}</div>
      </div>

      {lastScore !== null ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="card-title">Результат</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 40, margin: "10px 0" }}>{lastScore}</div>
          {lastScore >= progress.best && lastScore > 0 && <div className="tag tag-accent" style={{ marginBottom: 10 }}>Новый рекорд!</div>}
          <button type="button" className="btn btn-primary" onClick={restart}>
            Играть ещё раз
          </button>
        </div>
      ) : (
        <GameByKind key={key} trainer={trainer} onGameOver={onGameOver} />
      )}
    </div>
  );
}

function GameByKind({ trainer, onGameOver }: { trainer: ReturnType<typeof trainerById>; onGameOver: (score: number) => void }) {
  if (!trainer) return null;
  if (trainer.kind === "equations") return <EquationsGame trainer={trainer} onGameOver={onGameOver} />;
  if (trainer.kind === "order") return <OrderGame trainer={trainer} onGameOver={onGameOver} />;
  if (trainer.kind === "color") return <ColorGame trainer={trainer} onGameOver={onGameOver} />;
  return <ErrorGame trainer={trainer} onGameOver={onGameOver} />;
}
