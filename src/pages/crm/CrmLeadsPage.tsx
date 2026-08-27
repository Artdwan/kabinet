import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Search, UserPlus } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import {
  LEAD_STAGES,
  copyText,
  renderTemplate,
  stageIndex,
  type Lead,
  type LeadStage,
  type Template,
} from "../../services/crm";

const SUBJECT_OPTIONS = ["Математика", "Химия", "ЦЭ / ЦТ"];
const CHANNEL_OPTIONS = ["Instagram", "Telegram", "Рекомендация"];

export function CrmLeadsPage() {
  const { show } = useToast();
  const { data: leads = [], reload } = useApiData<Lead[]>("/crm/leads");
  const { data: templates = [] } = useApiData<Template[]>("/crm/templates");

  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [channel, setChannel] = useState(CHANNEL_OPTIONS[0]);

  const filtered = useMemo(
    () =>
      leads.filter((l) =>
        `${l.name} ${l.grade} ${l.subject}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [leads, q],
  );

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const fail = (e: unknown, fallback: string) =>
    show(e instanceof ApiError ? e.message : fallback, "bad");

  async function createLead() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/crm/leads", { name, grade, subject, channel });
      setName("");
      setGrade("");
      setCreateOpen(false);
      reload();
      show("Лид добавлен", "ok");
    } catch (e) {
      fail(e, "Не удалось создать лида");
    } finally {
      setBusy(false);
    }
  }

  async function move(lead: Lead, delta: 1 | -1) {
    const next = LEAD_STAGES[Math.max(0, Math.min(LEAD_STAGES.length - 1, stageIndex(lead.status) + delta))];
    if (next.key === lead.status) return;
    try {
      await api.patch(`/crm/leads/${lead.id}`, { status: next.key });
      reload();
    } catch (e) {
      fail(e, "Не удалось перенести лида");
    }
  }

  async function setStage(lead: Lead, status: LeadStage) {
    try {
      await api.patch(`/crm/leads/${lead.id}`, { status });
      reload();
    } catch (e) {
      fail(e, "Не удалось изменить этап");
    }
  }

  async function convert(lead: Lead) {
    try {
      await api.post(`/crm/leads/${lead.id}/convert`);
      reload();
      show("Клиент создан", "ok");
    } catch (e) {
      fail(e, "Не удалось создать клиента");
    }
  }

  async function copyTemplate(t: Template, lead: Lead) {
    const ok = await copyText(
      renderTemplate(t.body, {
        name: lead.name,
        grade: lead.grade,
        subject: lead.subject,
        channel: lead.channel,
      }),
    );
    show(ok ? "Текст скопирован" : "Не удалось скопировать — выделите вручную", ok ? "ok" : "bad");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 220, margin: 0 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 11, opacity: 0.5 }} />
            <input
              className="input"
              style={{ paddingLeft: 30 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по имени, классу, предмету..."
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Добавить лида
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {LEAD_STAGES.map((stage, ci) => {
          const cards = filtered.filter((l) => l.status === stage.key);
          return (
            <div
              key={stage.key}
              style={{
                minWidth: 250,
                flex: "0 0 250px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color }} />
                <b style={{ fontSize: 13, flex: 1 }}>{stage.label}</b>
                <span className="tag tag-neutral">{cards.length}</span>
              </div>

              {cards.map((lead) => (
                <div
                  key={lead.id}
                  className="card"
                  style={{ cursor: "pointer", gap: 8 }}
                  onClick={() => setSelectedId(lead.id)}
                >
                  <div className="card-title" style={{ fontSize: 13 }}>{lead.name}</div>
                  <div className="card-kicker">{lead.who}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {lead.grade && <span className="tag tag-neutral">{lead.grade}</span>}
                    {lead.subject && <span className="tag tag-neutral">{lead.subject}</span>}
                  </div>
                  <div className="card-meta">{lead.channel || "источник не указан"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={ci === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(lead, -1);
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={ci === LEAD_STAGES.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(lead, 1);
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {createOpen && (
        <Modal
          title="Новый лид"
          onClose={() => setCreateOpen(false)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={createLead}>
                Создать лида
              </button>
            </>
          }
        >
          <div className="field">
            <label>Имя или ник</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, @maria_9" />
          </div>
          <div className="field">
            <label>Класс</label>
            <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="9 класс" />
          </div>
          <div className="field">
            <label>Предмет</label>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Канал</label>
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal
          title={selected.name}
          onClose={() => setSelectedId(null)}
          actions={
            <button className="btn btn-secondary" onClick={() => setSelectedId(null)}>
              Закрыть
            </button>
          }
        >
          <div className="card-kicker" style={{ marginBottom: 10 }}>
            {selected.who} · {selected.channel} · {selected.grade} · {selected.subject}
          </div>

          <div className="field">
            <label>Этап воронки</label>
            <select
              className="input"
              value={selected.status}
              onChange={(e) => setStage(selected, e.target.value as LeadStage)}
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {selected.status === "RESULT" && (
            <div className="field">
              <label>Клиент</label>
              {selected.clientId ? (
                <div className="tag tag-ok">Клиент создан</div>
              ) : (
                <button className="btn btn-primary btn-block" onClick={() => convert(selected)}>
                  <UserPlus size={14} /> Создать клиента
                </button>
              )}
            </div>
          )}

          <div className="field">
            <label>Шаблоны ответов</label>
            {templates.length === 0 && <p className="card-body">Шаблонов пока нет — добавьте их в разделе «Шаблоны».</p>}
            {templates
              .filter((t) => t.stage === null || t.stage === selected.status)
              .sort((a, b) => Number(a.stage === null) - Number(b.stage === null))
              .map((t) => (
                <div
                  key={t.id}
                  style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12 }}>{t.title}</b>
                    <p className="card-body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {renderTemplate(t.body, selected).slice(0, 140)}
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyTemplate(t, selected)}>
                    <Copy size={13} />
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
