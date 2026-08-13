import type { CtResult } from "../types";

export function ScoreTrendChart({ results, goal }: { results: CtResult[]; goal?: number }) {
  const w = 560;
  const h = 180;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 24;

  if (results.length === 0) {
    return (
      <div style={{ height: h, display: "grid", placeItems: "center", color: "var(--color-text-3)", fontSize: 13 }}>
        Пока нет результатов тестов
      </div>
    );
  }

  const scores = results.map((r) => r.score);
  const minV = Math.min(...scores, goal || 100, 40);
  const maxV = Math.max(...scores, goal || 0, 100);
  const x = (i: number) => padL + (i * (w - padL - padR)) / Math.max(1, results.length - 1);
  const y = (v: number) => h - padB - ((v - minV) / (maxV - minV || 1)) * (h - padT - padB);

  const points = results.map((r, i) => `${x(i)},${y(r.score)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {goal !== undefined && (
        <>
          <line x1={padL} x2={w - padR} y1={y(goal)} y2={y(goal)} stroke="var(--color-text-3)" strokeDasharray="4 4" strokeWidth={1} />
          <text x={w - padR} y={y(goal) - 6} textAnchor="end" fontSize="10" fill="var(--color-text-3)">
            цель {goal}
          </text>
        </>
      )}
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      {results.map((r, i) => (
        <g key={r.id}>
          <circle cx={x(i)} cy={y(r.score)} r={3.5} fill="var(--color-accent)" />
          <text x={x(i)} y={y(r.score) - 10} textAnchor="middle" fontSize="10.5" fill="var(--color-text-2)">
            {r.score}
          </text>
        </g>
      ))}
    </svg>
  );
}
