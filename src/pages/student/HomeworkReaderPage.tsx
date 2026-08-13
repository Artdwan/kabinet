import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronRight, Flag } from "lucide-react";
import { homeworkById, SUBJECTS } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { useActions, getHomeworkAttempt, isHomeworkSubmitted } from "../../services/actions";
import { allExercises, emptyAttempt, fmtDate, homeworkProgress } from "../../services/mockApi";
import { liveStatus } from "../../services/selectors";
import { StatusBadge } from "../../components/StatusBadge";
import { ContentBlocks } from "../../components/ContentBlockRenderer";
import { WorkedExamples } from "../../components/homework/WorkedExamples";
import { ExerciseCard } from "../../components/homework/ExerciseCard";
import { Modal } from "../../components/Modal";
import { ProgressRing } from "../../components/ProgressRing";

export function HomeworkReaderPage() {
  const { hwId } = useParams();
  const navigate = useNavigate();
  const { store } = useStore();
  const actions = useActions();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hw = hwId ? homeworkById(hwId) : undefined;
  const exercises = useMemo(() => (hw ? allExercises(hw) : []), [hw]);

  const flaggedMap = useMemo(() => {
    const m = new Map<string, string>();
    hw?.feedback?.flagged.forEach((f) => m.set(f.exerciseId, f.note));
    return m;
  }, [hw]);

  const firstUnsolvedId = useMemo(() => {
    if (!hw) return undefined;
    const ex = exercises.find((e) => {
      const st = getHomeworkAttempt(store, hw.id, e.id).status;
      return st !== "correct" && st !== "manual";
    });
    return ex?.id;
  }, [exercises, store, hw]);

  if (!hw) return <Navigate to="/homework" replace />;

  const subject = SUBJECTS.find((s) => s.id === hw.subjectId);
  const status = liveStatus(hw, store);
  const hwState = store.homework[hw.id];
  const submitted = isHomeworkSubmitted(store, hw.id);
  const progress = homeworkProgress(hw, hwState);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = () => {
    actions.submitHomework(hw.id);
    setConfirmOpen(false);
  };

  const solvedCount = exercises.filter((e) => getHomeworkAttempt(store, hw.id, e.id).status === "correct").length;
  const skippedCount = exercises.filter((e) => getHomeworkAttempt(store, hw.id, e.id).status === "not_started").length;
  const hintsUsedCount = exercises.reduce((sum, e) => sum + getHomeworkAttempt(store, hw.id, e.id).hintsOpened, 0);
  const filesCount = exercises.reduce((sum, e) => sum + getHomeworkAttempt(store, hw.id, e.id).files.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/homework")} style={{ paddingLeft: 0, marginBottom: 6 }}>
          <ArrowLeft size={14} /> К списку домашних работ
        </button>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="card-kicker">{subject?.name}</span>
              <h1 style={{ margin: "4px 0 6px", fontSize: 26 }}>{hw.title}</h1>
              <p style={{ color: "var(--color-text-2)", margin: 0, maxWidth: 560 }}>{hw.summary}</p>
              <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }} className="card-meta">
                <span>Назначено {fmtDate(hw.assignedAt)}</span>
                <span>Дедлайн {fmtDate(hw.dueAt)}</span>
                <StatusBadge status={status} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <ProgressRing percent={progress.percent} size={56} />
              <span className="card-meta">Выполнено {progress.done} из {progress.total}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {firstUnsolvedId && !submitted && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => scrollTo(`ex-${firstUnsolvedId}`)}>
                Продолжить с места остановки
              </button>
            )}
            {hw.sections.map((sc) => (
              <button key={sc.id} type="button" className="btn btn-secondary btn-sm" onClick={() => scrollTo(`sec-${sc.id}`)}>
                {sc.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div data-readergrid>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {hw.feedback && (
            <div className="card" style={{ borderColor: "var(--color-accent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="card-title">Отзыв преподавателя</div>
                <span className="tag tag-accent">{hw.feedback.grade}</span>
              </div>
              <div className="card-meta">{hw.feedback.teacher} · {fmtDate(hw.feedback.date)}</div>
              <p className="card-body">{hw.feedback.text}</p>
              {hw.feedback.flagged.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {hw.feedback.flagged.map((f) => (
                    <button
                      key={f.exerciseId}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ justifyContent: "flex-start", paddingLeft: 0 }}
                      onClick={() => scrollTo(`ex-${f.exerciseId}`)}
                    >
                      <Flag size={13} /> Замечание к заданию {f.exerciseId.split("-").pop()} <ChevronRight size={13} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {submitted && (
            <div className="card" style={{ borderColor: "var(--color-ok)", display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={20} style={{ color: "var(--color-ok)" }} />
              <div>
                <div style={{ fontSize: 14 }}>Отправлено преподавателю</div>
                <div className="card-meta">Сдано {fmtDate(hwState?.submittedAt?.slice(0, 10))}</div>
              </div>
            </div>
          )}

          {hw.sections.map((sc) => (
            <section key={sc.id} id={`sec-${sc.id}`} style={{ scrollMarginTop: 90, display: "flex", flexDirection: "column", gap: 14 }}>
              <h2 style={{ fontSize: 20 }}>{sc.title}</h2>
              {sc.kind === "content" && <ContentBlocks blocks={sc.blocks} />}
              {sc.kind === "examples" && <WorkedExamples examples={sc.examples} />}
              {sc.kind === "exercises" && (
                <>
                  {sc.hint && <p className="card-meta">{sc.hint}</p>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {sc.exercises.map((ex) => {
                      const attempt = getHomeworkAttempt(store, hw.id, ex.id) || emptyAttempt();
                      return (
                        <ExerciseCard
                          key={ex.id}
                          exercise={ex}
                          attempt={attempt}
                          submitted={submitted}
                          flaggedNote={flaggedMap.get(ex.id)}
                          onAnswer={(v) => actions.setAnswer(hw.id, ex.id, v)}
                          onCheck={() => actions.checkEx(hw.id, ex)}
                          onHint={() => actions.openHint(hw.id, ex)}
                          onSolution={() => actions.openSolution(hw.id, ex.id)}
                          onDraft={(t) => actions.setDraft(hw.id, ex.id, t)}
                          onDrawing={(d) => actions.saveDrawing(hw.id, ex.id, d)}
                          onAddFiles={(files) => actions.addFiles(hw.id, ex.id, files)}
                          onRemoveFile={(id) => actions.removeFile(hw.id, ex.id, id)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          ))}

          {!submitted && (
            <div className="card" style={{ alignItems: "flex-start" }}>
              <div className="card-title">Сдача работы</div>
              <p className="card-body">
                Когда решите все задания (или столько, сколько успели), отправьте работу преподавателю на проверку.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)}>
                Сдать работу
              </button>
            </div>
          )}
        </div>

        <div data-sticky style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-title" style={{ fontSize: 15 }}>Прогресс по группам</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {hw.sections
                .filter((sc) => sc.kind === "exercises")
                .map((sc) => {
                  if (sc.kind !== "exercises") return null;
                  const done = sc.exercises.filter((e) => getHomeworkAttempt(store, hw.id, e.id).status === "correct" || getHomeworkAttempt(store, hw.id, e.id).status === "manual").length;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => scrollTo(`sec-${sc.id}`)}
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: "space-between" }}
                    >
                      <span>{sc.title}</span>
                      <span className="card-meta">{done}/{sc.exercises.length}</span>
                    </button>
                  );
                })}
            </div>
            {firstUnsolvedId && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => scrollTo(`ex-${firstUnsolvedId}`)} style={{ marginTop: 8, paddingLeft: 0 }}>
                К нерешённому заданию <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <Modal
          title="Сдать работу преподавателю?"
          onClose={() => setConfirmOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                Сдать работу
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
            <div>Решено заданий: {solvedCount} из {exercises.length}</div>
            <div>Пропущено: {skippedCount}</div>
            <div>Использовано подсказок: {hintsUsedCount}</div>
            <div>Приложено файлов: {filesCount}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
