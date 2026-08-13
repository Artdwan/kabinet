export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", padding: "10px 0" }}>
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          border: "1px solid var(--color-line)",
          background: checked ? "var(--color-accent)" : "var(--color-surface-2)",
          position: "relative",
          flex: "none",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .15s ease",
          }}
        />
      </button>
    </label>
  );
}
