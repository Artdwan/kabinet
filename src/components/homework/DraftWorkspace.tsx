import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, File as FileIcon, Paperclip, X } from "lucide-react";
import type { Attachment } from "../../types";
import { DrawingCanvas } from "./DrawingCanvas";

interface Props {
  draftText: string;
  drawing: string | null;
  files: Attachment[];
  onDraftChange: (text: string) => void;
  onDrawingChange: (dataUrl: string | null) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function DraftWorkspace({ draftText, drawing, files, onDraftChange, onDrawingChange, onAddFiles, onRemoveFile }: Props) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    onAddFiles(Array.from(list));
  };

  return (
    <div style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-md)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          fontSize: 13,
          color: "var(--color-text-2)",
        }}
      >
        <span>Черновик, рисунок и вложения {files.length > 0 && `(${files.length})`}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ padding: 14, borderTop: "1px solid var(--color-line)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Текстовый черновик</label>
            <textarea className="input" value={draftText} onChange={(e) => onDraftChange(e.target.value)} placeholder="Запишите ход решения..." />
          </div>

          <div className="field">
            <label>Рисунок маркером</label>
            <DrawingCanvas value={drawing} onChange={onDrawingChange} />
          </div>

          <div className="field">
            <label>Фото тетради или PDF</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              style={{
                border: `1px dashed ${dragOver ? "var(--color-accent)" : "var(--color-line)"}`,
                borderRadius: "var(--radius-sm)",
                padding: 16,
                textAlign: "center",
                color: "var(--color-text-3)",
                fontSize: 12.5,
                cursor: "pointer",
              }}
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip size={18} style={{ marginBottom: 4 }} />
              <div>Перетащите файлы сюда или нажмите, чтобы выбрать</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {files.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <FileIcon size={14} style={{ color: "var(--color-text-3)" }} />
                    <span style={{ flex: 1 }}>{f.name}</span>
                    <span className="tag tag-neutral">{f.kind}</span>
                    <span className="card-meta">{fmtSize(f.size)}</span>
                    <button type="button" className="btn btn-icon btn-ghost" onClick={() => onRemoveFile(f.id)} aria-label="Удалить файл">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
