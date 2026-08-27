import { useEffect, useState } from "react";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";

const SUBJECT_OPTIONS = ["Математика", "Химия", "ЦЭ / ЦТ"];

export interface StudentOption {
  id: string;
  name: string;
  grade: string;
  clientName: string;
}

export function SubscriptionModal({
  students,
  fixedStudentId,
  onClose,
  onSaved,
}: {
  students: StudentOption[];
  fixedStudentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [studentId, setStudentId] = useState(fixedStudentId ?? "");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 7));
  const [lessonsCount, setLessonsCount] = useState("8");
  const [pricePerLesson, setPricePerLesson] = useState("15");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fixed = students.find((s) => s.id === fixedStudentId);

  // Подставляем цену из подходящего тарифа. Тарифов может не быть — тогда
  // поля просто остаются на ручном вводе.
  useEffect(() => {
    if (!studentId || !subject) return;
    let cancelled = false;
    api
      .get<{
        tariffId: string | null;
        name?: string;
        mode?: "PER_LESSON" | "FIXED_MONTH";
        isFirst: boolean;
        pricePerLesson?: number | null;
        monthlyPrice?: number | null;
        discountPercent?: number;
        lessonsPerMonth?: number | null;
      }>(`/crm/tariffs/suggest?studentId=${studentId}&subject=${encodeURIComponent(subject)}`)
      .then((t) => {
        if (cancelled) return;
        if (!t?.tariffId) {
          setSuggestion(null);
          return;
        }
        setMonthlyPrice(t.mode === "FIXED_MONTH" ? String(t.monthlyPrice ?? "") : "");
        if (t.mode === "PER_LESSON") setPricePerLesson(String(t.pricePerLesson ?? ""));
        setDiscountPercent(String(t.discountPercent ?? 0));
        if (t.lessonsPerMonth) setLessonsCount(String(t.lessonsPerMonth));
        setSuggestion(`${t.name} · ${t.isFirst ? "первый абонемент" : "со второго месяца"}`);
      })
      .catch(() => setSuggestion(null));
    return () => {
      cancelled = true;
    };
  }, [studentId, subject]);

  async function save() {
    if (!studentId || !lessonsCount || (!pricePerLesson && !monthlyPrice)) return;
    setBusy(true);
    try {
      await api.post("/crm/subscriptions", {
        studentId,
        subject,
        periodStart,
        lessonsCount: Number(lessonsCount),
        pricePerLesson,
        monthlyPrice,
        discountPercent: discountPercent || "0",
      });
      show("Абонемент добавлен", "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать абонемент", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Новый абонемент"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !studentId} onClick={save}>
            Создать абонемент
          </button>
        </>
      }
    >
      {fixed ? (
        <p className="card-body">
          Для ученика: <b>{fixed.name}</b> ({fixed.grade})
        </p>
      ) : (
        <div className="field">
          <label>Ученик</label>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Выберите ученика</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.grade} · платит {s.clientName}
              </option>
            ))}
          </select>
        </div>
      )}

      {suggestion && <p className="card-meta">Тариф: {suggestion}</p>}

      <div className="field">
        <label>Предмет</label>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECT_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Период</label>
        <input className="input" type="month" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      </div>
      <div className="field">
        <label>Занятий</label>
        <input className="input" type="number" min="1" value={lessonsCount} onChange={(e) => setLessonsCount(e.target.value)} />
      </div>
      {monthlyPrice ? (
        <div className="field">
          <label>Стоимость месяца, BYN</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
          />
          <small className="card-meta">Фиксированная сумма — число занятий на неё не влияет.</small>
        </div>
      ) : (
        <div className="field">
          <label>Цена за занятие, BYN</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={pricePerLesson}
            onChange={(e) => setPricePerLesson(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label>Скидка, %</label>
        <input
          className="input"
          type="number"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
        />
      </div>
    </Modal>
  );
}
