import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { checkAnswer, homeworkProgress, solutionAvailability, scoreSession } from "../lib/scoring.js";
import { pstr, uploadName } from "../lib/params.js";

export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("student"));

const now = () => new Date().toISOString();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 15 * 1024 * 1024 } });

async function ensureHomeworkState(studentId: string, homeworkId: string) {
  const existing = (await db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, homeworkId))).limit(1))[0];
  if (existing) return existing;
  const row = { studentId, homeworkId, startedAt: now(), submittedAt: null, reviewedAt: null };
  (await db.insert(s.homeworkState).values(row));
  return row;
}

async function ensureAttempt(studentId: string, homeworkId: string, exerciseId: string) {
  await ensureHomeworkState(studentId, homeworkId);
  const existing = (await db
    .select()
    .from(s.homeworkAttempts)
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, homeworkId), eq(s.homeworkAttempts.exerciseId, exerciseId)))
    .limit(1))[0];
  if (existing) return existing;
  (await db.insert(s.homeworkAttempts)
    .values({ studentId, homeworkId, exerciseId, value: "", status: "not_started", attempts: 0, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() })
    );
  return (await db
    .select()
    .from(s.homeworkAttempts)
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, homeworkId), eq(s.homeworkAttempts.exerciseId, exerciseId)))
    .limit(1))[0]!;
}

async function findExercise(homeworkId: string, exerciseId: string) {
  const hw = (await db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).limit(1))[0];
  if (!hw) return null;
  const sections = hw.sections as any[];
  for (const sec of sections) {
    if (sec.kind !== "exercises") continue;
    const ex = sec.exercises.find((e: any) => e.id === exerciseId);
    if (ex) return ex;
  }
  return null;
}

async function allExerciseIds(homeworkId: string): Promise<string[]> {
  const hw = (await db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).limit(1))[0];
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

studentRouter.get("/state", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;

  const settingsRow = (await db.select().from(s.settings).where(eq(s.settings.userId, studentId)).limit(1))[0];

  const hwStates = (await db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)));
  const attempts = (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)));
  const homework: Record<string, any> = {};
  hwStates.forEach((h) => {
    homework[h.homeworkId] = { startedAt: h.startedAt, submittedAt: h.submittedAt, reviewedAt: h.reviewedAt, attempts: {} };
  });
  for (const a of attempts) {
    if (!homework[a.homeworkId]) homework[a.homeworkId] = { startedAt: null, submittedAt: null, attempts: {} };
    const files = (await db.select().from(s.attachments).where(and(eq(s.attachments.studentId, studentId), eq(s.attachments.homeworkId, a.homeworkId), eq(s.attachments.exerciseId, a.exerciseId))));
    homework[a.homeworkId].attempts[a.exerciseId] = {
      value: a.value, status: a.status, attempts: a.attempts, hintsOpened: a.hintsOpened, solutionOpened: a.solutionOpened, draftText: a.draftText, drawing: a.drawing,
      files: files.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type, kind: f.kind })),
    };
  }

  const feedbackRows = (await db.select().from(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)));
  const teacherFeedback: Record<string, any> = {};
  for (const f of feedbackRows) {
    teacherFeedback[f.homeworkId] = { id: f.id, teacher: (await db.select().from(s.users).where(eq(s.users.id, f.teacherId)).limit(1))[0]?.name ?? "", date: f.createdAt.slice(0, 10), grade: f.grade, text: f.text, flagged: f.flagged };
  }

  const sessions = (await db.select().from(s.ctSessions).where(eq(s.ctSessions.studentId, studentId)));
  const tests: Record<string, any> = {};
  sessions.forEach((t) => {
    tests[t.testId] = { testId: t.testId, startedAt: t.startedAt, answers: t.answers, flagged: t.flagged, current: t.current, elapsed: t.elapsed, finishedAt: t.finishedAt, only: t.only };
  });

  const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId)));

  const theoryRows = (await db.select().from(s.theoryProgress).where(eq(s.theoryProgress.studentId, studentId)));
  const theory: Record<string, any> = {};
  theoryRows.forEach((t) => {
    theory[t.materialId] = { progress: t.progress, favorite: t.favorite, read: t.read, lastBlock: t.lastBlock, quiz: t.quiz };
  });

  const techRows = (await db.select().from(s.techniqueProgress).where(eq(s.techniqueProgress.studentId, studentId)));
  const techniques: Record<string, any> = {};
  techRows.forEach((t) => {
    techniques[t.techniqueId] = { practiced: t.practiced, done: t.done, lastAt: t.lastAt };
  });

  const reviewRows = (await db.select().from(s.reviewCards).where(eq(s.reviewCards.studentId, studentId)));
  const reviewCards: Record<string, any> = {};
  reviewRows.forEach((r) => {
    reviewCards[r.cardId] = { box: r.box, due: r.due, archived: r.archived };
  });

  const gameRows = (await db.select().from(s.gameRecords).where(eq(s.gameRecords.studentId, studentId)));
  const games: Record<string, any> = {};
  gameRows.forEach((g) => {
    games[g.trainerId] = { best: g.best, played: g.played, lastScore: g.lastScore };
  });

  const notifs = (await db.select().from(s.notifications).where(eq(s.notifications.userId, studentId)));

  res.json({
    settings: settingsRow ?? { instantCheck: true, reduceMotion: false, compactCards: false },
    homework, teacherFeedback, tests, results, theory, techniques, reviewCards, games,
    notifications: notifs,
  });
});

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

studentRouter.post("/homework/:hwId/exercises/:exId/answer", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  await ensureAttempt(studentId, hwId, exId);
  (await db.update(s.homeworkAttempts)
    .set({ value: req.body?.value ?? "", updatedAt: now(), status: "saved" })
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId)))
    );
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/check", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = await findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = await ensureAttempt(studentId, hwId, exId);
  const value = req.body?.value ?? attempt.value;
  const status = checkAnswer(exercise, value);
  (await db.update(s.homeworkAttempts)
    .set({ value, status, attempts: attempt.attempts + 1, updatedAt: now() })
    .where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId)))
    );
  res.json({ status, attempts: attempt.attempts + 1 });
});

studentRouter.post("/homework/:hwId/exercises/:exId/hint", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = await findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = await ensureAttempt(studentId, hwId, exId);
  const next = Math.min((exercise.hints || []).length, attempt.hintsOpened + 1);
  (await db.update(s.homeworkAttempts).set({ hintsOpened: next, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))));
  res.json({ hintsOpened: next });
});

studentRouter.post("/homework/:hwId/exercises/:exId/solution", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  const exercise = await findExercise(hwId, exId);
  if (!exercise) return res.status(404).json({ error: "Задание не найдено" });
  const attempt = await ensureAttempt(studentId, hwId, exId);
  const hwState = (await db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, hwId))).limit(1))[0];
  const avail = solutionAvailability(exercise.solutionPolicy, attempt.attempts, Boolean(hwState?.submittedAt));
  if (!avail.available) return res.status(403).json({ error: avail.note });
  (await db.update(s.homeworkAttempts).set({ solutionOpened: true, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))));
  res.json({ solution: exercise.solution });
});

studentRouter.post("/homework/:hwId/exercises/:exId/draft", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  await ensureAttempt(studentId, hwId, exId);
  (await db.update(s.homeworkAttempts).set({ draftText: req.body?.text ?? "", updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))));
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/drawing", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  await ensureAttempt(studentId, hwId, exId);
  (await db.update(s.homeworkAttempts).set({ drawing: req.body?.dataUrl ?? null, updatedAt: now() }).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId), eq(s.homeworkAttempts.exerciseId, exId))));
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/exercises/:exId/attachments", upload.array("files", 6), async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  const exId = pstr(req.params.exId);
  await ensureAttempt(studentId, hwId, exId);
  const files = (req.files as Express.Multer.File[]) || [];
  const created = await Promise.all(files.map(async (f) => {
    const row = {
      id: randomUUID(), studentId, homeworkId: hwId, exerciseId: exId,
      name: uploadName(f.originalname), size: f.size, type: f.mimetype,
      kind: /pdf/.test(f.mimetype) ? ("PDF" as const) : ("ФОТО" as const),
      filePath: f.path, createdAt: now(),
    };
    (await db.insert(s.attachments).values(row));
    return { id: row.id, name: row.name, size: row.size, type: row.type, kind: row.kind };
  }));
  res.json({ files: created });
});

studentRouter.delete("/homework/:hwId/exercises/:exId/attachments/:fileId", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  (await db.delete(s.attachments).where(and(eq(s.attachments.id, pstr(req.params.fileId)), eq(s.attachments.studentId, studentId))));
  res.json({ ok: true });
});

studentRouter.post("/homework/:hwId/submit", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const hwId = pstr(req.params.hwId);
  await ensureHomeworkState(studentId, hwId);
  (await db.update(s.homeworkState).set({ submittedAt: now() }).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, hwId))));

  const statuses: Record<string, any> = {};
  (await db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, studentId), eq(s.homeworkAttempts.homeworkId, hwId)))).forEach((a) => {
    statuses[a.exerciseId] = a.status;
  });
  const progress = homeworkProgress(await allExerciseIds(hwId), statuses);
  res.json({ ok: true, progress });
});

// ---------------------------------------------------------------------------
// CT tests
// ---------------------------------------------------------------------------

studentRouter.post("/tests/:testId/start", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const only = req.body?.only ?? null;
  (await db.insert(s.ctSessions)
    .values({ studentId, testId, startedAt: now(), answers: {}, flagged: {}, current: 0, elapsed: 0, finishedAt: null, only })
    .onConflictDoUpdate({ target: [s.ctSessions.studentId, s.ctSessions.testId], set: { startedAt: now(), answers: {}, flagged: {}, current: 0, elapsed: 0, finishedAt: null, only } })
    );
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/answer", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = (await db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).limit(1))[0];
  if (!session) return res.status(404).json({ error: "Сессия теста не найдена" });
  const answers = { ...(session.answers as Record<string, unknown>), [req.body.questionId]: req.body.value };
  (await db.update(s.ctSessions).set({ answers }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))));
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/flag", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = (await db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).limit(1))[0];
  if (!session) return res.status(404).json({ error: "Сессия теста не найдена" });
  const flagged = { ...(session.flagged as Record<string, boolean>) };
  flagged[req.body.questionId] = !flagged[req.body.questionId];
  (await db.update(s.ctSessions).set({ flagged }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))));
  res.json({ flagged });
});

studentRouter.post("/tests/:testId/current", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  (await db.update(s.ctSessions).set({ current: req.body.index }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))));
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/tick", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  (await db.update(s.ctSessions).set({ elapsed: req.body.elapsed }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))));
  res.json({ ok: true });
});

studentRouter.post("/tests/:testId/finish", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const testId = pstr(req.params.testId);
  const session = (await db.select().from(s.ctSessions).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))).limit(1))[0];
  const test = (await db.select().from(s.ctTests).where(eq(s.ctTests.id, testId)).limit(1))[0];
  if (!session || !test) return res.status(404).json({ error: "Тест не найден" });

  (await db.update(s.ctSessions).set({ finishedAt: now() }).where(and(eq(s.ctSessions.studentId, studentId), eq(s.ctSessions.testId, testId))));

  const answers = session.answers as Record<string, unknown>;
  const hasAnswers = Object.values(answers).some((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!hasAnswers) return res.json({ counted: false });

  const result = scoreSession(test.questions as any[], answers, session.only as string[] | null);
  const row = {
    id: randomUUID(), studentId, testId, title: test.title, subjectId: test.subjectId,
    date: now().slice(0, 10), score: result.score, minutes: Math.round(session.elapsed / 60), topicAccuracy: result.topicAccuracy,
  };
  (await db.insert(s.ctResults).values(row));
  res.json({ counted: true, score: result.score, result });
});

// ---------------------------------------------------------------------------
// Theory
// ---------------------------------------------------------------------------

async function ensureTheoryProgress(studentId: string, materialId: string) {
  const existing = (await db.select().from(s.theoryProgress).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))).limit(1))[0];
  if (existing) return existing;
  const row = { studentId, materialId, progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
  (await db.insert(s.theoryProgress).values(row));
  return row;
}

studentRouter.post("/theory/:materialId/favorite", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = await ensureTheoryProgress(studentId, materialId);
  (await db.update(s.theoryProgress).set({ favorite: !row.favorite }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))));
  res.json({ favorite: !row.favorite });
});

studentRouter.post("/theory/:materialId/studied", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = await ensureTheoryProgress(studentId, materialId);
  const read = !row.read;
  (await db.update(s.theoryProgress).set({ read, progress: read ? 100 : 60 }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))));
  res.json({ read, progress: read ? 100 : 60 });
});

studentRouter.post("/theory/:materialId/quiz", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const materialId = pstr(req.params.materialId);
  const row = await ensureTheoryProgress(studentId, materialId);
  const quiz = { ...(row.quiz as Record<string, unknown>), [req.body.questionId]: { value: req.body.value, status: req.body.status } };
  (await db.update(s.theoryProgress).set({ quiz }).where(and(eq(s.theoryProgress.studentId, studentId), eq(s.theoryProgress.materialId, materialId))));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Techniques / spaced repetition / games / settings / notifications
// ---------------------------------------------------------------------------

studentRouter.post("/techniques/:techniqueId/step", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const techniqueId = pstr(req.params.techniqueId);
  const existing = (await db.select().from(s.techniqueProgress).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).limit(1))[0];
  const done = new Set((existing?.done as number[]) || []);
  if (done.has(req.body.stepIndex)) done.delete(req.body.stepIndex);
  else done.add(req.body.stepIndex);
  const doneArr = Array.from(done);
  if (existing) (await db.update(s.techniqueProgress).set({ done: doneArr }).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))));
  else (await db.insert(s.techniqueProgress).values({ studentId, techniqueId, practiced: 0, done: doneArr }));
  res.json({ done: doneArr });
});

studentRouter.post("/techniques/:techniqueId/practice", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const techniqueId = pstr(req.params.techniqueId);
  const existing = (await db.select().from(s.techniqueProgress).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))).limit(1))[0];
  const practiced = (existing?.practiced ?? 0) + 1;
  if (existing) (await db.update(s.techniqueProgress).set({ practiced, lastAt: now() }).where(and(eq(s.techniqueProgress.studentId, studentId), eq(s.techniqueProgress.techniqueId, techniqueId))));
  else (await db.insert(s.techniqueProgress).values({ studentId, techniqueId, practiced, done: [], lastAt: now() }));
  res.json({ practiced });
});

studentRouter.post("/review-cards/:cardId/advance", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const cardId = pstr(req.params.cardId);
  const maxStage = req.body.maxStage ?? 5;
  const remembered = Boolean(req.body.remembered);
  const existing = (await db.select().from(s.reviewCards).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.cardId, cardId))).limit(1))[0];
  const box = existing ? existing.box : 1;
  const nextBox = remembered ? Math.min(maxStage, box + 1) : 1;
  const due = now().slice(0, 10);
  if (existing) (await db.update(s.reviewCards).set({ box: nextBox, due }).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.cardId, cardId))));
  else (await db.insert(s.reviewCards).values({ studentId, cardId, box: nextBox, due }));
  res.json({ box: nextBox, due });
});

studentRouter.post("/games/:trainerId/record", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const trainerId = pstr(req.params.trainerId);
  const score = Number(req.body.score) || 0;
  const existing = (await db.select().from(s.gameRecords).where(and(eq(s.gameRecords.studentId, studentId), eq(s.gameRecords.trainerId, trainerId))).limit(1))[0];
  const best = Math.max(existing?.best ?? 0, score);
  const played = (existing?.played ?? 0) + 1;
  if (existing) (await db.update(s.gameRecords).set({ best, played, lastScore: score }).where(and(eq(s.gameRecords.studentId, studentId), eq(s.gameRecords.trainerId, trainerId))));
  else (await db.insert(s.gameRecords).values({ studentId, trainerId, best, played, lastScore: score }));
  res.json({ best, played, lastScore: score });
});

studentRouter.post("/join-group", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const { groupId } = req.body || {};
  if (!groupId) return res.status(400).json({ error: "Не указана группа" });
  const group = (await db.select().from(s.groups).where(eq(s.groups.id, groupId)).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });

  const already = (await db.select().from(s.groupMemberships).where(and(eq(s.groupMemberships.groupId, groupId), eq(s.groupMemberships.studentUserId, studentId), isNull(s.groupMemberships.leftAt))).limit(1))[0];
  if (!already) (await db.insert(s.groupMemberships).values({ id: randomUUID(), groupId, studentUserId: studentId, joinedAt: new Date().toISOString().slice(0, 10), leftAt: null }));
  (await db.update(s.students).set({ teacherId: group.teacherId }).where(and(eq(s.students.userId, studentId), isNull(s.students.teacherId))));
  res.json({ ok: true, groupName: group.name });
});

studentRouter.post("/settings", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const patch = req.body || {};
  (await db.insert(s.settings)
    .values({ userId: studentId, instantCheck: patch.instantCheck ?? true, reduceMotion: patch.reduceMotion ?? false, compactCards: patch.compactCards ?? false })
    .onConflictDoUpdate({ target: s.settings.userId, set: patch })
    );
  res.json({ ok: true });
});

studentRouter.post("/notifications/read", async (req: AuthedRequest, res) => {
  const studentId = req.auth!.sub;
  const ids: string[] = req.body?.ids || [];
  for (const id of ids) {
    (await db.update(s.notifications).set({ read: true }).where(and(eq(s.notifications.id, id), eq(s.notifications.userId, studentId))));
  }
  res.json({ ok: true });
});
