import { useState } from "react";
import { Link } from "react-router-dom";
import { useApiData } from "../../services/useApiData";
import { api } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { fmtDate } from "../../services/mockApi";

interface QueueRow {
  id: string;
  studentId: string;
  studentName: string;
  homeworkId: string;
  title: string;
  submittedAt: string;
  answers: number;
  manual: number;
  files: number;
  hints: number;
}

export function TeacherReviewPage() {
  const { data: queue = [], reload } = useApiData<QueueRow[]>("/teacher/review-queue");
  const { show } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const openQueueItem = queue.find((q) => q.id === openId);

  const send = async () => {
    if (!openQueueItem) return;
    setSending(true);
    try {
      await api.post(`/teacher/review/${openQueueItem.studentId}/${openQueueItem.homeworkId}`, { grade, comment, flagged: [] });
      show("Проверка отправлена ученику", "ok");
      setOpenId(null);
      setGrade("");
      setComment("");
      reload();
    } catch (e) {
      show(e instanceof Error ? e.message : "Не удалось отправить проверку", "bad");
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-cols2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {queue.length === 0 && <div className="card-meta">Все работы проверены.</div>}
        {queue.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => {
              setOpenId(q.id);
              setGrade("");
              setComment("");
            }}
            className="card"
            style={{ textAlign: "left", cursor: "pointer", borderColor: openId === q.id ? "var(--color-accent)" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="card-title" style={{ fontSize: 15 }}>{q.title}</span>
              <span className="tag tag-accent">Ожидает</span>
            </div>
            <div className="card-meta">{q.studentName} · сдано {fmtDate(q.submittedAt)}</div>
            <div className="card-meta">
              Ответов {q.answers} · ручных {q.manual} · файлов {q.files} · подсказок {q.hints}
            </div>
          </button>
        ))}
      </div>

      <div>
        {openQueueItem ? (
          <div className="card" style={{ position: "sticky", top: 90 }}>
            <div className="card-title">{openQueueItem.title}</div>
            <div className="card-meta">{openQueueItem.studentName}</div>
            <Link to={`/homework/${openQueueItem.homeworkId}`} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
              Открыть работу как ученик
            </Link>
            <div className="field">
              <label>Оценка</label>
              <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Например, 8 / 10" />
            </div>
            <div className="field">
              <label>Комментарий</label>
              <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что получилось, что нужно доработать..." />
            </div>
            <button type="button" className="btn btn-primary" disabled={!grade || !comment || sending} onClick={send}>
              Отправить проверку
            </button>
          </div>
        ) : (
          <div className="card-meta">Выберите работу слева, чтобы поставить оценку и оставить комментарий.</div>
        )}
      </div>
    </div>
  );
}
