import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { homeworkProgress, type ExerciseStatus } from "../lib/scoring.js";

export const parentRouter = Router();
parentRouter.use(requireAuth, requireRole("parent"));

async function linkedChild(parentId: string) {
  const link = (await db.select().from(s.parentLinks).where(eq(s.parentLinks.parentUserId, parentId)).limit(1))[0];
  if (!link) return null;
  const user = (await db.select().from(s.users).where(eq(s.users.id, link.studentUserId)).limit(1))[0];
  const student = (await db.select().from(s.students).where(eq(s.students.userId, link.studentUserId)).limit(1))[0];
  if (!user || !student) return null;
  return { user, student };
}

parentRouter.get("/child", async (req: AuthedRequest, res) => {
  const child = await linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту. Уточните код ученика у преподавателя." });
  res.json({ id: child.user.id, name: child.user.name, lastName: child.user.lastName, grade: child.student.grade, goalScore: child.student.goalScore });
});

parentRouter.get("/child/progress", async (req: AuthedRequest, res) => {
  const child = await linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту" });
  const studentId = child.user.id;

  const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId)));

  const homeworks = (await db.select().from(s.homeworks));
  const attempts = (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)));
  const states = (await db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)));
  const stateMap = new Map(states.map((st) => [st.homeworkId, st]));

  // Задания в базе общие для всех — родителю показываем только те, что
  // действительно достались его ребёнку.
  const mine = new Set([...states.map((x) => x.homeworkId), ...attempts.map((x) => x.homeworkId)]);
  const homeworkProgressList = homeworks.filter((hw) => mine.has(hw.id)).map((hw) => {
    const ids = (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id));
    const statuses: Record<string, ExerciseStatus> = {};
    attempts.filter((a) => a.homeworkId === hw.id).forEach((a) => { statuses[a.exerciseId] = a.status; });
    const progress = homeworkProgress(ids, statuses);
    const st = stateMap.get(hw.id);
    return { id: hw.id, title: hw.title, dueAt: hw.dueAt, done: progress.done, total: progress.total, submittedAt: st?.submittedAt ?? null, reviewedAt: st?.reviewedAt ?? null };
  });

  const feedback = (await db.select().from(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)));
  const latestFeedback = feedback.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0];
  let latestFeedbackOut = null;
  if (latestFeedback) {
    const teacher = (await db.select().from(s.users).where(eq(s.users.id, latestFeedback.teacherId)).limit(1))[0];
    latestFeedbackOut = { teacher: teacher ? `${teacher.name} ${teacher.lastName}` : "", text: latestFeedback.text, grade: latestFeedback.grade, date: latestFeedback.createdAt.slice(0, 10) };
  }

  res.json({ results, homeworks: homeworkProgressList, latestFeedback: latestFeedbackOut });
});

parentRouter.get("/child/week-activity", async (req: AuthedRequest, res) => {
  const child = await linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту" });
  const studentId = child.user.id;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const attempts = (await db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, studentId), gte(s.homeworkAttempts.updatedAt, since))));

  const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const byDay = new Map<string, { tasks: Set<string>; count: number }>();
  DAYS.forEach((d) => byDay.set(d, { tasks: new Set(), count: 0 }));
  attempts.forEach((a) => {
    const day = DAYS[new Date(a.updatedAt).getDay()];
    const entry = byDay.get(day)!;
    entry.tasks.add(a.exerciseId);
    entry.count += 1;
  });

  const ORDER = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const week = ORDER.map((day) => ({ day, minutes: (byDay.get(day)?.count ?? 0) * 4, tasks: byDay.get(day)?.tasks.size ?? 0 }));
  res.json(week);
});
