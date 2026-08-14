// Server-side authoritative versions of the scoring logic that used to live
// (client-trusted) in the frontend's mockApi.ts. Same rules, now the only
// place that actually decides correctness.

export type ExerciseType = "number" | "text" | "single" | "multi" | "manual";
export type ExerciseStatus = "not_started" | "saved" | "correct" | "wrong" | "manual";

export interface ExerciseLike {
  type: ExerciseType;
  answer: number | string | string[] | null;
}

export function checkAnswer(exercise: ExerciseLike, value: unknown): ExerciseStatus {
  if (exercise.type === "manual") return "manual";
  if (value === "" || value == null || (Array.isArray(value) && !value.length)) return "not_started";
  if (exercise.type === "multi") {
    const a = ([] as string[]).concat(exercise.answer as string[]).slice().sort().join(",");
    const b = ([] as string[]).concat(value as string[]).slice().sort().join(",");
    return a === b ? "correct" : "wrong";
  }
  if (exercise.type === "number") {
    const n = parseFloat(String(value).replace(",", ".").replace(/\s|−/g, (m) => (m === "−" ? "-" : "")));
    return Math.abs(n - Number(exercise.answer)) < 1e-6 ? "correct" : "wrong";
  }
  const norm = (v: unknown) => String(v).trim().toLowerCase().replace(/\s+/g, " ").replace(",", ".");
  return norm(value) === norm(exercise.answer) ? "correct" : "wrong";
}

export interface SolutionPolicyLike {
  mode: "immediate" | "after_attempts" | "after_submit" | "teacher_approval";
  attempts?: number;
}

export function solutionAvailability(
  policy: SolutionPolicyLike | undefined,
  attemptCount: number,
  submitted: boolean,
): { available: boolean; note: string } {
  const p = policy || { mode: "after_submit" as const };
  if (p.mode === "immediate") return { available: true, note: "Решение открыто преподавателем сразу" };
  if (p.mode === "after_attempts") {
    const need = p.attempts || 2;
    const left = Math.max(0, need - attemptCount);
    return left === 0
      ? { available: true, note: "Решение открылось после попыток" }
      : { available: false, note: "Решение откроется после " + need + " попыток — осталось " + left };
  }
  if (p.mode === "after_submit") {
    return submitted
      ? { available: true, note: "Работа сдана — решение доступно" }
      : { available: false, note: "Решение откроется после сдачи работы" };
  }
  return { available: false, note: "Решение открывает преподаватель по запросу" };
}

export interface CtQuestionLike {
  id: string;
  type: "single" | "multi" | "short";
  answer: string | string[];
  topicId: string;
}

export function checkCtAnswer(question: CtQuestionLike, value: unknown): boolean {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return false;
  if (question.type === "multi") {
    const a = ([] as string[]).concat(question.answer as string[]).slice().sort().join(",");
    const b = ([] as string[]).concat(value as string[]).slice().sort().join(",");
    return a === b;
  }
  const norm = (v: unknown) => String(v).trim().toLowerCase().replace(/\s+/g, " ").replace(",", ".");
  return norm(value) === norm(question.answer);
}

export function scoreSession(
  questions: CtQuestionLike[],
  answers: Record<string, unknown>,
  only: string[] | null,
): { score: number; correctCount: number; wrongCount: number; skippedCount: number; totalCount: number; topicAccuracy: Record<string, number> } {
  const qs = only ? questions.filter((q) => only.includes(q.id)) : questions;
  let correct = 0;
  let answered = 0;
  const byTopic = new Map<string, { correct: number; total: number }>();
  qs.forEach((q) => {
    const v = answers[q.id];
    const has = v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
    const entry = byTopic.get(q.topicId) || { correct: 0, total: 0 };
    entry.total += 1;
    if (has) {
      answered += 1;
      if (checkCtAnswer(q, v)) {
        correct += 1;
        entry.correct += 1;
      }
    }
    byTopic.set(q.topicId, entry);
  });
  const total = qs.length;
  const topicAccuracy: Record<string, number> = {};
  byTopic.forEach((v, k) => {
    topicAccuracy[k] = v.total ? Math.round((v.correct / v.total) * 100) : 0;
  });
  return {
    score: total ? Math.round((correct / total) * 100) : 0,
    correctCount: correct,
    wrongCount: answered - correct,
    skippedCount: total - answered,
    totalCount: total,
    topicAccuracy,
  };
}

export function homeworkProgress(exerciseIds: string[], statuses: Record<string, ExerciseStatus>) {
  let done = 0;
  exerciseIds.forEach((id) => {
    const st = statuses[id];
    if (st === "correct" || st === "manual") done += 1;
  });
  const total = exerciseIds.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
