/**
 * MOCK-СЕРВИСЫ (service layer).
 * Единственное место, которое знает, где лежит прогресс ученика.
 * Сейчас — localStorage. Позже здесь остаются те же сигнатуры, но внутри — fetch к API.
 *
 * TODO backend / АВТОРИЗАЦИЯ: getSession() → GET /me, login() → POST /auth/login.
 * TODO backend / ПРОГРЕСС:    saveAnswer(), openHint(), openSolution() → PATCH /homeworks/:id/attempts
 * TODO backend / ФАЙЛЫ:       addAttachment() → POST /files (multipart), сейчас хранится только метаинформация.
 * TODO backend / СДАЧА:       submitHomework() → POST /homeworks/:id/submit (уведомление преподавателю).
 * TODO backend / ПРОВЕРКА:    checkAnswer() выполняется на клиенте только в прототипе;
 *                              в бою правильный ответ не должен приходить на клиент.
 * TODO backend / АНАЛИТИКА:   track() → POST /analytics/events.
 */
import type { Attempt, Exercise, ExerciseStatus, Homework } from "../types";
import type { Store } from "../types/state";
import { ACCOUNTS } from "../data/roles";
import { readJSON, writeJSON, removeKey } from "./storage";

const KEY = "store";

export const EMPTY: Store = {
  auth: true, // прототип открывается сразу в авторизованном кабинете
  account: ACCOUNTS[0],
  registered: [],
  games: {},
  techniques: {},
  reviewCards: {},
  teacher: { reviewed: {}, assigned: [] },
  homework: {},
  tests: {},
  theory: {},
  results: [],
  settings: { instantCheck: true, reduceMotion: false, compactCards: false },
  readNotifications: [],
  lastPlace: null,
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Демонстрационное состояние при первом запуске: работа начата, тест по химии не завершён. */
function seed(): Store {
  const s = clone(EMPTY);
  s.homework["hw-02"] = {
    startedAt: "2026-08-08T18:20:00",
    submittedAt: null,
    attempts: {
      "hw02-a1": { value: "9", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
      "hw02-a2": { value: "56", status: "correct", attempts: 2, hintsOpened: 1, solutionOpened: false, draftText: "5k + 7k = 96", drawing: null, files: [] },
      "hw02-a3": { value: "o2", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
      "hw02-b1": { value: "4", status: "wrong", attempts: 1, hintsOpened: 1, solutionOpened: false, draftText: "", drawing: null, files: [] },
    },
  };
  s.homework["hw-01"] = {
    startedAt: "2026-07-21T17:00:00",
    submittedAt: "2026-07-27T21:10:00",
    reviewedAt: "2026-08-11T12:00:00",
    attempts: {
      "hw01-a1": { value: "8", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
      "hw01-a2": { value: "1", status: "wrong", attempts: 3, hintsOpened: 2, solutionOpened: true, draftText: "", drawing: null, files: [] },
      "hw01-a3": { value: "6", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
    },
  };
  s.homework["hw-04"] = {
    startedAt: "2026-08-05T19:00:00",
    submittedAt: "2026-08-09T20:30:00",
    attempts: {
      "hw04-a1": { value: "18", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
      "hw04-a2": { value: "o1", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
      "hw04-a3": { value: "уменьшается", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, files: [] },
    },
  };
  s.tests["ct-solut"] = { testId: "ct-solut", startedAt: "2026-08-12T19:40:00", answers: { q1: "15", q2: "o1" }, flagged: { q4: true }, current: 2, elapsed: 214, finishedAt: null, only: null };
  s.theory["th-prop"] = { progress: 60, favorite: true, read: false, lastBlock: 4, quiz: {} };
  s.theory["th-solut"] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
  s.lastPlace = { kind: "homework", id: "hw-02", exerciseId: "hw02-b1" };
  s.games = {
    "tr-equations": { best: 7, played: 3, lastScore: 5 },
    "tr-color": { best: 8, played: 1, lastScore: 8 },
  };
  s.techniques = { "tq-feynman": { practiced: 2, done: [0, 1] } };
  return s;
}

/**
 * Мягкая миграция уже сохранённого состояния: дополняем недостающие ключи демо-сидом
 * и вычищаем мусор отладочных прогонов (результаты без единого ответа).
 * TODO backend: на сервере эту роль играют миграции схемы и валидация при записи CtResult.
 */
function backfill<T>(target: Record<string, T> | undefined, base: Record<string, T>): Record<string, T> {
  const out = target || {};
  Object.keys(base).forEach((id) => {
    if (!out[id]) out[id] = base[id];
  });
  return out;
}

function migrate(s: Store): Store {
  const base = seed();
  s.games = backfill(s.games, base.games);
  s.techniques = backfill(s.techniques, base.techniques);
  s.reviewCards = backfill(s.reviewCards, base.reviewCards);
  if (!s.account || !s.account.role) s.account = base.account;
  if (!s.settings) s.settings = base.settings;
  s.results = (s.results || []).filter((r) => r && r.score > 0);
  Object.keys(s.tests || {}).forEach((id) => {
    const t = s.tests[id];
    if (t && t.finishedAt && !Object.keys(t.answers || {}).length) delete s.tests[id];
  });
  return s;
}

export const mockApi = {
  load(): Store {
    const raw = readJSON<Store | null>(KEY, null);
    if (raw) {
      const saved = Object.assign(clone(EMPTY), raw);
      return this.save(migrate(saved));
    }
    const s = seed();
    this.save(s);
    return s;
  },
  save(store: Store): Store {
    writeJSON(KEY, store);
    return store;
  },
  reset(): Store {
    removeKey(KEY);
    return this.load();
  },
  /** АНАЛИТИКА: сюда позже уходит событие на сервер. TODO backend: POST /analytics/events */
  track(event: string, payload?: Record<string, unknown>): void {
    if (typeof console !== "undefined" && console.debug) console.debug("[analytics]", event, payload || {});
  },
};

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

/** ПРОВЕРКА ОТВЕТА. TODO backend: на сервере — POST /exercises/:id/check. */
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

/** Доступность полного решения — правила задаёт преподаватель (Solution.policy). */
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
