export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tag"
      style={{
        cursor: "pointer",
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-line)"}`,
        background: active ? "var(--color-accent-100)" : "transparent",
        color: active ? "var(--color-accent-700)" : "var(--color-text-2)",
        fontSize: 12.5,
        padding: "6px 12px",
      }}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}
