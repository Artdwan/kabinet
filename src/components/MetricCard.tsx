import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "ok" | "bad";
}

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  const color = tone === "ok" ? "var(--color-ok)" : tone === "bad" ? "var(--color-bad)" : "var(--color-text)";
  return (
    <div className="card">
      <div className="card-kicker">{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 30, lineHeight: 1.1, color }}>{value}</div>
      {detail && <div className="card-meta">{detail}</div>}
    </div>
  );
}
