import { HOMEWORKS, TOPIC_ACCURACY, TOPICS } from "../data/content";
import type { CtResult, Homework, HomeworkStatus } from "../types";
import type { Store } from "../types/state";
import { homeworkProgress, TODAY_ISO } from "./mockApi";

/** Recomputes the displayed status from live HomeworkState instead of the static seed status. */
export function liveStatus(hw: Homework, store: Store): HomeworkStatus {
  const st = store.homework[hw.id];
  if (hw.feedback || st?.reviewedAt) return "reviewed";
  if (st?.submittedAt) return "submitted";
  if (hw.dueAt < TODAY_ISO) return "overdue";
  if (st?.startedAt) return "in_progress";
  return "new";
}

export function allResults(store: Store): CtResult[] {
  return [...store.results].sort((a, b) => a.date.localeCompare(b.date));
}

export function avgScore(store: Store): number {
  const list = allResults(store);
  if (!list.length) return 0;
  return Math.round(list.reduce((s, r) => s + r.score, 0) / list.length);
}

export function lastResult(store: Store): CtResult | undefined {
  const list = allResults(store);
  return list[list.length - 1];
}

export function bestResult(store: Store): CtResult | undefined {
  const list = allResults(store);
  if (!list.length) return undefined;
  return list.reduce((a, b) => (b.score > a.score ? b : a));
}

export function topicName(topicId: string): string {
  return TOPICS.find((t) => t.id === topicId)?.name || topicId;
}

export function weakTopics(n = 3) {
  return TOPIC_ACCURACY.slice(0, n);
}

export function strongTopics(n = 2) {
  return [...TOPIC_ACCURACY].sort((a, b) => b.accuracy - a.accuracy).slice(0, n);
}

export function inProgressHomeworks(store: Store) {
  return HOMEWORKS.filter((hw) => {
    const st = store.homework[hw.id];
    if (!st || st.submittedAt) return false;
    const p = homeworkProgress(hw, st);
    return p.done > 0 && p.done < p.total;
  });
}

export function unfinishedTestSession(store: Store) {
  return Object.values(store.tests).find(
    (t) => !t.finishedAt && Object.keys(t.answers || {}).length > 0,
  );
}

export function latestFeedbackHomework() {
  const withFeedback = HOMEWORKS.filter((h) => h.feedback);
  if (!withFeedback.length) return undefined;
  return [...withFeedback].sort((a, b) => (b.feedback!.date > a.feedback!.date ? 1 : -1))[0];
}

export function remainingExercises(store: Store): number {
  let remaining = 0;
  HOMEWORKS.forEach((hw) => {
    const st = store.homework[hw.id];
    if (st?.submittedAt) return;
    const p = homeworkProgress(hw, st);
    remaining += p.total - p.done;
  });
  return remaining;
}

export function accuracyColor(pct: number): string {
  if (pct < 60) return "var(--color-bad)";
  if (pct < 80) return "var(--color-accent)";
  return "var(--color-ok)";
}
