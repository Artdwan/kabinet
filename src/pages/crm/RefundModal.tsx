import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import { formatBYN, formatPeriod, type SubscriptionRow } from "../../services/crm";

interface Preview {
  lessonsUsed: number;
  lessonsTotal: number;
  perLesson: number;
  usedCost: number;
  paidAmount: number;
  withheld: number;
  amount: number;
  basis: "SUBSCRIPTION" | "FULL";
  suggestedFromCalendar: number | null;
  linkedAccount: boolean;
}

export function RefundModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: SubscriptionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lessonsUsed, setLessonsUsed] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (used?: string) => {
      const q = used != null && used !== "" ? `?lessonsUsed=${Number(used)}` : "";
      const p = await api.get<Preview>(`/crm/subscriptions/${subscription.id}/refund/preview${q}`);
      setPreview(p);
      return p;
    },
    [subscription.id],
  );

  // Первый расчёт — по данным календаря, дальше пересчитываем от введённого
  // числа занятий.
  useEffect(() => {
    load()
      .then((p) => setLessonsUsed(String(p.lessonsUsed)))
      .catch(() => show("Не удалось рассчитать возврат", "bad"));
  }, [load, show]);

  async function confirm() {
    setBusy(true);
    try {
      const r = await api.post<{ amount: number }>(`/crm/subscriptions/${subscription.id}/refund`, {
        lessonsUsed: Number(lessonsUsed) || 0,
        note,
      });
      show(`Абонемент прекращён, к возврату ${formatBYN(r.amount)}`, "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось оформить возврат", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Досрочное прекращение"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !preview} onClick={confirm}>
            Подтвердить возврат
          </button>
        </>
      }
    >
      <p className="card-body">
        {subscription.student.name} · {subscription.subject} · {formatPeriod(subscription.periodStart)}
      </p>

      <div className="field">
        <label>Проведено занятий</label>
        <input
          className="input"
          type="number"
          min="0"
          max={preview?.lessonsTotal ?? undefined}
          value={lessonsUsed}
          onChange={(e) => {
            setLessonsUsed(e.target.value);
            void load(e.target.value).catch(() => undefined);
          }}
        />
        <small className="card-meta">
          {preview?.linkedAccount
            ? preview.suggestedFromCalendar != null
              ? `По календарю: ${preview.suggestedFromCalendar} из ${preview.lessonsTotal}. Можно поправить.`
              : "Занятия в календаре не найдены — укажите вручную."
            : "Ученик не связан с учебным аккаунтом, поэтому число занятий вводится вручную."}
        </small>
      </div>

      {preview && (
        <div className="card">
          <div className="card-title">Расчёт</div>
          <Row label="Оплачено" value={formatBYN(preview.paidAmount)} />
          <Row
            label={`Проведено ${preview.lessonsUsed} × ${formatBYN(preview.perLesson)}`}
            value={`− ${formatBYN(preview.usedCost)}`}
          />
          {preview.withheld > 0 && <Row label="Удержано" value={`− ${formatBYN(preview.withheld)}`} />}
          <Row label="К возврату" value={formatBYN(preview.amount)} strong />
          <p className="card-meta" style={{ marginTop: 8 }}>
            Занятия зачтены{" "}
            {preview.basis === "FULL"
              ? "по полной цене — скидка при досрочном уходе не сохраняется"
              : "по цене абонемента, со скидкой"}
            . Правило меняется в разделе «Тарифы».
          </p>
        </div>
      )}

      <div className="field">
        <label>Комментарий</label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Причина прекращения"
        />
      </div>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
      <span className={strong ? undefined : "card-meta"}>{label}</span>
      <span style={{ fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  );
}
