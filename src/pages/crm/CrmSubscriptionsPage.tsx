import { useMemo, useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import { useApiData } from "../../services/useApiData";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TAG,
  formatBYN,
  formatPeriod,
  openReceipt,
  paidTotal,
  paymentStatus,
  remainingAmount,
  subscriptionTotal,
  type StudentRow,
  type SubscriptionRow,
} from "../../services/crm";
import { SubscriptionModal } from "./SubscriptionModal";
import { PaymentModal } from "./PaymentModal";

export function CrmSubscriptionsPage() {
  const { data: subs = [], reload } = useApiData<SubscriptionRow[]>("/crm/subscriptions");
  const { data: students = [], reload: reloadStudents } = useApiData<StudentRow[]>("/crm/students");

  const [createOpen, setCreateOpen] = useState(false);
  const [payFor, setPayFor] = useState<SubscriptionRow | null>(null);

  const options = useMemo(
    () => students.map((s) => ({ id: s.id, name: s.name, grade: s.grade, clientName: s.client.name })),
    [students],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="card-body" style={{ margin: 0 }}>
          Абонементы выписываются на ученика, а платит клиент — поэтому в таблице есть и тот и другой.
        </p>
        <button className="btn btn-primary" disabled={options.length === 0} onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Добавить абонемент
        </button>
      </div>

      {options.length === 0 ? (
        <p className="card-body">Сначала добавьте клиента и его учеников в разделе «Клиенты».</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Клиент</th>
                <th>Предмет</th>
                <th>Период</th>
                <th>Занятий</th>
                <th>Цена</th>
                <th>Скидка</th>
                <th>Итого</th>
                <th>Оплачено</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const total = subscriptionTotal(sub.lessonsCount, sub.pricePerLesson, sub.discountPercent);
                const paid = paidTotal(sub.payments);
                const status = paymentStatus(total, paid);
                const withReceipt = sub.payments.filter((p) => p.hasReceipt);
                return (
                  <tr key={sub.id}>
                    <td>
                      {sub.student.name}
                      <div className="card-meta">{sub.student.grade}</div>
                    </td>
                    <td>{sub.student.client.name}</td>
                    <td>{sub.subject}</td>
                    <td>{formatPeriod(sub.periodStart)}</td>
                    <td>{sub.lessonsCount}</td>
                    <td>{formatBYN(sub.pricePerLesson)}</td>
                    <td>{sub.discountPercent > 0 ? `${sub.discountPercent}%` : "—"}</td>
                    <td>{formatBYN(total)}</td>
                    <td>{formatBYN(paid)}</td>
                    <td>{formatBYN(remainingAmount(total, paid))}</td>
                    <td>
                      <span className={PAYMENT_STATUS_TAG[status]}>{PAYMENT_STATUS_LABEL[status]}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {withReceipt.map((p) => (
                        <button key={p.id} className="btn btn-ghost btn-sm" onClick={() => openReceipt(p.id)}>
                          <Paperclip size={12} />
                        </button>
                      ))}
                      {status !== "PAID" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setPayFor(sub)}>
                          <Plus size={12} /> Оплата
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={12}>Абонементов пока нет.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <SubscriptionModal
          students={options}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            reload();
            reloadStudents();
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
