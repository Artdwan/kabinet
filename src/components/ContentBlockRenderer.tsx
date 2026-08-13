import { AlertTriangle, Image as ImageIcon, Info, PlayCircle } from "lucide-react";
import type { ContentBlock } from "../types";
import { FormulaLine, MathText } from "./Formula";

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {blocks.map((b, i) => (
        <ContentBlockItem key={i} block={b} />
      ))}
    </div>
  );
}

function ContentBlockItem({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 id={slug(block.text)} style={{ scrollMarginTop: 90, marginTop: 8 }}>
          {block.text}
        </h3>
      );
    case "text":
      return (
        <p style={{ margin: 0, color: "var(--color-text-2)", textAlign: "justify" }}>
          <MathText text={block.text} />
        </p>
      );
    case "formula":
      return (
        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
          }}
        >
          {block.lines.map((line, i) => (
            <div key={i} style={{ fontSize: 18 }}>
              <FormulaLine text={line} />
            </div>
          ))}
          {block.caption && <div className="card-meta" style={{ marginTop: 4 }}>{block.caption}</div>}
        </div>
      );
    case "note":
      return (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 14,
            borderRadius: "var(--radius-md)",
            background: "var(--color-accent-100)",
            border: "1px solid var(--color-accent-300)",
          }}
        >
          <Info size={18} style={{ color: "var(--color-accent)", flex: "none", marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{block.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--color-text-2)" }}>{block.text}</div>
          </div>
        </div>
      );
    case "warning":
      return (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 14,
            borderRadius: "var(--radius-md)",
            background: "var(--color-bad-100)",
            border: "1px solid var(--color-bad-300)",
          }}
        >
          <AlertTriangle size={18} style={{ color: "var(--color-bad)", flex: "none", marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{block.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--color-text-2)" }}>{block.text}</div>
          </div>
        </div>
      );
    case "video":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--color-line)",
            color: "var(--color-text-2)",
          }}
        >
          <PlayCircle size={28} style={{ color: "var(--color-accent)", flex: "none" }} />
          <div>
            <div style={{ fontSize: 13.5, color: "var(--color-text)" }}>{block.title}</div>
            <div className="card-meta">{block.duration}</div>
          </div>
        </div>
      );
    case "image":
      return (
        <figure className="plate" style={{ margin: 0 }}>
          <div
            style={{
              height: 160,
              display: "grid",
              placeItems: "center",
              background: "var(--color-surface-2)",
              color: "var(--color-text-3)",
            }}
          >
            <ImageIcon size={28} />
          </div>
          <figcaption style={{ padding: "6px 4px", fontSize: 11.5, color: "var(--color-text-3)" }}>{block.caption}</figcaption>
        </figure>
      );
    default:
      return null;
  }
}

export function headingAnchors(blocks: ContentBlock[]): { id: string; text: string }[] {
  return blocks.filter((b): b is Extract<ContentBlock, { type: "heading" }> => b.type === "heading").map((b) => ({ id: slug(b.text), text: b.text }));
}
