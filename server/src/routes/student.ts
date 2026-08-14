import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { checkAnswer, homeworkProgress, solutionAvailability, scoreSession } from "../lib/scoring.js";
import { pstr } from "../lib/params.js";

export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("student"));

const now = () => new Date().toISOString();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 15 * 1024 * 1024 } });

function ensureHomeworkState(studentId: string, homeworkId: string) {
  const existing = db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, homeworkId))).get();
  if (existing) return existing;
  const row = { studentId, homeworkId, startedAt: now(), submittedAt: null, reviewedAt: null };
  db.insert(s.homeworkState).values(row).run();
  return row;
}

function ensureAttempt(studentId: string, homeworkId: string, exerciseId: string) {
  ensureHomeworkState(studentId, homeworkId);
  const existing = db
    .select()
    .from(s.homeworkAttempts)
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, homeworkId), eq(s.homeworkAttempts.exerciseId, exerciseId)))
    .get();
  if (existing) return existing;
  db.insert(s.homeworkAttempts)
    .values({ studentId, homeworkId, exerciseId, value: "", status: "not_started", attempts: 0, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() })
    .run();
  return db
    .select()
    .from(s.homeworkAttempts)
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, homeworkId), eq(s.homeworkAttempts.exerciseId, exerciseId)))
    .get()!;
}

function findExercise(homeworkId: string, exerciseId: string) {
  const hw = db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).get();
  if (!hw) return null;
  const sections = hw.sections as any[];
  for (const sec of sections) {
    if (sec.kind !== "exercises") continue;
    const ex = sec.exercises.find((e: any) => e.id === exerciseId);
    if (ex) return ex;
  }
  return null;
}

function allExerciseIds(homeworkId: string): string[] {
  const hw = db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).get();
  if (!hw) return [];
  const ids: string[] = [];
  (hw.sections as any[]).forEach((sec) => {
    if (sec.kind === "exercises") sec.exercises.forEach((e: any) => ids.push(e.id));
  });
  return ids;
}

// ---------------------------------------------------------------------------
// Aggregate state — one call to reconstruct (almost) the whole client Store.
// ---------------------------------------------------------------------------

studentRouter.get("/state", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;

  const settingsRow = db.select().from(s.settings).where(eq(s.settings.userId, studentId)).get();

  const hwStates = db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)).all();
  const attempts = db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)).all();
  const homework: Record<string, any> = {};
  hwStates.forEach((h) => {
    homework[h.homeworkId] = { startedAt: h.startedAt, submittedAt: h.submittedAt, reviewedAt: h.reviewedAt, attempts: {} };
  });
  attempts.forEach((a) => {
    if (!homework[a.homeworkId]) homework[a.homeworkId] = { startedAt: null, submittedAt: null, attempts: {} };
    const files = db.select().from(s.attachments).where(and(eq(s.attachments.studentId, studentId), eq(s.attachments.homeworkId, a.homeworkId), eq(s.attachments.exerciseId, a.exerciseId))).all();
    homework[a.homeworkId].attempts[a.exerciseId] = {
      value: a.value, status: a.status, attempts: a.attempts, hintsOpened: a.hintsOpened, solutionOpened: a.solutionOpened, draftText: a.draftText, drawing: a.drawing,
      files: files.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type, kind: f.kind })),
    };
  });

  const feedbackRows = db.select().from(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)).all();
  const teacherFeedback: Record<string, any> = {};
  feedbackRows.forEach((f) => {
    teacherFeedback[f.homeworkId] = { id: f.id, teacher: db.select().from(s.users).where(eq(s.users.id, f.teacherId)).get()?.name ?? "", date: f.createdAt.slice(0, 10), grade: f.grade, text: f.text, flagged: f.flagged };
  });

  const sessions = db.select().from(s.ctSessions).where(eq(s.ctSessions.studentId, studentId)).all();
  const tests: Record<string, any> = {};
  sessions.forEach((t) => {
    tests[t.testId] = { testId: t.testId, startedAt: t.startedAt, answers: t.answers, flagged: t.flagged, current: t.current, elapsed: t.elapsed, finishedAt: t.finishedAt, only: t.only };
  });

  const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId)).all();

  const theoryRows = db.select().from(s.theoryProgress).where(eq(s.theoryProgress.studentId, studentId)).all();
  const theory: Record<string, any> = {};
  theoryRows.forEach((t) => {
    theory[t.materialId] = { progress: t.progress, favorite: t.favorite, read: t.read, lastBlock: t.lastBlock, quiz: t.quiz };
  });

  const techRows = db.select().from(s.techniqueProgress).where(eq(s.techniqueProgress.studentId, studentId)).all();
  const techniques: Record<string, any> = {};
  techRows.forEach((t) => {
    techniques[t.techniqueId] = { practiced: t.practiced, done: t.done, lastAt: t.lastAt };
  });

  const reviewRows = db.select().from(s.reviewCards).where(eq(s.reviewCards.studentId, studentId)).all();
  const reviewCards: Record<string, any> = {};
  reviewRows.forEach((r) => {
    reviewCards[r.cardId] = { box: r.box, due: r.due, archived: r.archived };
  });

  const gameRows = db.select().from(s.gameRecords).where(eq(s.gameRecords.studentId, studentId)).all();
  const games: Record<string, any> = {};
  gameRows.forEach((g) => {
    games[g.trainerId] = { best: g.best, played: g.played, lastScore: g.lastScore };
  });

  const notifs = db.select().from(s.notifications).where(eq(s.notifications.userId, studentId)).all();

  res.json({
    settings: settingsRow ?? { instantCheck: true, reduceMotion: false, compactCards: false },
    homework, teacherFeedback, tests, results, theory, techniques, reviewCards, games,
    notifications: notifs,
  });
});

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

studentRouter.post("/homework/:hwId/exercises/:exId/answer", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  ensureAttempt(studentId, hwId, exId);
  db.update(s.homeworkAttempts)
    .set({ value: req.body?.value ?? "", updatedAt: now(), status: "saved" })
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId)))
    .run();
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/check", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = ensureAttempt(studentId, hwId, exId);
  const value = req.body?.value ?? attempt.value;
  const status = checkAnswer(exercise, value);
  db.update(s.homeworkAttempts)
    .set({ value, status, attempts: attempt.attempts + 1, updatedAt: now() })
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId)))
    .run();
  res.json({ status, attempts: attempt.attempts + 1 });
});

studentRouter.post("/homework/:hwId/exercises/:exId/hint", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = ensureAttempt(studentId, hwId, exId);
  const next = Math.min((exercise.hints || []).length, attempt.hintsOpened + 1);
  db.update(s.homeworkAttempts).set({ hintsOpened: next, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))).run();
  res.json({ hintsOpened: next });
});

studentRouter.post("/homework/:hwId/exercises/:exId/solution", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = ensureAttempt(studentId, hwId, exId);
  const hwState = db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, hwId))).get();
  const avail = solutionAvailability(exercise.solutionPolicy, attempt.attempts, Boolean(hwState?.submittedAt));
  if (!avail.available) return res.status(403).json({ error: avail.note });
  db.update(s.homeworkAttempts).set({ solutionOpened: true, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))).run();
  res.json({ solution: exercise.solution });
});

studentRouter.post("/homework/:hwId/exercises/:exId/draft", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  ensureAttempt(studentId, hwId, exId);
  db.update(s.homeworkAttempts).set({ draftText: req.body?.text ?? "", updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))).run();
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/drawing", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  ensureAttempt(studentId, hwId, exId);
  db.update(s.homeworkAttempts).set({ drawing: req.body?.dataUrl ?? null, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))).run();
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/attachments", upload.array("files", 6), (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  ensureAttempt(studentId, hwId, exId);
  const files = (req.files as Express.Multer.File[]) || [];
  const created = files.map((f) => {
    const row = {
      id: randomUUID(), studentId, homeworkId: hwId, exerciseId: exId,
      name: f.originalname, size: f.size, type: f.mimetype,
      kind: /pdf/.test(f.mimetype) ? ("PDF" as const) : ("ФОТО" as const),
      filePath: f.path, createdAt: now(),
    };
    db.insert(s.attachments).values(row).run();
    return { id: row.id, name: row.name, size: row.size, type: row.type, kind: row.kind };
  });
  res.json({ files: created });
});

studentRouter.delete("/homework/:hwId/exercises/:exId/attachments/:fileId", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  db.delete(s.attachments).where(and(eq(s.attachments.id, pstr(req.params.fileId)), eq(s.attachments.studentId, studentId))).run();
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/submit", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  ensureHomeworkState(studentId, hwId);
  db.update(s.homeworkState).set({ submittedAt: now() }).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, hwId))).run();

  const statuses: Record<string, any> = {};
  db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId))).all().forEach((a) => {
    statuses[a.exerciseId] = a.status;
  });
  const progress = homeworkProgress(allExerciseIds(hwId), statuses);
  res.json({ ok: true, progress });
});

// ---------------------------------------------------------------------------
// CT tests
// ---------------------------------------------------------------------------

studentRouter.post("/tests/:testId/start", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const only = req.body?.only ?? null;
  db.insert(s.ctSessions)
    .values({ studentId, testId, startedAt: now(), answers: {}, flagged: {}, current: 0, elapsed: 0, finishedAt: null, only })
    .onConflictDoUpdate({ target: [s.ctSessions.studentId, s.ctSessions.testId], set: { startedAt: now(), answers: {}, flagged: {}, current: 0, elapsed: 0, finishedAt: null, only } })
    .run();
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/answer", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).get();
  if (!session) return res.status(404).json({ error: "Сессия теста не найдена" });
  const answers = { ...(session.answers as Record<string, unknown>), [req.body.questionId]: req.body.value };
  db.update(s.ctSessions).set({ answers }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).run();
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/flag", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).get();
  if (!session) return res.status(404).json({ error: "Сессия теста не найдена" });
  const flagged = { ...(session.flagged as Record<string, boolean>) };
  flagged[req.body.questionId] = !flagged[req.body.questionId];
  db.update(s.ctSessions).set({ flagged }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).run();
  res.json({ flagged });
});

studentRouter.post("/tests/:testId/current", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  db.update(s.ctSessions).set({ current: req.body.index }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).run();
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/tick", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  db.update(s.ctSessions).set({ elapsed: req.body.elapsed }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).run();
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/finish", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).get();
  const test = db.select().from(s.ctTests).where(eq(s.ctTests.id, testId)).get();
  if (!session || !test) return res.status(404).json({ error: "Тест не найден" });

  db.update(s.ctSessions).set({ finishedAt: now() }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).run();

  const answers = session.answers as Record<string, unknown>;
  const hasAnswers = Object.values(answers).some((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!hasAnswers) return res.json({ counted: false });

  const result = scoreSession(test.questions as any[], answers, session.only as string[] | null);
  const row = {
    id: randomUUID(), studentId, testId, title: test.title, subjectId: test.subjectId,
    date: now().slice(0, 10), score: result.score, minutes: Math.round(session.elapsed / 60), topicAccuracy: result.topicAccuracy,
  };
  db.insert(s.ctResults).values(row).run();
  res.json({ counted: true, score: result.score, result });
});

// ---------------------------------------------------------------------------
// Theory
// ---------------------------------------------------------------------------

function ensureTheoryProgress(studentId: string, materialId: string) {
  const existing = db.select().from(s.theoryProgress).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))).get();
  if (existing) return existing;
  const row = { studentId, materialId, progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
  db.insert(s.theoryProgress).values(row).run();
  return row;
}

studentRouter.post("/theory/:materialId/favorite", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = ensureTheoryProgress(studentId, materialId);
  db.update(s.theoryProgress).set({ favorite: !row.favorite }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))).run();
  res.json({ favorite: !row.favorite });
});

studentRouter.post("/theory/:materialId/studied", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = ensureTheoryProgress(studentId, materialId);
  const read = !row.read;
  db.update(s.theoryProgress).set({ read, progress: read ? 100 : 60 }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))).run();
  res.json({ read, progress: read ? 100 : 60 });
});

studentRouter.post("/theory/:materialId/quiz", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = ensureTheoryProgress(studentId, materialId);
  const quiz = { ...(row.quiz as Record<string, unknown>), [req.body.questionId]: { value: req.body.value, status: req.body.status } };
  db.update(s.theoryProgress).set({ quiz }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))).run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Techniques / spaced repetition / games / settings / notifications
// ---------------------------------------------------------------------------

studentRouter.post("/techniques/:techniqueId/step", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const techniqueId = pstr(req.params.techniqueId);
  const existing = db.select().from(s.techniqueProgress).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).get();
  const done = new Set((existing?.done as number[]) || []);
  if (done.has(req.body.stepIndex)) done.delete(req.body.stepIndex);
  else done.add(req.body.stepIndex);
  const doneArr = Array.from(done);
  if (existing) db.update(s.techniqueProgress).set({ done: doneArr }).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).run();
  else db.insert(s.techniqueProgress).values({ studentId, techniqueId, practiced: 0, done: doneArr }).run();
  res.json({ done: doneArr });
});

studentRouter.post("/techniques/:techniqueId/practice", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const techniqueId = pstr(req.params.techniqueId);
  const existing = db.select().from(s.techniqueProgress).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).get();
  const practiced = (existing?.practiced ?? 0) + 1;
  if (existing) db.update(s.techniqueProgress).set({ practiced, lastAt: now() }).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).run();
  else db.insert(s.techniqueProgress).values({ studentId, techniqueId, practiced, done: [], lastAt: now() }).run();
  res.json({ practiced });
});

studentRouter.post("/review-cards/:cardId/advance", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const cardId = pstr(req.params.cardId);
  const maxStage = req.body.maxStage ?? 5;
  const remembered = Boolean(req.body.remembered);
  const existing = db.select().from(s.reviewCards).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.cardId, cardId))).get();
  const box = existing ? existing.box : 1;
  const nextBox = remembered ? Math.min(maxStage, box + 1) : 1;
  const due = now().slice(0, 10);
  if (existing) db.update(s.reviewCards).set({ box: nextBox, due }).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.cardId, cardId))).run();
  else db.insert(s.reviewCards).values({ studentId, cardId, box: nextBox, due }).run();
  res.json({ box: nextBox, due });
});

studentRouter.post("/games/:trainerId/record", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const trainerId = pstr(req.params.trainerId);
  const score = Number(req.body.score) || 0;
  const existing = db.select().from(s.gameRecords).where(and(eq(s.gameRecords.studentId, studentId), eq(s.gameRecords.trainerId, trainerId))).get();
  const best = Math.max(existing?.best ?? 0, score);
  const played = (existing?.played ?? 0) + 1;
  if (existing) db.update(s.gameRecords).set({ best, played, lastScore: score }).where(and(eq(s.gameRecords.studentId, studentId), eq(s.gameRecords.trainerId, trainerId))).run();
  else db.insert(s.gameRecords).values({ studentId, trainerId, best, played, lastScore: score }).run();
  res.json({ best, played, lastScore: score });
});

studentRouter.post("/settings", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const patch = req.body || {};
  db.insert(s.settings)
    .values({ userId: studentId, instantCheck: patch.instantCheck ?? true, reduceMotion: patch.reduceMotion ?? false, compactCards: patch.compactCards ?? false })
    .onConflictDoUpdate({ target: s.settings.userId, set: patch })
    .run();
  res.json({ ok: true });
});

studentRouter.post("/notifications/read", (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const ids: string[] = req.body?.ids || [];
  ids.forEach((id) => {
    db.update(s.notifications).set({ read: true }).where(and(eq(s.notifications.id, id), eq(s.notifications.userId, studentId))).run();
  });
  res.json({ ok: true });
});
