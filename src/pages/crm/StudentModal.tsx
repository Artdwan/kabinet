import { useState } from "react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { Modal } from "../../components/Modal";
import type { CrmStudent } from "../../services/crm";

interface RosterRow {
  id: string;
  name: string;
  grade: number;
  groupNames: string[];
}

/** Ребёнок клиента. Связь с учебным аккаунтом здесь — обычный внешний ключ,
 *  поэтому выбираем из реального списка учеников, а не вводим id руками. */
export function StudentModal({
  clientId,
  student,
  onClose,
  onSaved,
}: {
  clientId: string;
  student: CrmStudent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");

  const [name, setName] = useState(student?.name ?? "");
  const [grade, setGrade] = useState(student?.grade ?? "");
  const [userId, setUserId] = useState(student?.userId ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const body = { clientId, name, grade, userId: userId || null };
      if (student) await api.patch(`/crm/students/${student.id}`, body);
      else await api.post("/crm/students", body);
      show(student ? "Ученик обновлён" : "Ученик добавлен", "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось сохранить ученика", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!student) return;
    setBusy(true);
    try {
      await api.del(`/crm/students/${student.id}`);
      show("Ученик удалён", "ok");
      onSaved();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось удалить ученика", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={student ? "Ученик" : "Новый ученик"}
      onClose={onClose}
      actions={
        <>
          {student && (
            <button className="btn btn-danger" disabled={busy} onClick={remove}>
              Удалить
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={save}>
            Сохранить
          </button>
        </>
      }
    >
      <div className="field">
        <label>Имя ученика</label>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Максим" />
      </div>
      <div className="field">
        <label>Класс</label>
        <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="9 класс" />
      </div>
      <div className="field">
        <label>Учебный аккаунт</label>
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Не связан</option>
          {roster.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.grade} класс
              {r.groupNames.length > 0 && ` · ${r.groupNames.join(", ")}`}
            </option>
          ))}
        </select>
        <small className="card-meta">Связь даёт доступ к успеваемости и занятиям ученика.</small>
      </div>
    </Modal>
  );
}
