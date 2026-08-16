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
  const fromGroups = groupIds.length
    ? db.select().from(s.groupMembers).where(inArray(s.groupMembers.groupId, groupIds)).all().map((m) => m.studentUserId)
    : [];
  const fromDirect = db.select({ id: s.students.userId }).from(s.students).where(eq(s.students.teacherId, teacherId)).all().map((r) => r.id);
  return Array.from(new Set([...fromGroups, ...fromDirect]));
}

teacherRouter.get("/groups", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const nowIso = new Date().toISOString().slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);
  const groups = db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)).all();
  const allHomeworks = db.select().from(s.homeworks).all();

  const withMembers = groups.map((g) => {
    const groupLessons = db.select().from(s.lessons).where(eq(s.lessons.groupId, g.id)).all();
    const upcoming = groupLessons
      .filter((l) => l.status === "scheduled" && l.startAt >= nowIso)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    const lastDone = groupLessons
      .filter((l) => l.status === "done")
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];

    const studentIds = db.select().from(s.groupMembers).where(eq(s.groupMembers.groupId, g.id)).all().map((m) => m.studentUserId);

    const results = studentIds.flatMap((id) => db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)).all());
    const avgScore = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    let attentionCount = 0;
    studentIds.forEach((id) => {
      const student = db.select().from(s.students).where(eq(s.students.userId, id)).get();
      const myResults = results.filter((r) => r.studentId === id);
      const avg = myResults.length ? Math.round(myResults.reduce((sum, r) => sum + r.score, 0) / myResults.length) : 0;
      const goal = student?.goalScore ?? 85;
      if (avg === 0 || avg < goal - 10) attentionCount += 1;
    });

    const latestHomework = allHomeworks
      .filter((hw) => hw.assignedAt <= today)
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
    let lastHomework: { title: string; done: number; total: number } | null = null;
    if (latestHomework && studentIds.length) {
      let done = 0;
      studentIds.forEach((id) => {
        const st = db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, id), eq(s.homeworkState.homeworkId, latestHomework.id))).get();
        if (st?.submittedAt) done += 1;
      });
      lastHomework = { title: latestHomework.title, done, total: studentIds.length };
    }

    return {
      ...g,
      studentIds,
      nextLesson: upcoming ? { id: upcoming.id, startAt: upcoming.startAt, title: upcoming.title } : null,
      currentTopic: (upcoming || lastDone)?.title || null,
      avgScore,
      attentionCount,
      lastHomework,
    };
  });
  res.json(withMembers);
});

teacherRouter.get("/groups/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });

  const memberIds = db.select().from(s.groupMembers).where(eq(s.groupMembers.groupId, groupId)).all().map((m) => m.studentUserId);
  const allHomeworks = db.select().from(s.homeworks).all();
  const allExerciseIds = allHomeworks.flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString().slice(0, 16);

  const groupLessons = db.select().from(s.lessons).where(eq(s.lessons.groupId, groupId)).all();
  const doneLessonIds = groupLessons.filter((l) => l.status === "done").map((l) => l.id);
  const attendanceRows = doneLessonIds.length
    ? db.select().from(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, doneLessonIds)).all()
    : [];

  const allResults: (typeof s.ctResults.$inferSelect)[] = [];
  const students = memberIds.map((id) => {
    const user = db.select().from(s.users).where(eq(s.users.id, id)).get()!;
    const student = db.select().from(s.students).where(eq(s.students.userId, id)).get();
    const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)).all();
    allResults.push(...results);
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    const statuses: Record<string, ExerciseStatus> = {};
    db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)).all().forEach((a) => {
      statuses[a.exerciseId] = a.status;
    });
    const progress = homeworkProgress(allExerciseIds, statuses);

    const attempts = db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)).all();
    const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

    const states = db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, id)).all();
    const overdue = allHomeworks.filter((hw) => {
      const st = states.find((x) => x.homeworkId === hw.id);
      return hw.dueAt < today && !st?.submittedAt;
    }).length;

    const myAttendance = attendanceRows.filter((a) => a.studentId === id);
    const attendancePct = myAttendance.length ? Math.round((myAttendance.filter((a) => a.status === "present").length / myAttendance.length) * 100) : null;

    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    return {
      id, name: `${user.name} ${user.lastName}`.trim(), avg, goal: student?.goalScore ?? 85,
      done: progress.done, total: progress.total, overdue, lastActive: lastActive || null,
      attendancePct, risk,
    };
  });

  const avgScore = allResults.length ? Math.round(allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length) : 0;

  const topicSums = new Map<string, { sum: number; n: number }>();
  allResults.forEach((r) => {
    Object.entries(r.topicAccuracy as Record<string, number>).forEach(([topicId, pct]) => {
      const e = topicSums.get(topicId) || { sum: 0, n: 0 };
      e.sum += pct;
      e.n += 1;
      topicSums.set(topicId, e);
    });
  });
  const weakTopics = Array.from(topicSums.entries())
    .map(([topicId, v]) => ({ topicId, topicName: db.select().from(s.topics).where(eq(s.topics.id, topicId)).get()?.name ?? topicId, accuracy: Math.round(v.sum / v.n) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6);

  const homeworkStats = allHomeworks.map((hw) => {
    const exerciseIds = (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id));
    let groupDone = 0;
    let submittedCount = 0;
    let reviewedCount = 0;
    memberIds.forEach((id) => {
      const statuses: Record<string, ExerciseStatus> = {};
      db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, id), eq(s.homeworkAttempts.homeworkId, hw.id))).all().forEach((a) => {
        statuses[a.exerciseId] = a.status;
      });
      groupDone += homeworkProgress(exerciseIds, statuses).done;
      const st = db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, id), eq(s.homeworkState.homeworkId, hw.id))).get();
      if (st?.submittedAt) submittedCount += 1;
      if (st?.reviewedAt) reviewedCount += 1;
    });
    return { id: hw.id, title: hw.title, dueAt: hw.dueAt, groupDone, groupTotal: exerciseIds.length * memberIds.length, submittedCount, reviewedCount };
  });

  const upcomingLessons = groupLessons
    .filter((l) => l.status === "scheduled" && l.startAt >= nowIso)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5)
    .map((l) => ({ id: l.id, startAt: l.startAt, title: l.title }));
  const recentLessons = groupLessons
    .filter((l) => l.status !== "scheduled")
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 5)
    .map((l) => ({ id: l.id, startAt: l.startAt, title: l.title, status: l.status }));

  res.json({
    id: group.id, name: group.name, subjectId: group.subjectId, grade: group.grade, description: group.description,
    direction: group.direction, goal: group.goal, scheduleNote: group.scheduleNote,
    scheduleSlots: group.scheduleSlots, scheduleFormat: group.scheduleFormat, scheduleLocation: group.scheduleLocation,
    startDate: group.startDate,
    endDate: group.endDate, active: group.active,
    color: group.color, maxStudents: group.maxStudents, hwDefaults: group.hwDefaults,
    students, avgScore, weakTopics, homeworkStats, upcomingLessons, recentLessons,
  });
});

interface ScheduleSlot {
  day: number;
  time: string;
}

function normalizeScheduleSlots(value: any): ScheduleSlot[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const slots = value
    .filter((s) => s && typeof s.day === "number" && typeof s.time === "string" && /^\d{2}:\d{2}$/.test(s.time))
    .map((s) => ({ day: Number(s.day), time: s.time }));
  return slots.length ? slots : null;
}

function groupFieldsFromBody(body: any) {
  const patch: Partial<typeof s.groups.$inferInsert> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.subjectId !== undefined) patch.subjectId = body.subjectId;
  if (body.grade !== undefined) patch.grade = body.grade === null || body.grade === "" ? null : Number(body.grade);
  if (body.description !== undefined) patch.description = body.description && String(body.description).trim() ? String(body.description).trim() : null;
  if (body.direction !== undefined) patch.direction = body.direction || null;
  if (body.goal !== undefined) patch.goal = body.goal && String(body.goal).trim() ? String(body.goal).trim() : null;
  if (body.scheduleNote !== undefined) patch.scheduleNote = body.scheduleNote && String(body.scheduleNote).trim() ? String(body.scheduleNote).trim() : null;
  if (body.scheduleSlots !== undefined) patch.scheduleSlots = normalizeScheduleSlots(body.scheduleSlots);
  if (body.scheduleFormat !== undefined) patch.scheduleFormat = body.scheduleFormat === "online" ? "online" : "offline";
  if (body.scheduleLocation !== undefined) patch.scheduleLocation = body.scheduleLocation && String(body.scheduleLocation).trim() ? String(body.scheduleLocation).trim() : null;
  if (body.startDate !== undefined) patch.startDate = body.startDate || null;
  if (body.endDate !== undefined) patch.endDate = body.endDate || null;
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.color !== undefined) patch.color = body.color || null;
  if (body.maxStudents !== undefined) patch.maxStudents = body.maxStudents === null || body.maxStudents === "" ? null : Number(body.maxStudents);
  if (body.hwDefaults !== undefined) patch.hwDefaults = body.hwDefaults || null;
  return patch;
}

// Removes future scheduled lessons that no longer fit the group's active/end-date state.
function enforceGroupLifecycle(groupId: string) {
  const group = db.select().from(s.groups).where(eq(s.groups.id, groupId)).get();
  if (!group) return;
  const nowIso = new Date().toISOString().slice(0, 16);
  let cutoff: string | null = null;
  if (!group.active) cutoff = nowIso;
  else if (group.endDate) cutoff = `${group.endDate}T23:59`;
  if (!cutoff) return;

  const toRemove = db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.groupId, groupId), eq(s.lessons.status, "scheduled")))
    .all()
    .filter((l) => l.startAt >= cutoff!)
    .map((l) => l.id);
  if (toRemove.length) {
    db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)).run();
    db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)).run();
  }
}

// Removes future auto-generated lessons that no longer match the group's current schedule slots
// (e.g. a day was removed from the schedule after lessons for it were already generated).
function pruneStaleGroupScheduleLessons(groupId: string) {
  const group = db.select().from(s.groups).where(eq(s.groups.id, groupId)).get();
  if (!group) return;
  const slots = (group.scheduleSlots as ScheduleSlot[] | null) || [];
  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));
  const seriesId = `group-schedule:${groupId}`;
  const nowIso = new Date().toISOString().slice(0, 16);

  const toRemove = db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.seriesId, seriesId), eq(s.lessons.status, "scheduled")))
    .all()
    .filter((l) => l.startAt >= nowIso)
    .filter((l) => {
      const weekday = (new Date(l.startAt).getDay() + 6) % 7;
      return slotsByDay.get(weekday) !== l.startAt.slice(11, 16);
    })
    .map((l) => l.id);
  if (toRemove.length) {
    db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)).run();
    db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)).run();
  }
}

function pruneStaleStudentScheduleLessons(studentId: string) {
  const student = db.select().from(s.students).where(eq(s.students.userId, studentId)).get();
  if (!student) return;
  const slots = (student.scheduleSlots as ScheduleSlot[] | null) || [];
  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));
  const seriesId = `student-schedule:${studentId}`;
  const nowIso = new Date().toISOString().slice(0, 16);

  const toRemove = db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.seriesId, seriesId), eq(s.lessons.status, "scheduled")))
    .all()
    .filter((l) => l.startAt >= nowIso)
    .filter((l) => {
      const weekday = (new Date(l.startAt).getDay() + 6) % 7;
      return slotsByDay.get(weekday) !== l.startAt.slice(11, 16);
    })
    .map((l) => l.id);
  if (toRemove.length) {
    db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)).run();
    db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)).run();
  }
}

function enforceStudentLessonLifecycle(studentId: string) {
  const student = db.select().from(s.students).where(eq(s.students.userId, studentId)).get();
  if (!student) return;
  const nowIso = new Date().toISOString().slice(0, 16);
  let cutoff: string | null = null;
  if (!student.scheduleActive) cutoff = nowIso;
  else if (student.scheduleEndDate) cutoff = `${student.scheduleEndDate}T23:59`;
  if (!cutoff) return;

  const toRemove = db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.studentId, studentId), isNull(s.lessons.groupId), eq(s.lessons.status, "scheduled")))
    .all()
    .filter((l) => l.startAt >= cutoff!)
    .map((l) => l.id);
  if (toRemove.length) {
    db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)).run();
    db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)).run();
  }
}

teacherRouter.post("/groups", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, subjectId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите название группы" });
  if (!subjectId) return res.status(400).json({ error: "Укажите предмет" });
  const id = randomUUID();
  const fields = groupFieldsFromBody(req.body || {});
  db.insert(s.groups).values({ id, teacherId, name: String(name).trim(), subjectId, ...fields }).run();
  const group = db.select().from(s.groups).where(eq(s.groups.id, id)).get()!;
  res.json({ ...group, studentIds: [] });
});

teacherRouter.patch("/groups/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const patch = groupFieldsFromBody(req.body || {});
  db.update(s.groups).set(patch).where(eq(s.groups.id, groupId)).run();
  enforceGroupLifecycle(groupId);
  if (patch.scheduleSlots !== undefined) pruneStaleGroupScheduleLessons(groupId);
  res.json({ ok: true });
});

teacherRouter.post("/groups/:id/generate-lessons", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const slots = (group.scheduleSlots as ScheduleSlot[] | null) || [];
  if (!slots.length) return res.status(400).json({ error: "Сначала укажите дни и время расписания в настройках группы" });
  if (!group.active) return res.status(400).json({ error: "Группа неактивна" });

  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = group.startDate ? new Date(`${group.startDate}T00:00`) : today;
  const rangeStart = start > today ? start : today;
  const defaultHorizon = new Date(rangeStart);
  defaultHorizon.setDate(defaultHorizon.getDate() + 12 * 7);
  const until = group.endDate ? new Date(`${group.endDate}T00:00`) : defaultHorizon;

  const existing = new Set(
    db.select({ startAt: s.lessons.startAt }).from(s.lessons).where(eq(s.lessons.groupId, groupId)).all().map((l) => l.startAt),
  );

  const created: string[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= until) {
    const weekday = (cursor.getDay() + 6) % 7; // 0=Monday
    const time = slotsByDay.get(weekday);
    if (time) {
      const startAt = `${cursor.toISOString().slice(0, 10)}T${time}`;
      if (!existing.has(startAt)) {
        const id = randomUUID();
        db.insert(s.lessons)
          .values({
            id, teacherId, groupId, studentId: null, title: "", startAt,
            durationMinutes: 60, format: group.scheduleFormat, location: group.scheduleLocation || "",
            status: "scheduled", seriesId: `group-schedule:${groupId}`, note: null, createdAt: new Date().toISOString(),
          })
          .run();
        created.push(id);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({ ok: true, created: created.length });
});

teacherRouter.delete("/groups/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });

  db.transaction((tx) => {
    const lessonIds = tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.groupId, groupId)).all().map((l) => l.id);
    if (lessonIds.length) {
      tx.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, lessonIds)).run();
      tx.delete(s.lessons).where(eq(s.lessons.groupId, groupId)).run();
    }
    tx.delete(s.materials).where(eq(s.materials.groupId, groupId)).run();
    tx.delete(s.studentInvites).where(eq(s.studentInvites.groupId, groupId)).run();
    tx.delete(s.groupMembers).where(eq(s.groupMembers.groupId, groupId)).run();
    tx.delete(s.groups).where(eq(s.groups.id, groupId)).run();
  });

  res.json({ ok: true });
});

teacherRouter.post("/groups/:groupId/members", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const { email, studentId } = req.body || {};
  const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  if (!email && !studentId) return res.status(400).json({ error: "Укажите ученика" });

  let student: typeof s.users.$inferSelect | undefined;
  if (studentId) {
    if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });
    student = db.select().from(s.users).where(eq(s.users.id, studentId)).get();
  } else {
    student = db.select().from(s.users).where(eq(s.users.email, String(email).trim())).get();
    if (!student || student.role !== "student") return res.status(404).json({ error: "Ученик с таким email не найден" });
  }
  if (!student) return res.status(404).json({ error: "Ученик не найден" });

  const already = db.select().from(s.groupMembers).where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.studentUserId, student.id))).get();
  if (already) return res.status(409).json({ error: "Ученик уже в этой группе" });

  db.insert(s.groupMembers).values({ groupId, studentUserId: student.id }).run();
  res.json({ ok: true, studentId: student.id, name: `${student.name} ${student.lastName}`.trim() });
});

teacherRouter.get("/materials", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  let list = db.select().from(s.materials).where(eq(s.materials.teacherId, teacherId)).all();
  if (groupId) list = list.filter((m) => m.groupId === groupId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

teacherRouter.post("/materials", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { groupId, title, type, url, content } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: "Укажите название" });
  if (groupId) {
    const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }
  const id = randomUUID();
  const allowedTypes = ["theory", "formula", "example", "video", "pdf", "task", "recording", "other"];
  db.insert(s.materials)
    .values({
      id, teacherId, groupId: groupId || null, title: String(title).trim(),
      type: allowedTypes.includes(type) ? type : "other",
      url: url && String(url).trim() ? String(url).trim() : null,
      content: content && String(content).trim() ? String(content).trim() : null,
      createdAt: new Date().toISOString(),
    })
    .run();
  res.json(db.select().from(s.materials).where(eq(s.materials.id, id)).get());
});

teacherRouter.delete("/materials/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const materialId = pstr(req.params.id);
  const material = db.select().from(s.materials).where(and(eq(s.materials.id, materialId), eq(s.materials.teacherId, teacherId))).get();
  if (!material) return res.status(404).json({ error: "Материал не найден" });
  db.delete(s.materials).where(eq(s.materials.id, materialId)).run();
  res.json({ ok: true });
});

teacherRouter.post("/students", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, lastName, email, groupId, grade, goalScore, startScore, startGrade, goalGrade, note } = req.body || {};
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
  db.insert(s.students)
    .values({
      userId: id,
      grade: grade ? Number(grade) : 11,
      city: "",
      goalScore: goalScore ? Number(goalScore) : 85,
      startScore: startScore !== undefined && startScore !== "" ? Number(startScore) : null,
      startGrade: startGrade !== undefined && startGrade !== "" ? Number(startGrade) : null,
      goalGrade: goalGrade !== undefined && goalGrade !== "" ? Number(goalGrade) : null,
      teacherId,
      note: note && String(note).trim() ? String(note).trim() : null,
    })
    .run();
  if (group) db.insert(s.groupMembers).values({ groupId: group.id, studentUserId: id }).run();

  res.json({ id, email: String(email).trim(), password, name: String(name).trim(), lastName: String(lastName || "").trim() });
});

teacherRouter.get("/student-invites", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const invites = db.select().from(s.studentInvites).where(eq(s.studentInvites.teacherId, teacherId)).all();
  const list = invites
    .filter((inv) => !inv.acceptedUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((inv) => {
      const group = inv.groupId ? db.select().from(s.groups).where(eq(s.groups.id, inv.groupId)).get() : undefined;
      return {
        token: inv.token, name: inv.name, lastName: inv.lastName,
        grade: inv.grade, goalScore: inv.goalScore, note: inv.note,
        groupId: inv.groupId, groupName: group?.name ?? null,
        createdAt: inv.createdAt,
      };
    });
  res.json(list);
});

teacherRouter.post("/student-invites", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, lastName, groupId, grade, goalScore, startScore, startGrade, goalGrade, note } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя ученика" });

  if (groupId) {
    const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }

  const token = randomBytes(20).toString("base64url");
  db.insert(s.studentInvites)
    .values({
      token, teacherId, groupId: groupId || null,
      name: String(name).trim(), lastName: String(lastName || "").trim(),
      grade: grade ? Number(grade) : null,
      goalScore: goalScore ? Number(goalScore) : null,
      startScore: startScore !== undefined && startScore !== "" ? Number(startScore) : null,
      startGrade: startGrade !== undefined && startGrade !== "" ? Number(startGrade) : null,
      goalGrade: goalGrade !== undefined && goalGrade !== "" ? Number(goalGrade) : null,
      note: note && String(note).trim() ? String(note).trim() : null,
      createdAt: new Date().toISOString(),
    })
    .run();
  res.json({ token });
});

teacherRouter.delete("/student-invites/:token", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const token = pstr(req.params.token);
  const invite = db.select().from(s.studentInvites).where(and(eq(s.studentInvites.token, token), eq(s.studentInvites.teacherId, teacherId))).get();
  if (!invite) return res.status(404).json({ error: "Приглашение не найдено" });
  db.delete(s.studentInvites).where(eq(s.studentInvites.token, token)).run();
  res.json({ ok: true });
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

function lessonParticipants(lesson: typeof s.lessons.$inferSelect): string[] {
  if (lesson.groupId) return db.select().from(s.groupMembers).where(eq(s.groupMembers.groupId, lesson.groupId)).all().map((m) => m.studentUserId);
  if (lesson.studentId) return [lesson.studentId];
  return [];
}

function serializeLesson(lesson: typeof s.lessons.$inferSelect) {
  const group = lesson.groupId ? db.select().from(s.groups).where(eq(s.groups.id, lesson.groupId)).get() : undefined;
  const student = lesson.studentId ? db.select().from(s.users).where(eq(s.users.id, lesson.studentId)).get() : undefined;
  return {
    id: lesson.id, groupId: lesson.groupId, groupName: group?.name ?? null,
    studentId: lesson.studentId, studentName: student ? `${student.name} ${student.lastName}`.trim() : null,
    title: lesson.title, startAt: lesson.startAt, durationMinutes: lesson.durationMinutes,
    format: lesson.format, location: lesson.location, status: lesson.status, seriesId: lesson.seriesId, note: lesson.note,
  };
}

teacherRouter.get("/lessons", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  let list = db.select().from(s.lessons).where(eq(s.lessons.teacherId, teacherId)).all();
  if (from) list = list.filter((l) => l.startAt >= from);
  if (to) list = list.filter((l) => l.startAt <= to);
  if (groupId) list = list.filter((l) => l.groupId === groupId);
  list.sort((a, b) => (groupId ? b.startAt.localeCompare(a.startAt) : a.startAt.localeCompare(b.startAt)));
  res.json(list.map(serializeLesson));
});

teacherRouter.get("/lessons/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lesson = db.select().from(s.lessons).where(and(eq(s.lessons.id, pstr(req.params.id)), eq(s.lessons.teacherId, teacherId))).get();
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });
  const participantIds = lessonParticipants(lesson);
  const attendanceRows = db.select().from(s.lessonAttendance).where(eq(s.lessonAttendance.lessonId, lesson.id)).all();
  const attendance = participantIds.map((id) => {
    const user = db.select().from(s.users).where(eq(s.users.id, id)).get();
    const row = attendanceRows.find((a) => a.studentId === id);
    return { studentId: id, name: user ? `${user.name} ${user.lastName}`.trim() : id, status: row?.status ?? null };
  });
  res.json({ ...serializeLesson(lesson), attendance });
});

teacherRouter.post("/lessons", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { groupId, studentId, title, startAt, durationMinutes, format, location, repeatWeekly, repeatUntil } = req.body || {};
  if (!groupId && !studentId) return res.status(400).json({ error: "Укажите группу или ученика" });
  if (groupId) {
    const group = db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).get();
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }
  if (studentId && !teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });
  if (!startAt) return res.status(400).json({ error: "Укажите дату и время" });

  const seriesId = repeatWeekly && repeatUntil ? randomUUID() : null;
  const starts: string[] = [String(startAt)];
  if (seriesId) {
    const first = new Date(startAt);
    const until = new Date(repeatUntil);
    let next = new Date(first.getTime() + 7 * 24 * 60 * 60 * 1000);
    while (next <= until) {
      starts.push(next.toISOString().slice(0, 16));
      next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  const created = starts.map((start) => {
    const id = randomUUID();
    db.insert(s.lessons)
      .values({
        id, teacherId, groupId: groupId || null, studentId: studentId || null,
        title: title ? String(title).trim() : "", startAt: start,
        durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
        format: format === "online" ? "online" : "offline", location: location ? String(location).trim() : "",
        status: "scheduled", seriesId, note: null, createdAt: new Date().toISOString(),
      })
      .run();
    return db.select().from(s.lessons).where(eq(s.lessons.id, id)).get()!;
  });

  res.json({ created: created.map(serializeLesson) });
});

teacherRouter.patch("/lessons/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).get();
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });

  const { title, startAt, durationMinutes, format, location, status, note, scope } = req.body || {};
  const patch: Partial<typeof s.lessons.$inferInsert> = {};
  if (title !== undefined) patch.title = String(title).trim();
  if (startAt !== undefined) patch.startAt = String(startAt);
  if (durationMinutes !== undefined) patch.durationMinutes = Number(durationMinutes);
  if (format !== undefined) patch.format = format === "online" ? "online" : "offline";
  if (location !== undefined) patch.location = String(location).trim();
  if (status !== undefined) patch.status = status;
  if (note !== undefined) patch.note = note && String(note).trim() ? String(note).trim() : null;

  // Moving a single occurrence off its scheduled slot (e.g. via calendar drag-and-drop) detaches it
  // from the group/student schedule template, so later schedule edits won't sweep it up as "stale".
  if (startAt !== undefined && String(startAt) !== lesson.startAt && lesson.seriesId && scope !== "series") {
    patch.seriesId = null;
  }

  if (scope === "series" && lesson.seriesId) {
    db.update(s.lessons)
      .set(patch)
      .where(and(eq(s.lessons.seriesId, lesson.seriesId), eq(s.lessons.teacherId, teacherId), eq(s.lessons.status, "scheduled")))
      .run();
  } else {
    db.update(s.lessons).set(patch).where(eq(s.lessons.id, lessonId)).run();
  }
  res.json({ ok: true });
});

teacherRouter.delete("/lessons/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).get();
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });
  db.delete(s.lessonAttendance).where(eq(s.lessonAttendance.lessonId, lessonId)).run();
  db.delete(s.lessons).where(eq(s.lessons.id, lessonId)).run();
  res.json({ ok: true });
});

teacherRouter.post("/lessons/:id/attendance", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).get();
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });

  const { attendance } = req.body || {};
  if (!Array.isArray(attendance)) return res.status(400).json({ error: "Некорректные данные" });

  for (const row of attendance) {
    if (!row?.studentId || !["present", "absent", "excused"].includes(row.status)) continue;
    db.delete(s.lessonAttendance).where(and(eq(s.lessonAttendance.lessonId, lessonId), eq(s.lessonAttendance.studentId, row.studentId))).run();
    db.insert(s.lessonAttendance).values({ lessonId, studentId: row.studentId, status: row.status }).run();
  }
  db.update(s.lessons).set({ status: "done" }).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.status, "scheduled"))).run();
  res.json({ ok: true });
});

teacherRouter.get("/roster", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = teacherStudentIds(teacherId);
  const allHomeworks = db.select().from(s.homeworks).all();
  const allExerciseIds = allHomeworks.flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));
  const today = new Date().toISOString().slice(0, 10);
  const myGroups = db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)).all();

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

    const states = db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, id)).all();
    const overdue = allHomeworks.filter((hw) => {
      const st = states.find((x) => x.homeworkId === hw.id);
      return hw.dueAt < today && !st?.submittedAt;
    }).length;

    const memberGroups = myGroups.filter((g) => db.select().from(s.groupMembers).where(and(eq(s.groupMembers.groupId, g.id), eq(s.groupMembers.studentUserId, id))).get());

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
      overdue, risk, weak: weakTopic, lastActive: lastActive || null,
      groupIds: memberGroups.map((g) => g.id), groupNames: memberGroups.map((g) => g.name),
    };
  });

  res.json(roster);
});

teacherRouter.get("/individual", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = teacherStudentIds(teacherId);
  const nowIso = new Date().toISOString().slice(0, 16);

  const list = studentIds.map((id) => {
    const user = db.select().from(s.users).where(eq(s.users.id, id)).get()!;
    const student = db.select().from(s.students).where(eq(s.students.userId, id)).get();
    const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)).all();
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    const individualLessons = db.select().from(s.lessons).where(and(eq(s.lessons.studentId, id), isNull(s.lessons.groupId))).all();
    const nextLesson = individualLessons
      .filter((l) => l.status === "scheduled" && l.startAt >= nowIso)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    const lastLesson = individualLessons
      .filter((l) => l.status === "done")
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];

    return {
      id, name: `${user.name} ${user.lastName}`.trim(), grade: student?.grade ?? 11,
      avg, goal: student?.goalScore ?? 85, risk,
      lessonCount: individualLessons.length,
      nextLesson: nextLesson ? { id: nextLesson.id, startAt: nextLesson.startAt, title: nextLesson.title } : null,
      lastLesson: lastLesson ? { id: lastLesson.id, startAt: lastLesson.startAt, title: lastLesson.title } : null,
      scheduleSubjectId: student?.scheduleSubjectId ?? null,
      scheduleSlots: student?.scheduleSlots ?? null,
      scheduleStartDate: student?.scheduleStartDate ?? null,
      scheduleEndDate: student?.scheduleEndDate ?? null,
      scheduleActive: student?.scheduleActive ?? true,
      scheduleFormat: student?.scheduleFormat ?? "offline",
      scheduleLocation: student?.scheduleLocation ?? null,
    };
  });

  res.json(list);
});

teacherRouter.get("/students/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const user = db.select().from(s.users).where(eq(s.users.id, studentId)).get()!;
  const student = db.select().from(s.students).where(eq(s.students.userId, studentId)).get();
  const myGroups = db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)).all();
  const groups = myGroups
    .filter((g) => db.select().from(s.groupMembers).where(and(eq(s.groupMembers.groupId, g.id), eq(s.groupMembers.studentUserId, studentId))).get())
    .map((g) => ({ id: g.id, name: g.name }));

  const allHomeworks = db.select().from(s.homeworks).all();
  const states = db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)).all();
  const attempts = db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)).all();
  const today = new Date().toISOString().slice(0, 10);

  const homeworks = allHomeworks.map((hw) => {
    const exerciseIds = (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id));
    const statuses: Record<string, ExerciseStatus> = {};
    attempts.filter((a) => a.homeworkId === hw.id).forEach((a) => { statuses[a.exerciseId] = a.status; });
    const progress = homeworkProgress(exerciseIds, statuses);
    const st = states.find((x) => x.homeworkId === hw.id);
    let status: string;
    if (st?.reviewedAt) status = "reviewed";
    else if (st?.submittedAt) status = "submitted";
    else if (hw.dueAt < today) status = "overdue";
    else if (progress.done > 0) status = "in_progress";
    else status = "new";
    return { id: hw.id, title: hw.title, dueAt: hw.dueAt, done: progress.done, total: progress.total, submittedAt: st?.submittedAt ?? null, reviewedAt: st?.reviewedAt ?? null, status };
  });

  const results = db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId)).all().sort((a, b) => a.date.localeCompare(b.date));

  const topicSums = new Map<string, { sum: number; n: number }>();
  results.forEach((r) => {
    Object.entries(r.topicAccuracy as Record<string, number>).forEach(([topicId, pct]) => {
      const e = topicSums.get(topicId) || { sum: 0, n: 0 };
      e.sum += pct;
      e.n += 1;
      topicSums.set(topicId, e);
    });
  });
  const topicAccuracy = Array.from(topicSums.entries())
    .map(([topicId, v]) => ({ topicId, topicName: db.select().from(s.topics).where(eq(s.topics.id, topicId)).get()?.name ?? topicId, accuracy: Math.round(v.sum / v.n) }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
  const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

  res.json({
    id: studentId, name: user.name, lastName: user.lastName, email: user.email,
    grade: student?.grade ?? 11, goalScore: student?.goalScore ?? 85, note: student?.note ?? null,
    startScore: student?.startScore ?? null, startGrade: student?.startGrade ?? null, goalGrade: student?.goalGrade ?? null,
    groups, avg, lastActive: lastActive || null, homeworks, results, topicAccuracy,
  });
});

teacherRouter.patch("/students/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const {
    name, lastName, grade, goalScore, startScore, startGrade, goalGrade, note,
    scheduleSubjectId, scheduleSlots, scheduleStartDate, scheduleEndDate, scheduleActive,
    scheduleFormat, scheduleLocation,
  } = req.body || {};
  if (name !== undefined || lastName !== undefined) {
    const userPatch: Partial<typeof s.users.$inferInsert> = {};
    if (name !== undefined && String(name).trim()) userPatch.name = String(name).trim();
    if (lastName !== undefined) userPatch.lastName = String(lastName).trim();
    db.update(s.users).set(userPatch).where(eq(s.users.id, studentId)).run();
  }

  const patch: Partial<typeof s.students.$inferInsert> = {};
  if (grade !== undefined) patch.grade = Number(grade);
  if (goalScore !== undefined) patch.goalScore = Number(goalScore);
  if (startScore !== undefined) patch.startScore = startScore === null || startScore === "" ? null : Number(startScore);
  if (startGrade !== undefined) patch.startGrade = startGrade === null || startGrade === "" ? null : Number(startGrade);
  if (goalGrade !== undefined) patch.goalGrade = goalGrade === null || goalGrade === "" ? null : Number(goalGrade);
  if (note !== undefined) patch.note = note && String(note).trim() ? String(note).trim() : null;
  if (scheduleSubjectId !== undefined) patch.scheduleSubjectId = scheduleSubjectId || null;
  if (scheduleSlots !== undefined) patch.scheduleSlots = normalizeScheduleSlots(scheduleSlots);
  if (scheduleStartDate !== undefined) patch.scheduleStartDate = scheduleStartDate || null;
  if (scheduleEndDate !== undefined) patch.scheduleEndDate = scheduleEndDate || null;
  if (scheduleActive !== undefined) patch.scheduleActive = Boolean(scheduleActive);
  if (scheduleFormat !== undefined) patch.scheduleFormat = scheduleFormat === "online" ? "online" : "offline";
  if (scheduleLocation !== undefined) patch.scheduleLocation = scheduleLocation && String(scheduleLocation).trim() ? String(scheduleLocation).trim() : null;

  if (Object.keys(patch).length) db.update(s.students).set(patch).where(eq(s.students.userId, studentId)).run();
  enforceStudentLessonLifecycle(studentId);
  if (scheduleSlots !== undefined) pruneStaleStudentScheduleLessons(studentId);
  res.json({ ok: true });
});

teacherRouter.post("/students/:id/generate-lessons", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const student = db.select().from(s.students).where(eq(s.students.userId, studentId)).get();
  const slots = (student?.scheduleSlots as ScheduleSlot[] | null) || [];
  if (!slots.length) return res.status(400).json({ error: "Сначала укажите дни и время расписания" });
  if (!student?.scheduleActive) return res.status(400).json({ error: "Расписание неактивно" });

  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = student.scheduleStartDate ? new Date(`${student.scheduleStartDate}T00:00`) : today;
  const rangeStart = start > today ? start : today;
  const defaultHorizon = new Date(rangeStart);
  defaultHorizon.setDate(defaultHorizon.getDate() + 12 * 7);
  const until = student.scheduleEndDate ? new Date(`${student.scheduleEndDate}T00:00`) : defaultHorizon;

  const existing = new Set(
    db.select({ startAt: s.lessons.startAt }).from(s.lessons).where(and(eq(s.lessons.studentId, studentId), isNull(s.lessons.groupId))).all().map((l) => l.startAt),
  );

  const created: string[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= until) {
    const weekday = (cursor.getDay() + 6) % 7;
    const time = slotsByDay.get(weekday);
    if (time) {
      const startAt = `${cursor.toISOString().slice(0, 10)}T${time}`;
      if (!existing.has(startAt)) {
        const id = randomUUID();
        db.insert(s.lessons)
          .values({
            id, teacherId, groupId: null, studentId, title: "", startAt,
            durationMinutes: 60, format: student.scheduleFormat, location: student.scheduleLocation || "",
            status: "scheduled", seriesId: `student-schedule:${studentId}`, note: null, createdAt: new Date().toISOString(),
          })
          .run();
        created.push(id);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({ ok: true, created: created.length });
});

teacherRouter.delete("/students/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  db.transaction((tx) => {
    const individualLessonIds = tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.studentId, studentId)).all().map((l) => l.id);
    tx.delete(s.lessonAttendance).where(eq(s.lessonAttendance.studentId, studentId)).run();
    if (individualLessonIds.length) tx.delete(s.lessons).where(inArray(s.lessons.id, individualLessonIds)).run();
    tx.delete(s.groupMembers).where(eq(s.groupMembers.studentUserId, studentId)).run();
    tx.delete(s.studentInvites).where(eq(s.studentInvites.acceptedUserId, studentId)).run();
    tx.delete(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)).run();
    tx.delete(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)).run();
    tx.delete(s.attachments).where(eq(s.attachments.studentId, studentId)).run();
    tx.delete(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)).run();
    tx.delete(s.ctSessions).where(eq(s.ctSessions.studentId, studentId)).run();
    tx.delete(s.ctResults).where(eq(s.ctResults.studentId, studentId)).run();
    tx.delete(s.theoryProgress).where(eq(s.theoryProgress.studentId, studentId)).run();
    tx.delete(s.techniqueProgress).where(eq(s.techniqueProgress.studentId, studentId)).run();
    tx.delete(s.reviewCards).where(eq(s.reviewCards.studentId, studentId)).run();
    tx.delete(s.gameRecords).where(eq(s.gameRecords.studentId, studentId)).run();
    tx.delete(s.parentLinks).where(eq(s.parentLinks.studentUserId, studentId)).run();
    tx.delete(s.notifications).where(eq(s.notifications.userId, studentId)).run();
    tx.delete(s.settings).where(eq(s.settings.userId, studentId)).run();
    tx.delete(s.passwordResets).where(eq(s.passwordResets.userId, studentId)).run();
    tx.delete(s.students).where(eq(s.students.userId, studentId)).run();
    tx.delete(s.users).where(eq(s.users.id, studentId)).run();
  });

  res.json({ ok: true });
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
