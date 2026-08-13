import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkedExample } from "../../types";
import { MathText } from "../Formula";

export function WorkedExamples({ examples }: { examples: WorkedExample[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {examples.map((ex) => (
        <WorkedExampleItem key={ex.id} example={ex} />
      ))}
    </div>
  );
}

function WorkedExampleItem({ example }: { example: WorkedExample }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, cursor: "pointer", padding: 0, textAlign: "left" }}
      >
        <span className="card-title" style={{ fontSize: 15.5 }}>{example.title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="card-body" style={{ marginTop: 4 }}>
        <MathText text={example.prompt} />
      </p>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--color-text-2)", fontSize: 13.5 }}>
            {example.steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <MathText text={s} />
              </li>
            ))}
          </ol>
          <div style={{ color: "var(--color-ok)", fontStyle: "italic", fontSize: 13.5 }}>
            Ответ: <MathText text={example.answer} />
          </div>
        </div>
      )}
    </div>
  );
}
