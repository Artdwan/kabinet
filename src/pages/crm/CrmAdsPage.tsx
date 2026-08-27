import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { formatBYN, formatDay } from "../../services/crm";

interface AdSpendRow {
  id: string;
  spentOn: string;
  channel: string;
  amount: number;
  currency: "BYN" | "USD";
  rate: number;
  note: string | null;
  amountByn: number;
}

interface Stats {
  from: string;
  to: string;
  leads: number;
  qualified: number;
  clients: number;
  revenue: number;
  spentByn: number;
  cac: number | null;
  roas: number | null;
}

const CHANNELS = ["Instagram", "Telegram", "Google", "Другое"];

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function CrmAdsPage() {
  const { show } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { from, to } = useMemo(() => monthBounds(month), [month]);

  const { data: rows = [], reload } = useApiData<AdSpendRow[]>("/crm/ad-spend");
  const { data: stats, reload: reloadStats } = useApiData<Stats>(
    `/crm/stats?from=${from}&to=${to}`,
    [from, to],
  );

  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"BYN" | "USD">("BYN");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  const monthRows = rows.filter((r) => r.spentOn >= from && r.spentOn <= to);
  const monthTotal = monthRows.reduce((sum, r) => sum + r.amountByn, 0);

  async function add() {
    if (!amount) return;
    setBusy(true);
    try {
      await api.post("/crm/ad-spend", { spentOn, channel, amount, currency, rate });
      setAmount("");
      reload();
      reloadStats();
      show("Расход добавлен", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить расход", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/crm/ad-spend/${id}`);
      reload();
      reloadStats();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить расход", "bad");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Период</label>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Metric label="Лидов" value={stats ? String(stats.leads) : "—"} />
        <Metric label="Квалифицированных" value={stats ? String(stats.qualified) : "—"} />
        <Metric label="Стали клиентами" value={stats ? String(stats.clients) : "—"} />
        <Metric label="Выручка" value={stats ? formatBYN(stats.revenue) : "—"} />
        <Metric label="Расход на рекламу" value={stats ? formatBYN(stats.spentByn) : "—"} />
        <Metric
          label="CAC"
          value={stats?.cac != null ? formatBYN(stats.cac) : "—"}
          hint="реклама на одного клиента"
        />
        <Metric
          label="ROAS"
          value={stats?.roas != null ? `${stats.roas.toFixed(2)}×` : "—"}
          hint="выручка на рубль рекламы"
        />
      </div>

      <p className="card-meta" style={{ margin: 0 }}>
        Цифры считаются по фактам за выбранный месяц: лиды по дате создания, выручка по дате оплаты,
        расход по дате траты. Привязка выручки к конкретным объявлениям пока не делается.
      </p>

      <div className="card">
        <div className="card-title">Добавить расход</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Дата</label>
            <input className="input" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Канал</label>
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Сумма</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Валюта</label>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "BYN" | "USD")}
            >
              <option value="BYN">BYN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {currency === "USD" && (
            <div className="field" style={{ margin: 0 }}>
              <label>Курс НБРБ</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="3.2500"
              />
            </div>
          )}
          <button className="btn btn-primary" disabled={busy || !amount} onClick={add}>
            Добавить
          </button>
        </div>
        {currency === "USD" && (
          <p className="card-meta">
            Курс сохраняется вместе с расходом, поэтому пересчёт в рубли не поедет, если курс потом изменится.
          </p>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Канал</th>
              <th>Сумма</th>
              <th>Курс</th>
              <th>В рублях</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {monthRows.map((r) => (
              <tr key={r.id}>
                <td>{formatDay(r.spentOn)}</td>
                <td>{r.channel || "—"}</td>
                <td>
                  {r.amount.toFixed(2)} {r.currency}
                </td>
                <td>{r.currency === "USD" ? r.rate.toFixed(4) : "—"}</td>
                <td>{formatBYN(r.amountByn)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {monthRows.length === 0 && (
              <tr>
                <td colSpan={6}>За этот месяц расходов нет.</td>
              </tr>
            )}
          </tbody>
          {monthRows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <b>Итого за месяц</b>
                </td>
                <td colSpan={2}>
                  <b>{formatBYN(monthTotal)}</b>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="card-kicker">{label}</div>
      <div style={{ fontSize: 21, fontFamily: "var(--font-heading)", fontWeight: 600 }}>{value}</div>
      {hint && <div className="card-meta">{hint}</div>}
    </div>
  );
}
