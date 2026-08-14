import { Router } from "express";
import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { homeworkProgress, type ExerciseStatus } from "../lib/scoring.js";
import { pstr } from "../lib/params.js";

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole("teacher"));

function teacherStudentIds(teacherId: string): string[] {
  const groupIds = db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.teacherId, teacherId)).all().map((g) => g.id);
  if (!groupIds.length) return [];
  const members = db.select().from(s.groupMembers).where(inArray(s.groupMembers.groupId, groupIds)).all();
  return Array.from(new Set(members.map((m) => m.studentUserId)));
}

teacherRouter.get("/groups", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groups = db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)).all();
  const withMembers = groups.map((g) => ({
    ...g,
    studentIds: db.select().from(s.groupMembers).where(eq(s.groupMembers.groupId, g.id)).all().map((m) => m.studentUserId),
  }));
  res.json(withMembers);
});

teacherRouter.post("/groups", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, subjectId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите название группы" });
  if (!subjectId) return res.status(400).json({ error: "Укажите предмет" });
  const id = randomUUID();
  db.insert(s.groups).values({ id, name: String(name).trim(), teacherId, subjectId }).run();
  res.json({ id, name: String(name).trim(), teacherId, subjectId, studentIds: [] });
});

teacherRouter.post("/groups/:groupId/members", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const { email } = req.body || {};
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  if (!email) return res.status(400).json({ error: "Укажите email ученика" });

  const student = db.select().from(s.users).where(eq(s.users.email, String(email).trim())).get();
  if (!student || student.role !== "student") return res.status(404).json({ error: "Ученик с таким email не найден" });

  const already = db.select().from(s.groupMembers).where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.studentUserId, student.id))).get();
  if (already) return res.status(409).json({ error: "Ученик уже в этой группе" });

  db.insert(s.groupMembers).values({ groupId, studentUserId: student.id }).run();
  res.json({ ok: true, studentId: student.id, name: `${student.name} ${student.lastName}`.trim() });
});

teacherRouter.post("/students", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, lastName, email, groupId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя ученика" });
  if (!email || !String(email).includes("@")) return res.status(400).json({ error: "Введите корректный email" });

  const existing = db.select().from(s.users).where(eq(s.users.email, String(email).trim())).get();
  if (existing) return res.status(409).json({ error: "Такой email уже зарегистрирован" });

  let group: typeof s.groups.$inferSelect | undefined;
  if (groupId) {
    group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }

  const id = randomUUID();
  const password = randomBytes(6).toString("base64url");
  const passwordHash = bcrypt.hashSync(password, 10);

  db.insert(s.users)
    .values({ id, role: "student", email: String(email).trim(), passwordHash, name: String(name).trim(), lastName: String(lastName || "").trim(), extra: "", createdAt: new Date().toISOString() })
    .run();
  db.insert(s.settings).values({ userId: id, instantCheck: true, reduceMotion: false, compactCards: false }).run();
  db.insert(s.students).values({ userId: id, grade: 11, city: "", goalScore: 85, teacherId }).run();
  if (group) db.insert(s.groupMembers).values({ groupId: group.id, studentUserId: id }).run();

  res.json({ id, email: String(email).trim(), password, name: String(name).trim(), lastName: String(lastName || "").trim() });
});

teacherRouter.delete("/groups/:groupId/members/:studentId", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const studentId = pstr(req.params.studentId);
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  db.delete(s.groupMembers).where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.studentUserId, studentId))).run();
  res.json({ ok: true });
});

teacherRouter.get("/roster", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = teacherStudentIds(teacherId);
  const allHomeworks = db.select().from(s.homeworks).all();
  const allExerciseIds = allHomeworks.flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));

  const roster = studentIds.map((id) => {
    const user = db.select().from(s.users).where(eq(s.users.id, id)).get()!;
    const student = db.select().from(s.students).where(eq(s.students.userId, id)).get();
    const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)).all();
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    const statuses: Record<string, ExerciseStatus> = {};
    db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)).all().forEach((a) => {
      statuses[a.exerciseId] = a.status;
    });
    const progress = homeworkProgress(allExerciseIds, statuses);

    const attempts = db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)).all();
    const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

    // Weak topic: lowest-scoring topic across this student's own CT results.
    const topicSums = new Map<string, { sum: number; n: number }>();
    results.forEach((r) => {
      Object.entries(r.topicAccuracy as Record<string, number>).forEach(([topicId, pct]) => {
        const e = topicSums.get(topicId) || { sum: 0, n: 0 };
        e.sum += pct;
        e.n += 1;
        topicSums.set(topicId, e);
      });
    });
    let weakTopicId: string | null = null;
    let weakest = 101;
    topicSums.forEach((v, k) => {
      const avgPct = v.sum / v.n;
      if (avgPct < weakest) {
        weakest = avgPct;
        weakTopicId = k;
      }
    });
    const weakTopic = weakTopicId ? db.select().from(s.topics).where(eq(s.topics.id, weakTopicId)).get()?.name ?? "" : "";

    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    return {
      id, name: `${user.name} ${user.lastName}`.trim(), grade: student?.grade ?? 11,
      avg, goal: student?.goalScore ?? 85, done: progress.done, total: progress.total,
      risk, weak: weakTopic, lastActive: lastActive || null,
    };
  });

  res.json(roster);
});

teacherRouter.get("/review-queue", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = teacherStudentIds(teacherId);
  if (!studentIds.length) return res.json([]);

  const submitted = db
    .select()
    .from(s.homeworkState)
    .where(and(inArray(s.homeworkState.studentId, studentIds), isNotNull(s.homeworkState.submittedAt), isNull(s.homeworkState.reviewedAt)))
    .all();

  const queue = submitted.map((hs) => {
    const user = db.select().from(s.users).where(eq(s.users.id, hs.studentId)).get()!;
    const hw = db.select().from(s.homeworks).where(eq(s.homeworks.id, hs.homeworkId)).get()!;
    const attempts = db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, hs.studentId), eq(s.homeworkAttempts.homeworkId, hs.homeworkId))).all();
    const manual = attempts.filter((a) => a.status === "manual").length;
    const hints = attempts.reduce((sum, a) => sum + a.hintsOpened, 0);
    const files = attempts.reduce((sum, a) => sum + db.select().from(s.attachments).where(and(eq(s.attachments.studentId, hs.studentId), eq(s.attachments.homeworkId, hs.homeworkId), eq(s.attachments.exerciseId, a.exerciseId))).all().length, 0);
    return {
      id: `${hs.studentId}:${hs.homeworkId}`, studentId: hs.studentId, studentName: `${user.name} ${user.lastName}`.trim(),
      homeworkId: hs.homeworkId, title: hw.title, submittedAt: hs.submittedAt,
      answers: attempts.length, manual, files, hints,
    };
  });

  res.json(queue);
});

teacherRouter.post("/review/:studentId/:homeworkId", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.studentId);
  const homeworkId = pstr(req.params.homeworkId);
  const { grade, comment, flagged } = req.body || {};

  const id = randomUUID();
  db.insert(s.teacherFeedback)
    .values({ id, studentId, homeworkId, teacherId, grade: grade || "", text: comment || "", flagged: flagged || [], createdAt: new Date().toISOString() })
    .run();
  db.update(s.homeworkState).set({ reviewedAt: new Date().toISOString() }).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, homeworkId))).run();

  const teacher = db.select().from(s.users).where(eq(s.users.id, teacherId)).get()!;
  const hw = db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).get()!;
  db.insert(s.notifications)
    .values({ id: randomUUID(), userId: studentId, text: `${teacher.name} ${teacher.lastName} проверил${teacher.name.endsWith("а") ? "а" : ""} «${hw.title}»`, date: new Date().toISOString().slice(0, 10), kind: "feedback", read: false, homeworkId })
    .run();

  res.json({ ok: true, id });
});
