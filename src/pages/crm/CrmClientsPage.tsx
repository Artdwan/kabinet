import { useMemo, useState } from "react";
import { Paperclip, Plus, Search } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TAG,
  formatBYN,
  formatDay,
  formatPeriod,
  openReceipt,
  paidTotal,
  paymentStatus,
  remainingAmount,
  subscriptionTotal,
  type Client,
  type CrmStudent,
  type Subscription,
} from "../../services/crm";
import { SubscriptionModal } from "./SubscriptionModal";
import { PaymentModal } from "./PaymentModal";
import { StudentModal } from "./StudentModal";

const CHANNEL_OPTIONS = ["Instagram", "Telegram", "Рекомендация"];

export function CrmClientsPage() {
  const { show } = useToast();
  const { data: clients = [], reload } = useApiData<Client[]>("/crm/clients");

  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [studentFor, setStudentFor] = useState<{ clientId: string; student: CrmStudent | null } | null>(null);
  const [subFor, setSubFor] = useState<CrmStudent | null>(null);
  const [payFor, setPayFor] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [who, setWho] = useState("мама ученика");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState(CHANNEL_OPTIONS[0]);

  const filtered = useMemo(
    () =>
      clients.filter((c) =>
        `${c.name} ${c.who} ${c.students.map((s) => `${s.name} ${s.grade}`).join(" ")}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      ),
    [clients, q],
  );

  const open = clients.find((c) => c.id === openClientId) ?? null;

  async function createClient() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/crm/clients", { name, who, phone, channel });
      setName("");
      setPhone("");
      setCreateOpen(false);
      reload();
      show("Клиент добавлен", "ok");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать клиента", "bad");
    } finally {
      setBusy(false);
    }
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
              placeholder="Поиск по клиенту или ученику..."
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Добавить клиента
        </button>
      </div>

      <p className="card-body" style={{ margin: 0 }}>
        Клиент — тот, кто платит: обычно родитель. Ученики — его дети, абонементы выписываются на ребёнка.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map((c) => {
          const subs = c.students.flatMap((s) => s.subscriptions);
          return (
            <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => setOpenClientId(c.id)}>
              <div className="card-kicker">{c.who}</div>
              <div className="card-title">{c.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                {c.students.length === 0 && <span className="tag tag-bad">Учеников нет</span>}
                {c.students.map((s) => (
                  <span key={s.id} className="tag tag-neutral">
                    {s.name} · {s.grade}
                  </span>
                ))}
              </div>
              <div className="card-meta">
                {c.channel || "источник не указан"} · абонементов: {subs.length}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="card-body">Клиентов пока нет.</p>}
      </div>

      {createOpen && (
        <Modal
          title="Новый клиент"
          onClose={() => setCreateOpen(false)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={createClient}>
                Создать клиента
              </button>
            </>
          }
        >
          <p className="card-body">Плательщик. Учеников добавите в его карточке.</p>
          <div className="field">
            <label>Имя</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Мария" />
          </div>
          <div className="field">
            <label>Кто это</label>
            <input className="input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="мама ученика" />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+375 29 000-00-00" />
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

      {open && (
        <Modal
          title={open.name}
          onClose={() => setOpenClientId(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setStudentFor({ clientId: open.id, student: null })}>
                <Plus size={14} /> Ученик
              </button>
              <button className="btn btn-secondary" onClick={() => setOpenClientId(null)}>
                Закрыть
              </button>
            </>
          }
        >
          <div className="card-kicker" style={{ marginBottom: 4 }}>
            {open.who} · {open.channel}
          </div>
          <p className="card-body">{open.phone || "Телефон не указан"}</p>

          {open.students.length === 0 && <p className="card-body">Учеников пока нет.</p>}

          {open.students.map((st) => (
            <div key={st.id} className="card" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <b style={{ fontSize: 13 }}>{st.name}</b>
                  <div className="card-kicker">
                    {st.grade} · {st.userId ? "связан с кабинетом" : "нет учебного аккаунта"}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStudentFor({ clientId: open.id, student: st })}
                >
                  Изменить
                </button>
              </div>

              {st.subscriptions.map((sub) => {
                const total = subscriptionTotal(sub.lessonsCount, sub.pricePerLesson, sub.discountPercent);
                const paid = paidTotal(sub.payments);
                const status = paymentStatus(total, paid);
                const left = remainingAmount(total, paid);
                return (
                  <div key={sub.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <b style={{ fontSize: 12 }}>
                        {formatPeriod(sub.periodStart)} · {sub.subject}
                      </b>
                      <span className={PAYMENT_STATUS_TAG[status]}>{PAYMENT_STATUS_LABEL[status]}</span>
                    </div>
                    <div className="card-meta">
                      {sub.lessonsCount} занятий × {sub.pricePerLesson} BYN
                      {sub.discountPercent > 0 && ` · скидка ${sub.discountPercent}%`}
                    </div>
                    <div className="card-meta">
                      Итого {formatBYN(total)} · оплачено {formatBYN(paid)}
                      {left > 0 && ` · остаток ${formatBYN(left)}`}
                    </div>
                    {sub.payments.map((p) => (
                      <div key={p.id} className="card-meta" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span>
                          {formatDay(p.paidAt)} — {formatBYN(p.amount)}
                          {p.note && ` · ${p.note}`}
                        </span>
                        {p.hasReceipt && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openReceipt(p.id)}>
                            <Paperclip size={12} /> чек
                          </button>
                        )}
                      </div>
                    ))}
                    {status !== "PAID" && (
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => setPayFor(sub)}>
                        <Plus size={13} /> Оплата
                      </button>
                    )}
                  </div>
                );
              })}

              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setSubFor(st)}>
                <Plus size={13} /> Абонемент
              </button>
            </div>
          ))}
        </Modal>
      )}

      {studentFor && (
        <StudentModal
          clientId={studentFor.clientId}
          student={studentFor.student}
          onClose={() => setStudentFor(null)}
          onSaved={() => {
            setStudentFor(null);
            reload();
          }}
        />
      )}

      {subFor && (
        <SubscriptionModal
          students={[{ id: subFor.id, name: subFor.name, grade: subFor.grade, clientName: open?.name ?? "" }]}
          fixedStudentId={subFor.id}
          onClose={() => setSubFor(null)}
          onSaved={() => {
            setSubFor(null);
            reload();
          }}
        />
      )}

      {payFor && (
        <PaymentModal
          subscription={payFor}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            setPayFor(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
