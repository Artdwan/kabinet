import type { TopicAccuracy } from "../types";
import { accuracyColor, topicName } from "../services/selectors";

export function TopicAccuracyBars({ items }: { items: TopicAccuracy[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((t) => (
        <div key={t.topicId}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
            <span>{topicName(t.topicId)}</span>
            <span style={{ color: accuracyColor(t.accuracy) }}>{t.accuracy}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--color-line)", overflow: "hidden" }}>
            <div style={{ width: `${t.accuracy}%`, height: "100%", background: accuracyColor(t.accuracy) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
