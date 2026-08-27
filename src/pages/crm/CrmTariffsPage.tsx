import { useState } from "react";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import { formatBYN, formatPeriod } from "../../services/crm";

export interface Tariff {
  id: string;
  name: string;
  subject: string | null;
  gradeFrom: number | null;
  gradeTo: number | null;
  appliesTo: "FIRST" | "REPEAT" | "ANY";
  mode: "PER_LESSON" | "FIXED_MONTH";
  pricePerLesson: number | null;
  monthlyPrice: number | null;
  discountPercent: number;
  lessonsPerMonth: number | null;
  active: boolean;
  priority: number;
}

const APPLIES_LABEL = {
  FIRST: "Первый абонемент",
  REPEAT: "Со второго месяца",
  ANY: "Любой",
} as const;

const SUBJECTS = ["Математика", "Химия", "ЦЭ / ЦТ"];

const empty = {
  name: "",
  subject: "",
  gradeFrom: "",
  gradeTo: "",
  appliesTo: "ANY" as Tariff["appliesTo"],
  mode: "PER_LESSON" as Tariff["mode"],
  pricePerLesson: "",
  monthlyPrice: "",
  discountPercent: "0",
  lessonsPerMonth: "",
  priority: "100",
  active: true,
};

export function CrmTariffsPage() {
  const { show } = useToast();
  const { data: tariffs = [], reload } = useApiData<Tariff[]>("/crm/tariffs");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [genResult, setGenResult] = useState<{ period: string; created: { student: string; subject: string; total: number; tariff: string | null }[]; skipped: number } | null>(null);

  const set = (k: keyof typeof empty, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(t: Tariff) {
    setEditing(t);
    setForm({
      name: t.name,
      subject: t.subject ?? "",
      gradeFrom: t.gradeFrom?.toString() ?? "",
      gradeTo: t.gradeTo?.toString() ?? "",
      appliesTo: t.appliesTo,
      mode: t.mode,
      pricePerLesson: t.pricePerLesson?.toString() ?? "",
      monthlyPrice: t.monthlyPrice?.toString() ?? "",
      discountPercent: String(t.discountPercent),
      lessonsPerMonth: t.lessonsPerMonth?.toString() ?? "",
      priority: String(t.priority),
      active: t.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editing) await api.patch(`/crm/tariffs/${editing.id}`, form);
      else await api.post("/crm/tariffs", form);
      setOpen(false);
      reload();
      show(editing ? "Тариф обновлён" : "Тариф добавлен", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить тариф", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.del(`/crm/tariffs/${editing.id}`);
      setOpen(false);
      reload();
      show("Тариф удалён", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить тариф", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const r = await api.post<typeof genResult>("/crm/subscriptions/generate");
      setGenResult(r);
      show(r && r.created.length ? `Создано абонементов: ${r.created.length}` : "Новых абонементов не потребовалось", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать абонементы", "bad");
    } finally {
      setBusy(false);
    }
  }

  function priceOf(t: Tariff) {
    const base =
      t.mode === "FIXED_MONTH"
        ? `${formatBYN(t.monthlyPrice ?? 0)} / мес`
        : `${formatBYN(t.pricePerLesson ?? 0)} / занятие`;
    return t.discountPercent > 0 ? `${base} · скидка ${t.discountPercent}%` : base;
  }

  function scopeOf(t: Tariff) {
    const parts: string[] = [t.subject ?? "любой предмет"];
    if (t.gradeFrom != null || t.gradeTo != null) {
      parts.push(
        t.gradeFrom != null && t.gradeTo != null && t.gradeFrom !== t.gradeTo
          ? `${t.gradeFrom}–${t.gradeTo} кл.`
          : `${t.gradeFrom ?? t.gradeTo} кл.`,
      );
    } else parts.push("любой класс");
    return parts.join(" · ");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="card-body" style={{ margin: 0, maxWidth: 620 }}>
          Правила ценообразования. По ним подставляется цена при создании абонемента и создаются
          абонементы на следующий месяц. Если подходит несколько тарифов, выигрывает меньший приоритет,
          а при равенстве — более узкий по предмету и классу.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" disabled={busy} onClick={generate}>
            <CalendarPlus size={14} /> Абонементы на следующий месяц
          </button>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} /> Тариф
          </button>
        </div>
      </div>

      {genResult && (
        <div className="card">
          <div className="card-title">
            {formatPeriod(genResult.period)} — создано: {genResult.created.length}
            {genResult.skipped > 0 && `, пропущено (уже есть): ${genResult.skipped}`}
          </div>
          {genResult.created.map((c, i) => (
            <div key={i} className="card-meta">
              {c.student} · {c.subject} — {formatBYN(c.total)}
              {c.tariff ? ` (тариф «${c.tariff}»)` : " (по прошлому месяцу)"}
            </div>
          ))}
          {genResult.created.length === 0 && (
            <p className="card-body">
              Всё уже заведено либо ещё нет абонементов, от которых можно оттолкнуться.
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Тариф</th>
              <th>Применяется</th>
              <th>Когда</th>
              <th>Цена</th>
              <th>Занятий</th>
              <th>Приоритет</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tariffs.map((t) => (
              <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
                <td>
                  {t.name}
                  {!t.active && <div className="card-meta">выключен</div>}
                </td>
                <td>{scopeOf(t)}</td>
                <td>{APPLIES_LABEL[t.appliesTo]}</td>
                <td>{priceOf(t)}</td>
                <td>{t.lessonsPerMonth ?? "как в прошлом"}</td>
                <td>{t.priority}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {tariffs.length === 0 && (
              <tr>
                <td colSpan={7}>
                  Тарифов пока нет — без них цена в абонементе вводится вручную.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          title={editing ? "Тариф" : "Новый тариф"}
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
              <button className="btn btn-primary" disabled={busy || !form.name.trim()} onClick={save}>
                Сохранить
              </button>
            </>
          }
        >
          <div className="field">
            <label>Название</label>
            <input
              className="input"
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Реклама, первый абонемент"
            />
          </div>
          <div className="field">
            <label>Предмет</label>
            <select className="input" value={form.subject} onChange={(e) => set("subject", e.target.value)}>
              <option value="">Любой</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Класс с</label>
              <input className="input" type="number" value={form.gradeFrom} onChange={(e) => set("gradeFrom", e.target.value)} placeholder="7" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>по</label>
              <input className="input" type="number" value={form.gradeTo} onChange={(e) => set("gradeTo", e.target.value)} placeholder="10" />
            </div>
          </div>
          <div className="field">
            <label>Применяется</label>
            <select className="input" value={form.appliesTo} onChange={(e) => set("appliesTo", e.target.value)}>
              <option value="ANY">К любому абонементу</option>
              <option value="FIRST">Только к первому</option>
              <option value="REPEAT">Со второго месяца</option>
            </select>
          </div>
          <div className="field">
            <label>Как считается</label>
            <select className="input" value={form.mode} onChange={(e) => set("mode", e.target.value)}>
              <option value="PER_LESSON">Цена за занятие × количество</option>
              <option value="FIXED_MONTH">Фиксированная сумма за месяц</option>
            </select>
          </div>
          {form.mode === "PER_LESSON" ? (
            <div className="field">
              <label>Цена за занятие, BYN</label>
              <input className="input" type="number" step="0.01" value={form.pricePerLesson} onChange={(e) => set("pricePerLesson", e.target.value)} placeholder="15" />
            </div>
          ) : (
            <div className="field">
              <label>Стоимость месяца, BYN</label>
              <input className="input" type="number" step="0.01" value={form.monthlyPrice} onChange={(e) => set("monthlyPrice", e.target.value)} placeholder="260" />
            </div>
          )}
          <div className="field">
            <label>Скидка, %</label>
            <input className="input" type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} />
          </div>
          <div className="field">
            <label>Занятий в месяц</label>
            <input className="input" type="number" value={form.lessonsPerMonth} onChange={(e) => set("lessonsPerMonth", e.target.value)} placeholder="оставьте пустым — как в прошлом месяце" />
          </div>
          <div className="field">
            <label>Приоритет</label>
            <input className="input" type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} />
            <small className="card-meta">Меньше — важнее при совпадении нескольких тарифов.</small>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Тариф включён
          </label>
        </Modal>
      )}
    </div>
  );
}
