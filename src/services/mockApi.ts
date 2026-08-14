/**
 * Pure, stateless helpers shared across pages: formatting, and the same
 * checkAnswer/solutionAvailability/homeworkProgress rules the server uses
 * (kept here too so the UI can update optimistically before the API call
 * that actually persists the result comes back — see services/actions.ts).
 */
import type { Attempt, Exercise, ExerciseStatus, Homework } from "../types";

export const emptyAttempt = (): Attempt => ({
  value: "",
  status: "not_started",
  attempts: 0,
  hintsOpened: 0,
  solutionOpened: false,
  draftText: "",
  drawing: null,
  files: [],
  draftOpen: false,
});

export function checkAnswer(exercise: Exercise, value: string | number | string[]): ExerciseStatus {
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
  const norm = (s: unknown) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(",", ".");
  return norm(value) === norm(exercise.answer) ? "correct" : "wrong";
}

export function allExercises(homework: Homework): Exercise[] {
  const out: Exercise[] = [];
  (homework.sections || []).forEach((sc) => {
    if (sc.kind === "exercises") sc.exercises.forEach((ex) => out.push(ex));
  });
  return out;
}

export interface SolutionAvailability {
  available: boolean;
  note: string;
}

export function solutionAvailability(exercise: Exercise, attempt: Attempt, submitted: boolean): SolutionAvailability {
  const p = exercise.solutionPolicy || { mode: "after_submit" as const };
  if (p.mode === "immediate") return { available: true, note: "Решение открыто преподавателем сразу" };
  if (p.mode === "after_attempts") {
    const need = p.attempts || 2;
    const left = Math.max(0, need - (attempt.attempts || 0));
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

export interface HomeworkProgress {
  done: number;
  total: number;
  percent: number;
}

export function homeworkProgress(homework: Homework, hwState: { attempts?: Record<string, Attempt> } | undefined): HomeworkProgress {
  const list = allExercises(homework);
  const attempts = (hwState && hwState.attempts) || {};
  let done = 0;
  list.forEach((ex) => {
    const st = attempts[ex.id] && attempts[ex.id].status;
    if (st === "correct" || st === "manual") done += 1;
  });
  const total = list.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const p = (n: number) => String(n).padStart(2, "0");
  return p(Math.floor(s / 3600)) + ":" + p(Math.floor((s % 3600) / 60)) + ":" + p(s % 60);
}

export const TODAY_ISO = "2026-08-13";

export function daysLeft(iso: string, todayIso?: string): number {
  const a = new Date(iso).getTime();
  const b = new Date(todayIso || TODAY_ISO).getTime();
  return Math.round((a - b) / 86400000);
}
