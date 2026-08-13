import type { CtQuestion, CtSession, CtTest } from "../types";

export function checkCtAnswer(question: CtQuestion, value: string | string[] | undefined): boolean {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length) || value === "") return false;
  if (question.type === "multi") {
    const a = ([] as string[]).concat(question.answer as string[]).slice().sort().join(",");
    const b = ([] as string[]).concat(value as string[]).slice().sort().join(",");
    return a === b;
  }
  const norm = (s: unknown) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(",", ".");
  return norm(value) === norm(question.answer);
}

export interface SessionScore {
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalCount: number;
  answeredCount: number;
}

export function scoreSession(test: CtTest, session: CtSession): SessionScore {
  const questions = session.only ? test.questions.filter((q) => session.only!.includes(q.id)) : test.questions;
  let correct = 0;
  let answered = 0;
  questions.forEach((q) => {
    const v = session.answers[q.id];
    const has = v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
    if (has) answered += 1;
    if (has && checkCtAnswer(q, v)) correct += 1;
  });
  const total = questions.length;
  return {
    score: total ? Math.round((correct / total) * 100) : 0,
    correctCount: correct,
    wrongCount: answered - correct,
    skippedCount: total - answered,
    totalCount: total,
    answeredCount: answered,
  };
}
