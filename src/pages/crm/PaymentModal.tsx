import { useRef, useState } from "react";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import {
  formatBYN,
  formatPeriod,
  paidTotal,
  remainingAmount,
  subscriptionTotal,
  type Subscription,
} from "../../services/crm";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function PaymentModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: Subscription;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const total = subscriptionTotal(subscription);
  const left = remainingAmount(total, paidTotal(subscription.payments));

  const [amount, setAmount] = useState(left > 0 ? left.toFixed(2) : "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!amount || !paidAt) return;
    const file = fileRef.current?.files?.[0];
    if (file && file.size > MAX_RECEIPT_BYTES) {
      show("Файл больше 5 МБ — выберите файл поменьше", "bad");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("subscriptionId", subscription.id);
      fd.set("amount", amount);
      fd.set("paidAt", paidAt);
      if (note.trim()) fd.set("note", note.trim());
      if (file) fd.set("receipt", file);
      await api.upload("/crm/payments", fd);
      show("Оплата записана", "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось записать оплату", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Новая оплата"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !amount} onClick={save}>
            Подтвердить оплату
          </button>
        </>
      }
    >
      <p className="card-body">
        {formatPeriod(subscription.periodStart)} · {subscription.subject} · остаток {formatBYN(left)}
      </p>
      <div className="field">
        <label>Сумма, BYN</label>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Дата оплаты</label>
        <input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </div>
      <div className="field">
        <label>Чек (скриншот или PDF)</label>
        <input className="input" type="file" ref={fileRef} accept="image/*,application/pdf" />
      </div>
      <div className="field">
        <label>Комментарий</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, перевод на карту" />
      </div>
    </Modal>
  );
}
