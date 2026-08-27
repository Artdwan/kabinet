import { useState } from "react";
import { Copy, Pencil, Plus } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import {
  LEAD_STAGES,
  PLACEHOLDERS,
  copyText,
  stageLabel,
  type LeadStage,
  type Template,
} from "../../services/crm";

export function CrmTemplatesPage() {
  const { show } = useToast();
  const { data: templates = [], reload } = useApiData<Template[]>("/crm/templates");

  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [stage, setStage] = useState<"" | LeadStage>("");
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setTitle("");
    setBody("");
    setStage("");
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setTitle(t.title);
    setBody(t.body);
    setStage(t.stage ?? "");
    setOpen(true);
  }

  async function save() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const payload = { title, body, stage: stage || null };
      if (editing) await api.patch(`/crm/templates/${editing.id}`, payload);
      else await api.post("/crm/templates", payload);
      setOpen(false);
      reload();
      show(editing ? "Шаблон обновлён" : "Шаблон добавлен", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить шаблон", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.del(`/crm/templates/${editing.id}`);
      setOpen(false);
      reload();
      show("Шаблон удалён", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить шаблон", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function copy(t: Template) {
    const ok = await copyText(t.body);
    show(ok ? "Скопировано" : "Не удалось скопировать — выделите вручную", ok ? "ok" : "bad");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="card-body" style={{ margin: 0 }}>
          Готовые ответы для переписки с лидами. В карточке лида подставляются его данные.
        </p>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={14} /> Добавить шаблон
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {templates.map((t) => (
          <div key={t.id} className="card">
            <div className="card-kicker">{stageLabel(t.stage)}</div>
            <div className="card-title">{t.title}</div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                fontSize: 12,
                maxHeight: 150,
                overflowY: "auto",
                margin: "8px 0",
                color: "var(--color-text-2)",
              }}
            >
              {t.body}
            </pre>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => copy(t)}>
                <Copy size={13} /> Копировать
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>
                <Pencil size={13} /> Изменить
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="card-body">Шаблонов пока нет.</p>}
      </div>

      {open && (
        <Modal
          title={editing ? "Изменить шаблон" : "Новый шаблон"}
          onClose={() => setOpen(false)}
          actions={
            <>
              {editing && (
                <button className="btn btn-danger" disabled={busy} onClick={remove}>
                  Удалить
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" disabled={busy || !title.trim() || !body.trim()} onClick={save}>
                Сохранить
              </button>
            </>
          }
        >
          <p className="card-meta">Подстановки: {PLACEHOLDERS.join(", ")}</p>
          <div className="field">
            <label>Название</label>
            <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Первый ответ на заявку" />
          </div>
          <div className="field">
            <label>Этап воронки</label>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value as "" | LeadStage)}>
              <option value="">Любой этап</option>
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Текст</label>
            <textarea
              className="input"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Здравствуйте, {имя}! Вы писали по поводу занятий — {предмет}."
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
