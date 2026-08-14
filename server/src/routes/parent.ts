import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { homeworkProgress, type ExerciseStatus } from "../lib/scoring.js";

export const parentRouter = Router();
parentRouter.use(requireAuth, requireRole("parent"));

function linkedChild(parentId: string) {
  const link = db.select().from(s.parentLinks).where(eq(s.parentLinks.parentUserId, parentId)).get();
  if (!link) return null;
  const user = db.select().from(s.users).where(eq(s.users.id, link.studentUserId)).get();
  const student = db.select().from(s.students).where(eq(s.students.userId, link.studentUserId)).get();
  if (!user || !student) return null;
  return { user, student };
}

parentRouter.get("/child", (req: AuthedRequest, res) => {
  const child = linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту. Уточните код ученика у преподавателя." });
  res.json({ id: child.user.id, name: child.user.name, lastName: child.user.lastName, grade: child.student.grade, goalScore: child.student.goalScore });
});

parentRouter.get("/child/progress", (req: AuthedRequest, res) => {
  const child = linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту" });
  const studentId = child.user.id;

  const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId)).all();

  const homeworks = db.select().from(s.homeworks).all();
  const attempts = db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)).all();
  const states = db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)).all();
  const stateMap = new Map(states.map((st) => [st.homeworkId, st]));

  const homeworkProgressList = homeworks.map((hw) => {
    const ids = (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id));
    const statuses: Record<string, ExerciseStatus> = {};
    attempts.filter((a) => a.homeworkId === hw.id).forEach((a) => { statuses[a.exerciseId] = a.status; });
    const progress = homeworkProgress(ids, statuses);
    const st = stateMap.get(hw.id);
    return { id: hw.id, title: hw.title, dueAt: hw.dueAt, done: progress.done, total: progress.total, submittedAt: st?.submittedAt ?? null, reviewedAt: st?.reviewedAt ?? null };
  });

  const feedback = db.select().from(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)).all();
  const latestFeedback = feedback.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0];
  let latestFeedbackOut = null;
  if (latestFeedback) {
    const teacher = db.select().from(s.users).where(eq(s.users.id, latestFeedback.teacherId)).get();
    latestFeedbackOut = { teacher: teacher ? `${teacher.name} ${teacher.lastName}` : "", text: latestFeedback.text, grade: latestFeedback.grade, date: latestFeedback.createdAt.slice(0, 10) };
  }

  res.json({ results, homeworks: homeworkProgressList, latestFeedback: latestFeedbackOut });
});

parentRouter.get("/child/week-activity", (req: AuthedRequest, res) => {
  const child = linkedChild(req.auth!.sub);
  if (!child) return res.status(404).json({ error: "Ребёнок не привязан к аккаунту" });
  const studentId = child.user.id;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const attempts = db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, studentId), gte(s.homeworkAttempts.updatedAt, since))).all();

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
