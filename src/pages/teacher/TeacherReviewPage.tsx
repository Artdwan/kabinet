import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { REVIEW_QUEUE, STUDENTS } from "../../data/roles";
import { homeworkById } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { useActions } from "../../services/actions";
import { fmtDate } from "../../services/mockApi";

export function TeacherReviewPage() {
  const { store } = useStore();
  const actions = useActions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");

  const openQueueItem = REVIEW_QUEUE.find((q) => q.id === openId);

  const send = () => {
    if (!openQueueItem) return;
    actions.teacherSendReview(openQueueItem.id, grade, comment);
    setOpenId(null);
    setGrade("");
    setComment("");
  };

  return (
    <div data-cols2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {REVIEW_QUEUE.map((q) => {
          const done = store.teacher.reviewed[q.id];
          const student = STUDENTS.find((s) => s.id === q.studentId);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setOpenId(q.id);
                setGrade(done?.grade || "");
                setComment(done?.comment || "");
              }}
              className="card"
              style={{ textAlign: "left", cursor: "pointer", borderColor: openId === q.id ? "var(--color-accent)" : undefined }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="card-title" style={{ fontSize: 15 }}>{q.title}</span>
                {done ? <CheckCircle2 size={16} style={{ color: "var(--color-ok)" }} /> : <span className="tag tag-accent">Ожидает</span>}
              </div>
              <div className="card-meta">{student?.name} · сдано {fmtDate(q.submittedAt)}</div>
              <div className="card-meta">
                Ответов {q.answers} · ручных {q.manual} · файлов {q.files} · подсказок {q.hints}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        {openQueueItem ? (
          <div className="card" style={{ position: "sticky", top: 90 }}>
            <div className="card-title">{openQueueItem.title}</div>
            <div className="card-meta">{STUDENTS.find((s) => s.id === openQueueItem.studentId)?.name}</div>
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
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                // НАСТРОЙКА: в рабочем приложении это PATCH /homeworks/{id} — доступность проверки и решений.
                actions.teacherSendReview(openQueueItem.id, grade || "—", "Решения открыты ученику.");
              }}
            >
              Открыть решения ученику
            </button>
            <button type="button" className="btn btn-primary" disabled={!grade || !comment} onClick={send}>
              Отправить проверку
            </button>
            <p className="card-meta" style={{ margin: 0 }}>
              Данные о работе ({homeworkById(openQueueItem.homeworkId)?.title}) видны выше — откройте её как ученик, чтобы посмотреть ответы и вложения.
            </p>
          </div>
        ) : (
          <div className="card-meta">Выберите работу слева, чтобы поставить оценку и оставить комментарий.</div>
        )}
      </div>
    </div>
  );
}
