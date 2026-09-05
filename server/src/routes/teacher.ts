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

async function teacherStudentIds(teacherId: string): Promise<string[]> {
  const groupIds = (await db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.teacherId, teacherId))).map((g) => g.id);
  // Any membership period, past or present — a student who left a group is still this teacher's student.
  const fromGroups = groupIds.length
    ? (await db.select({ id: s.groupMemberships.studentUserId }).from(s.groupMemberships).where(inArray(s.groupMemberships.groupId, groupIds))).map((m) => m.id)
    : [];
  const fromDirect = (await db.select({ id: s.students.userId }).from(s.students).where(eq(s.students.teacherId, teacherId))).map((r) => r.id);
  return Array.from(new Set([...fromGroups, ...fromDirect]));
}

// Students with an active (not-yet-left) membership period in the group — its current roster.
async function activeGroupMemberIds(groupId: string): Promise<string[]> {
  return (await db.select({ id: s.groupMemberships.studentUserId }).from(s.groupMemberships)
    .where(and(eq(s.groupMemberships.groupId, groupId), isNull(s.groupMemberships.leftAt)))).map((m) => m.id);
}

teacherRouter.get("/groups", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const nowIso = new Date().toISOString().slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);
  const groups = (await db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)));
  const allHomeworks = (await db.select().from(s.homeworks));

  const withMembers = await Promise.all(groups.map(async (g) => {
    const groupLessons = (await db.select().from(s.lessons).where(eq(s.lessons.groupId, g.id)));
    const upcoming = groupLessons
      .filter((l) => l.status === "scheduled" && l.startAt >= nowIso)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    const lastDone = groupLessons
      .filter((l) => l.status === "done")
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];

    const studentIds = await activeGroupMemberIds(g.id);

    const results = (
      await Promise.all(
        studentIds.map((id) => db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id))),
      )
    ).flat();
    const avgScore = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    let attentionCount = 0;
    for (const id of studentIds) {
      const student = (await db.select().from(s.students).where(eq(s.students.userId, id)).limit(1))[0];
      const myResults = results.filter((r) => r.studentId === id);
      const avg = myResults.length ? Math.round(myResults.reduce((sum, r) => sum + r.score, 0) / myResults.length) : 0;
      const goal = student?.goalScore ?? 85;
      if (avg === 0 || avg < goal - 10) attentionCount += 1;
    }

    const latestHomework = allHomeworks
      .filter((hw) => hw.assignedAt <= today)
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
    let lastHomework: { title: string; done: number; total: number } | null = null;
    if (latestHomework && studentIds.length) {
      let done = 0;
      for (const id of studentIds) {
        const st = (await db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, id), eq(s.homeworkState.homeworkId, latestHomework.id))).limit(1))[0];
        if (st?.submittedAt) done += 1;
      }
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
  }));
  res.json(withMembers);
});

teacherRouter.get("/groups/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });

  const memberIds = await activeGroupMemberIds(groupId);
  const allHomeworks = (await db.select().from(s.homeworks));
  const allExerciseIds = allHomeworks.flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString().slice(0, 16);

  const groupLessons = (await db.select().from(s.lessons).where(eq(s.lessons.groupId, groupId)));
  const doneLessonIds = groupLessons.filter((l) => l.status === "done").map((l) => l.id);
  const attendanceRows = doneLessonIds.length
    ? (await db.select().from(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, doneLessonIds)))
    : [];

  const allResults: (typeof s.ctResults.$inferSelect)[] = [];
  const students = await Promise.all(memberIds.map(async (id) => {
    const user = (await db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0]!;
    const student = (await db.select().from(s.students).where(eq(s.students.userId, id)).limit(1))[0];
    const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)));
    allResults.push(...results);
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    const statuses: Record<string, ExerciseStatus> = {};
    (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id))).forEach((a) => {
      statuses[a.exerciseId] = a.status;
    });
    // Задания в базе общие для всех. Ученику принадлежат только те, что ему
    // действительно достались, — иначе новичок получает чужие работы, все
    // просроченные, в первую же секунду.
    const myHomeworkIds = await studentHomeworkIds(id);
    const myExerciseIds = allHomeworks
      .filter((hw) => myHomeworkIds.has(hw.id))
      .flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));
    const progress = homeworkProgress(myExerciseIds, statuses);

    const attempts = (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)));
    const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

    const states = (await db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, id)));
    const overdue = allHomeworks.filter((hw) => {
      if (!myHomeworkIds.has(hw.id)) return false;
      const st = states.find((x) => x.homeworkId === hw.id);
      return hw.dueAt < today && !st?.submittedAt;
    }).length;

    // A lesson the student was frozen for at the time doesn't count against their attendance
    // rate — they were never expected to be there.
    // Array.filter ignores a promise and treats it as truthy, which would keep
    // every row, so resolve the frozen checks first and filter on the results.
    const myRows = attendanceRows.filter((a) => a.studentId === id);
    const notFrozen = await Promise.all(
      myRows.map(async (a) => {
        const lesson = groupLessons.find((l) => l.id === a.lessonId);
        const referenceDate = (lesson?.plannedStart ?? lesson?.startAt ?? "").slice(0, 10);
        return !(await isStudentFrozen(groupId, id, referenceDate));
      }),
    );
    const myAttendance = myRows.filter((_a, i) => notFrozen[i]);
    const attendancePct = myAttendance.length ? Math.round((myAttendance.filter((a) => a.status === "present").length / myAttendance.length) * 100) : null;

    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    return {
      id, name: `${user.name} ${user.lastName}`.trim(), avg, goal: student?.goalScore ?? 85,
      done: progress.done, total: progress.total, overdue, lastActive: lastActive || null,
      attendancePct, risk,
    };
  }));

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
  const weakTopics = await Promise.all((
    await Promise.all(
      Array.from(topicSums.entries()).map(async ([topicId, v]) => ({ topicId, topicName: (await db.select().from(s.topics).where(eq(s.topics.id, topicId)).limit(1))[0]?.name ?? topicId, accuracy: Math.round(v.sum / v.n) })),
    )
  )
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6));

  const homeworkStats = await Promise.all(allHomeworks.map(async (hw) => {
    const exerciseIds = (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id));
    let groupDone = 0;
    let submittedCount = 0;
    let reviewedCount = 0;
    for (const id of memberIds) {
      const statuses: Record<string, ExerciseStatus> = {};
      (await db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, id), eq(s.homeworkAttempts.homeworkId, hw.id)))).forEach((a) => {
        statuses[a.exerciseId] = a.status;
      });
      groupDone += homeworkProgress(exerciseIds, statuses).done;
      const st = (await db.select().from(s.homeworkState).where(and(eq(s.homeworkState.studentId, id), eq(s.homeworkState.homeworkId, hw.id))).limit(1))[0];
      if (st?.submittedAt) submittedCount += 1;
      if (st?.reviewedAt) reviewedCount += 1;
    }
    return { id: hw.id, title: hw.title, dueAt: hw.dueAt, groupDone, groupTotal: exerciseIds.length * memberIds.length, submittedCount, reviewedCount };
  }));

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
// Group deactivated or ended early: cancel (never delete) its future not-yet-conducted lessons,
// whatever their override state — the group is stopping, so nothing further should happen, but
// the record of what was planned/moved/etc. is kept.
async function enforceGroupLifecycle(groupId: string) {
  const group = (await db.select().from(s.groups).where(eq(s.groups.id, groupId)).limit(1))[0];
  if (!group) return;
  const nowIso = new Date().toISOString().slice(0, 16);
  let cutoff: string | null = null;
  if (!group.active) cutoff = nowIso;
  else if (group.endDate) cutoff = `${group.endDate}T23:59`;
  if (!cutoff) return;

  const toCancel = (await db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.groupId, groupId), eq(s.lessons.status, "scheduled")))
    )
    .filter((l) => l.startAt >= cutoff!)
    .map((l) => l.id);
  if (toCancel.length) {
    (await db.update(s.lessons).set({ status: "cancelled", overrideType: "cancelled", cancelReason: "group_ended" }).where(inArray(s.lessons.id, toCancel)));
  }
}

async function isDateInGroupPause(groupId: string, dateStr: string): Promise<boolean> {
  return (await db.select().from(s.groupPauses).where(eq(s.groupPauses.groupId, groupId)))
    .some((p) => p.startDate <= dateStr && dateStr <= p.endDate);
}

async function isStudentFrozen(groupId: string, studentId: string, dateStr: string): Promise<boolean> {
  return (await db.select().from(s.studentFreezes).where(and(eq(s.studentFreezes.groupId, groupId), eq(s.studentFreezes.studentId, studentId))))
    .some((f) => f.startDate <= dateStr && dateStr <= f.endDate);
}

// Reconciles auto-generated (overrideType "none") future lessons against the group's current
// schedule slots and pause windows. Untouched placeholders for slots that no longer exist are
// removed outright — nothing of value lives on them. Placeholders that now fall inside a pause
// are cancelled instead, so the reason is remembered. Moved/cancelled/extra/custom occurrences
// are never touched: manual overrides always win over the schedule template.
async function reconcileGroupScheduleLessons(groupId: string) {
  const group = (await db.select().from(s.groups).where(eq(s.groups.id, groupId)).limit(1))[0];
  if (!group) return;
  const slots = (group.scheduleSlots as ScheduleSlot[] | null) || [];
  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));
  const seriesId = `group-schedule:${groupId}`;
  const nowIso = new Date().toISOString().slice(0, 16);

  const untouchedFuture = (await db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.seriesId, seriesId), eq(s.lessons.status, "scheduled"), eq(s.lessons.overrideType, "none")))
    )
    .filter((l) => (l.plannedStart ?? l.startAt) >= nowIso);

  const toRemove: string[] = [];
  const toCancelForPause: string[] = [];
  for (const l of untouchedFuture) {
    const plannedStart = l.plannedStart ?? l.startAt;
    const weekday = (new Date(plannedStart).getDay() + 6) % 7;
    if (slotsByDay.get(weekday) !== plannedStart.slice(11, 16)) {
      toRemove.push(l.id);
    } else if (await isDateInGroupPause(groupId, plannedStart.slice(0, 10))) {
      toCancelForPause.push(l.id);
    }
  }

  if (toRemove.length) {
    (await db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)));
    (await db.delete(s.lessonParticipantOverrides).where(inArray(s.lessonParticipantOverrides.lessonId, toRemove)));
    (await db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)));
  }
  if (toCancelForPause.length) {
    (await db.update(s.lessons).set({ status: "cancelled", overrideType: "cancelled", cancelReason: "group_paused" }).where(inArray(s.lessons.id, toCancelForPause)));
  }
}

async function reconcileStudentScheduleLessons(studentId: string) {
  const student = (await db.select().from(s.students).where(eq(s.students.userId, studentId)).limit(1))[0];
  if (!student) return;
  const slots = (student.scheduleSlots as ScheduleSlot[] | null) || [];
  const slotsByDay = new Map<number, string>();
  slots.forEach((slot) => slotsByDay.set(slot.day, slot.time));
  const seriesId = `student-schedule:${studentId}`;
  const nowIso = new Date().toISOString().slice(0, 16);

  const toRemove = (await db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.seriesId, seriesId), eq(s.lessons.status, "scheduled"), eq(s.lessons.overrideType, "none")))
    )
    .filter((l) => (l.plannedStart ?? l.startAt) >= nowIso)
    .filter((l) => {
      const plannedStart = l.plannedStart ?? l.startAt;
      const weekday = (new Date(plannedStart).getDay() + 6) % 7;
      return slotsByDay.get(weekday) !== plannedStart.slice(11, 16);
    })
    .map((l) => l.id);
  if (toRemove.length) {
    (await db.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, toRemove)));
    (await db.delete(s.lessons).where(inArray(s.lessons.id, toRemove)));
  }
}

// Individual schedule deactivated or ended early: same cancel-not-delete treatment as groups.
async function enforceStudentLessonLifecycle(studentId: string) {
  const student = (await db.select().from(s.students).where(eq(s.students.userId, studentId)).limit(1))[0];
  if (!student) return;
  const nowIso = new Date().toISOString().slice(0, 16);
  let cutoff: string | null = null;
  if (!student.scheduleActive) cutoff = nowIso;
  else if (student.scheduleEndDate) cutoff = `${student.scheduleEndDate}T23:59`;
  if (!cutoff) return;

  const toCancel = (await db
    .select()
    .from(s.lessons)
    .where(and(eq(s.lessons.studentId, studentId), isNull(s.lessons.groupId), eq(s.lessons.status, "scheduled")))
    )
    .filter((l) => l.startAt >= cutoff!)
    .map((l) => l.id);
  if (toCancel.length) {
    (await db.update(s.lessons).set({ status: "cancelled", overrideType: "cancelled", cancelReason: "schedule_ended" }).where(inArray(s.lessons.id, toCancel)));
  }
}

teacherRouter.post("/groups", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { name, subjectId } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите название группы" });
  if (!subjectId) return res.status(400).json({ error: "Укажите предмет" });
  const id = randomUUID();
  const fields = groupFieldsFromBody(req.body || {});
  (await db.insert(s.groups).values({ id, teacherId, name: String(name).trim(), subjectId, ...fields }));
  const group = (await db.select().from(s.groups).where(eq(s.groups.id, id)).limit(1))[0]!;
  res.json({ ...group, studentIds: [] });
});

teacherRouter.patch("/groups/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const patch = groupFieldsFromBody(req.body || {});
  (await db.update(s.groups).set(patch).where(eq(s.groups.id, groupId)));
  await enforceGroupLifecycle(groupId);
  if (patch.scheduleSlots !== undefined) await reconcileGroupScheduleLessons(groupId);
  res.json({ ok: true });
});

teacherRouter.post("/groups/:id/generate-lessons", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
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

  const seriesId = `group-schedule:${groupId}`;
  const existingPlanned = new Set(
    (await db.select({ plannedStart: s.lessons.plannedStart, startAt: s.lessons.startAt }).from(s.lessons).where(eq(s.lessons.seriesId, seriesId)))
      .map((l) => l.plannedStart ?? l.startAt),
  );

  const created: string[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= until) {
    const weekday = (cursor.getDay() + 6) % 7; // 0=Monday
    const time = slotsByDay.get(weekday);
    const dateStr = cursor.toISOString().slice(0, 10);
    if (time && !await isDateInGroupPause(groupId, dateStr)) {
      const plannedStart = `${dateStr}T${time}`;
      if (!existingPlanned.has(plannedStart)) {
        const id = randomUUID();
        (await db.insert(s.lessons)
          .values({
            id, teacherId, groupId, studentId: null, title: "", startAt: plannedStart, plannedStart, overrideType: "none",
            durationMinutes: 60, format: group.scheduleFormat, location: group.scheduleLocation || "",
            status: "scheduled", seriesId, note: null, createdAt: new Date().toISOString(),
          })
          );
        created.push(id);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({ ok: true, created: created.length });
});

teacherRouter.get("/groups/:id/pauses", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const pauses = (await db.select().from(s.groupPauses).where(eq(s.groupPauses.groupId, groupId))).sort((a, b) => a.startDate.localeCompare(b.startDate));
  res.json(pauses);
});

teacherRouter.post("/groups/:id/pauses", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const { startDate, endDate, reason } = req.body || {};
  if (!startDate || !endDate) return res.status(400).json({ error: "Укажите даты начала и окончания" });
  if (String(startDate) > String(endDate)) return res.status(400).json({ error: "Дата окончания раньше даты начала" });
  const id = randomUUID();
  (await db.insert(s.groupPauses).values({ id, groupId, startDate: String(startDate), endDate: String(endDate), reason: reason && String(reason).trim() ? String(reason).trim() : null, createdAt: new Date().toISOString() }));
  await reconcileGroupScheduleLessons(groupId);
  res.json({ id, ok: true });
});

teacherRouter.delete("/groups/:groupId/pauses/:pauseId", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const pauseId = pstr(req.params.pauseId);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  (await db.delete(s.groupPauses).where(and(eq(s.groupPauses.id, pauseId), eq(s.groupPauses.groupId, groupId))));
  res.json({ ok: true });
});

teacherRouter.delete("/groups/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });

  await db.transaction(async (tx) => {
    const lessonIds = (await tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.groupId, groupId))).map((l) => l.id);
    if (lessonIds.length) {
      (await tx.delete(s.lessonAttendance).where(inArray(s.lessonAttendance.lessonId, lessonIds)));
      (await tx.delete(s.lessonParticipantOverrides).where(inArray(s.lessonParticipantOverrides.lessonId, lessonIds)));
      (await tx.delete(s.lessons).where(eq(s.lessons.groupId, groupId)));
    }
    (await tx.delete(s.materials).where(eq(s.materials.groupId, groupId)));
    (await tx.delete(s.groupPauses).where(eq(s.groupPauses.groupId, groupId)));
    (await tx.delete(s.studentFreezes).where(eq(s.studentFreezes.groupId, groupId)));
    // An invite may target several groups via groupIds; only drop the ones that end up empty.
    for (const inv of (await tx.select().from(s.studentInvites).where(eq(s.studentInvites.teacherId, teacherId)))) {
      const ids = (inv.groupIds as string[] | null) ?? (inv.groupId ? [inv.groupId] : []);
      // `continue`, not `return`: this was a forEach skip, not a function exit.
      if (!ids.includes(groupId)) continue;
      const remaining = ids.filter((id) => id !== groupId);
      if (remaining.length) {
        (await tx.update(s.studentInvites).set({ groupIds: remaining, groupId: remaining[0] }).where(eq(s.studentInvites.token, inv.token)));
      } else {
        (await tx.delete(s.studentInvites).where(eq(s.studentInvites.token, inv.token)));
      }
    }
    (await tx.delete(s.groupMemberships).where(eq(s.groupMemberships.groupId, groupId)));
    (await tx.delete(s.groups).where(eq(s.groups.id, groupId)));
  });

  res.json({ ok: true });
});

teacherRouter.post("/groups/:groupId/members", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const { email, studentId } = req.body || {};
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  if (!email && !studentId) return res.status(400).json({ error: "Укажите ученика" });

  let student: typeof s.users.$inferSelect | undefined;
  if (studentId) {
    if (!(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });
    student = (await db.select().from(s.users).where(eq(s.users.id, studentId)).limit(1))[0];
  } else {
    student = (await db.select().from(s.users).where(eq(s.users.email, String(email).trim())).limit(1))[0];
    if (!student || student.role !== "student") return res.status(404).json({ error: "Ученик с таким email не найден" });
  }
  if (!student) return res.status(404).json({ error: "Ученик не найден" });

  const already = (await db.select().from(s.groupMemberships).where(and(eq(s.groupMemberships.groupId, groupId), eq(s.groupMemberships.studentUserId, student.id), isNull(s.groupMemberships.leftAt))).limit(1))[0];
  if (already) return res.status(409).json({ error: "Ученик уже в этой группе" });

  (await db.insert(s.groupMemberships).values({ id: randomUUID(), groupId, studentUserId: student.id, joinedAt: new Date().toISOString().slice(0, 10), leftAt: null }));
  res.json({ ok: true, studentId: student.id, name: `${student.name} ${student.lastName}`.trim() });
});

teacherRouter.get("/materials", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  let list = (await db.select().from(s.materials).where(eq(s.materials.teacherId, teacherId)));
  if (groupId) list = list.filter((m) => m.groupId === groupId);
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

teacherRouter.post("/materials", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { groupId, title, type, url, content } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: "Укажите название" });
  if (groupId) {
    const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }
  const id = randomUUID();
  const allowedTypes = ["theory", "formula", "example", "video", "pdf", "task", "recording", "other"];
  (await db.insert(s.materials)
    .values({
      id, teacherId, groupId: groupId || null, title: String(title).trim(),
      type: allowedTypes.includes(type) ? type : "other",
      url: url && String(url).trim() ? String(url).trim() : null,
      content: content && String(content).trim() ? String(content).trim() : null,
      createdAt: new Date().toISOString(),
    })
    );
  res.json((await db.select().from(s.materials).where(eq(s.materials.id, id)).limit(1))[0]);
});

teacherRouter.delete("/materials/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const materialId = pstr(req.params.id);
  const material = (await db.select().from(s.materials).where(and(eq(s.materials.id, materialId), eq(s.materials.teacherId, teacherId))).limit(1))[0];
  if (!material) return res.status(404).json({ error: "Материал не найден" });
  (await db.delete(s.materials).where(eq(s.materials.id, materialId)));
  res.json({ ok: true });
});

teacherRouter.post("/students", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const {
    name, lastName, email, groupId, groupIds, grade, goalScore, startScore, startGrade, goalGrade, note,
    scheduleSubjectId, scheduleSlots, scheduleStartDate, scheduleEndDate, scheduleFormat, scheduleLocation,
  } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя ученика" });
  if (!email || !String(email).includes("@")) return res.status(400).json({ error: "Введите корректный email" });

  const existing = (await db.select().from(s.users).where(eq(s.users.email, String(email).trim())).limit(1))[0];
  if (existing) return res.status(409).json({ error: "Такой email уже зарегистрирован" });

  const requestedGroupIds: string[] = Array.isArray(groupIds) ? groupIds : groupId ? [groupId] : [];
  const validGroups = requestedGroupIds.length
    ? (await db.select().from(s.groups).where(and(inArray(s.groups.id, requestedGroupIds), eq(s.groups.teacherId, teacherId))))
    : [];
  if (validGroups.length !== requestedGroupIds.length) return res.status(404).json({ error: "Группа не найдена" });

  const id = randomUUID();
  const password = randomBytes(6).toString("base64url");
  const passwordHash = bcrypt.hashSync(password, 10);

  (await db.insert(s.users)
    .values({ id, role: "student", email: String(email).trim(), passwordHash, name: String(name).trim(), lastName: String(lastName || "").trim(), extra: "", createdAt: new Date().toISOString() })
    );
  (await db.insert(s.settings).values({ userId: id, instantCheck: true, reduceMotion: false, compactCards: false }));
  (await db.insert(s.students)
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
      scheduleSubjectId: scheduleSubjectId || null,
      scheduleSlots: normalizeScheduleSlots(scheduleSlots),
      scheduleStartDate: scheduleStartDate || null,
      scheduleEndDate: scheduleEndDate || null,
      scheduleFormat: scheduleFormat === "online" ? "online" : "offline",
      scheduleLocation: scheduleLocation && String(scheduleLocation).trim() ? String(scheduleLocation).trim() : null,
    })
    );
  const joinedAt = new Date().toISOString().slice(0, 10);
  for (const group of validGroups) {
    (await db.insert(s.groupMemberships).values({ id: randomUUID(), groupId: group.id, studentUserId: id, joinedAt, leftAt: null }));
  }

  res.json({ id, email: String(email).trim(), password, name: String(name).trim(), lastName: String(lastName || "").trim() });
});

teacherRouter.get("/student-invites", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const invites = (await db.select().from(s.studentInvites).where(eq(s.studentInvites.teacherId, teacherId)));
  const list = await Promise.all(invites
    .filter((inv) => !inv.acceptedUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(async (inv) => {
      const groupIds = (inv.groupIds as string[] | null) ?? (inv.groupId ? [inv.groupId] : []);
      const groupNames = await Promise.all((
        await Promise.all(
          groupIds.map(async (id) => (await db.select().from(s.groups).where(eq(s.groups.id, id)).limit(1))[0]?.name),
        )
      ).filter((n): n is string => Boolean(n)));
      return {
        token: inv.token, name: inv.name, lastName: inv.lastName,
        grade: inv.grade, goalScore: inv.goalScore, note: inv.note,
        groupIds, groupNames,
        createdAt: inv.createdAt,
      };
    }));
  res.json(list);
});

teacherRouter.post("/student-invites", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const {
    name, lastName, groupId, groupIds, grade, goalScore, startScore, startGrade, goalGrade, note,
    scheduleSubjectId, scheduleSlots, scheduleStartDate, scheduleEndDate, scheduleFormat, scheduleLocation,
  } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя ученика" });

  const requestedGroupIds: string[] = Array.isArray(groupIds) ? groupIds : groupId ? [groupId] : [];
  const validGroups = requestedGroupIds.length
    ? (await db.select().from(s.groups).where(and(inArray(s.groups.id, requestedGroupIds), eq(s.groups.teacherId, teacherId))))
    : [];
  if (validGroups.length !== requestedGroupIds.length) return res.status(404).json({ error: "Группа не найдена" });

  const token = randomBytes(20).toString("base64url");
  (await db.insert(s.studentInvites)
    .values({
      token, teacherId, groupId: requestedGroupIds[0] || null, groupIds: requestedGroupIds.length ? requestedGroupIds : null,
      name: String(name).trim(), lastName: String(lastName || "").trim(),
      grade: grade ? Number(grade) : null,
      goalScore: goalScore ? Number(goalScore) : null,
      startScore: startScore !== undefined && startScore !== "" ? Number(startScore) : null,
      startGrade: startGrade !== undefined && startGrade !== "" ? Number(startGrade) : null,
      goalGrade: goalGrade !== undefined && goalGrade !== "" ? Number(goalGrade) : null,
      note: note && String(note).trim() ? String(note).trim() : null,
      scheduleSubjectId: scheduleSubjectId || null,
      scheduleSlots: normalizeScheduleSlots(scheduleSlots),
      scheduleStartDate: scheduleStartDate || null,
      scheduleEndDate: scheduleEndDate || null,
      scheduleFormat: scheduleFormat === "online" ? "online" : "offline",
      scheduleLocation: scheduleLocation && String(scheduleLocation).trim() ? String(scheduleLocation).trim() : null,
      createdAt: new Date().toISOString(),
    })
    );
  res.json({ token });
});

teacherRouter.delete("/student-invites/:token", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const token = pstr(req.params.token);
  const invite = (await db.select().from(s.studentInvites).where(and(eq(s.studentInvites.token, token), eq(s.studentInvites.teacherId, teacherId))).limit(1))[0];
  if (!invite) return res.status(404).json({ error: "Приглашение не найдено" });
  (await db.delete(s.studentInvites).where(eq(s.studentInvites.token, token)));
  res.json({ ok: true });
});

teacherRouter.delete("/groups/:groupId/members/:studentId", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const studentId = pstr(req.params.studentId);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  // Leaving a group closes the current membership period rather than erasing it, so past
  // lessons keep remembering who was actually enrolled at the time.
  (await db.update(s.groupMemberships)
    .set({ leftAt: new Date().toISOString().slice(0, 10) })
    .where(and(eq(s.groupMemberships.groupId, groupId), eq(s.groupMemberships.studentUserId, studentId), isNull(s.groupMemberships.leftAt)))
    );
  res.json({ ok: true });
});

teacherRouter.get("/groups/:id/freezes", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.id);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const freezes = (await db.select().from(s.studentFreezes).where(eq(s.studentFreezes.groupId, groupId))).sort((a, b) => a.startDate.localeCompare(b.startDate));
  res.json(freezes);
});

teacherRouter.post("/groups/:groupId/members/:studentId/freeze", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const studentId = pstr(req.params.studentId);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  const activeMembership = (await db.select().from(s.groupMemberships).where(and(eq(s.groupMemberships.groupId, groupId), eq(s.groupMemberships.studentUserId, studentId), isNull(s.groupMemberships.leftAt))).limit(1))[0];
  if (!activeMembership) return res.status(404).json({ error: "Ученик не состоит в группе" });
  const { startDate, endDate, reason } = req.body || {};
  if (!startDate || !endDate) return res.status(400).json({ error: "Укажите даты начала и окончания" });
  if (String(startDate) > String(endDate)) return res.status(400).json({ error: "Дата окончания раньше даты начала" });
  const id = randomUUID();
  (await db.insert(s.studentFreezes).values({ id, groupId, studentId, startDate: String(startDate), endDate: String(endDate), reason: reason && String(reason).trim() ? String(reason).trim() : null, createdAt: new Date().toISOString() }));
  res.json({ id, ok: true });
});

teacherRouter.delete("/groups/:groupId/freezes/:freezeId", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const groupId = pstr(req.params.groupId);
  const freezeId = pstr(req.params.freezeId);
  const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
  if (!group) return res.status(404).json({ error: "Группа не найдена" });
  (await db.delete(s.studentFreezes).where(and(eq(s.studentFreezes.id, freezeId), eq(s.studentFreezes.groupId, groupId))));
  res.json({ ok: true });
});

// Who belongs to this lesson: for a group lesson, whoever's membership period covered its
// planned date (not wherever it may have been moved to) — a student who joined or left the
// group doesn't retroactively gain or lose lessons that already happened before/after that.
// On top of that default roster, per-lesson overrides let the teacher add a guest/latecomer or
// drop someone for just this one occurrence, without touching membership or the schedule.
type Expectation = "expected" | "excused" | "optional";

async function lessonParticipantsWithOrigin(lesson: typeof s.lessons.$inferSelect): Promise<{ studentId: string; origin: "scheduled" | "manual"; expectation: Expectation }[]> {
  let base: string[];
  const referenceDate = (lesson.plannedStart ?? lesson.startAt).slice(0, 10);
  if (lesson.groupId) {
    base = (await db.select().from(s.groupMemberships).where(eq(s.groupMemberships.groupId, lesson.groupId)))
      .filter((m) => m.joinedAt <= referenceDate && (!m.leftAt || m.leftAt >= referenceDate))
      .map((m) => m.studentUserId);
  } else if (lesson.studentId) {
    base = [lesson.studentId];
  } else {
    base = [];
  }

  const overrides = (await db.select().from(s.lessonParticipantOverrides).where(eq(s.lessonParticipantOverrides.lessonId, lesson.id)));
  const excluded = new Set(overrides.filter((o) => o.action === "exclude").map((o) => o.studentId));
  const included = overrides.filter((o) => o.action === "include").map((o) => o.studentId);

  const result = new Map<string, { origin: "scheduled" | "manual"; expectation: Expectation }>();
  // for..of, not forEach: an async forEach callback isn't awaited, so `result`
  // would still be empty by the time it's read below.
  for (const id of base) {
    if (excluded.has(id)) continue;
    const frozen = lesson.groupId ? await isStudentFrozen(lesson.groupId, id, referenceDate) : false;
    result.set(id, { origin: "scheduled", expectation: frozen ? "excused" : "expected" });
  }
  included.forEach((id) => result.set(id, { origin: "manual", expectation: "optional" }));
  return Array.from(result.entries()).map(([studentId, v]) => ({ studentId, ...v }));
}

async function serializeLesson(lesson: typeof s.lessons.$inferSelect) {
  const group = lesson.groupId ? (await db.select().from(s.groups).where(eq(s.groups.id, lesson.groupId)).limit(1))[0] : undefined;
  const student = lesson.studentId ? (await db.select().from(s.users).where(eq(s.users.id, lesson.studentId)).limit(1))[0] : undefined;
  return {
    id: lesson.id, groupId: lesson.groupId, groupName: group?.name ?? null,
    studentId: lesson.studentId, studentName: student ? `${student.name} ${student.lastName}`.trim() : null,
    title: lesson.title, startAt: lesson.startAt, plannedStart: lesson.plannedStart, overrideType: lesson.overrideType,
    durationMinutes: lesson.durationMinutes,
    format: lesson.format, location: lesson.location, status: lesson.status, cancelReason: lesson.cancelReason, seriesId: lesson.seriesId, note: lesson.note,
  };
}

teacherRouter.get("/lessons", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  let list = (await db.select().from(s.lessons).where(eq(s.lessons.teacherId, teacherId)));
  if (from) list = list.filter((l) => l.startAt >= from);
  if (to) list = list.filter((l) => l.startAt <= to);
  if (groupId) list = list.filter((l) => l.groupId === groupId);
  list.sort((a, b) => (groupId ? b.startAt.localeCompare(a.startAt) : a.startAt.localeCompare(b.startAt)));
  res.json(await Promise.all(list.map(serializeLesson)));
});

teacherRouter.get("/lessons/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, pstr(req.params.id)), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });
  const participants = await lessonParticipantsWithOrigin(lesson);
  const attendanceRows = (await db.select().from(s.lessonAttendance).where(eq(s.lessonAttendance.lessonId, lesson.id)));
  const attendance = await Promise.all(participants.map(async ({ studentId: id, origin, expectation }) => {
    const user = (await db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0];
    const row = attendanceRows.find((a) => a.studentId === id);
    return { studentId: id, name: user ? `${user.name} ${user.lastName}`.trim() : id, status: row?.status ?? null, origin, expectation };
  }));
  res.json({ ...(await serializeLesson(lesson)), attendance });
});

teacherRouter.post("/lessons/:id/participants", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });

  const { studentId, action } = req.body || {};
  if (!studentId || !(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });
  if (!["include", "exclude", "reset"].includes(action)) return res.status(400).json({ error: "Некорректное действие" });

  (await db.delete(s.lessonParticipantOverrides).where(and(eq(s.lessonParticipantOverrides.lessonId, lessonId), eq(s.lessonParticipantOverrides.studentId, studentId))));
  if (action !== "reset") {
    (await db.insert(s.lessonParticipantOverrides).values({ lessonId, studentId, action, createdAt: new Date().toISOString() }));
  }
  if (action === "exclude") {
    (await db.delete(s.lessonAttendance).where(and(eq(s.lessonAttendance.lessonId, lessonId), eq(s.lessonAttendance.studentId, studentId))));
  }
  res.json({ ok: true });
});

teacherRouter.post("/lessons", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const { groupId, studentId, title, startAt, durationMinutes, format, location, repeatWeekly, repeatUntil } = req.body || {};
  if (!groupId && !studentId) return res.status(400).json({ error: "Укажите группу или ученика" });
  if (groupId) {
    const group = (await db.select().from(s.groups).where(and(eq(s.groups.id, groupId), eq(s.groups.teacherId, teacherId))).limit(1))[0];
    if (!group) return res.status(404).json({ error: "Группа не найдена" });
  }
  if (studentId && !(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });
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

  const created = await Promise.all(starts.map(async (start) => {
    const id = randomUUID();
    (await db.insert(s.lessons)
      .values({
        id, teacherId, groupId: groupId || null, studentId: studentId || null,
        title: title ? String(title).trim() : "", startAt: start, plannedStart: start, overrideType: "extra",
        durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
        format: format === "online" ? "online" : "offline", location: location ? String(location).trim() : "",
        status: "scheduled", seriesId, note: null, createdAt: new Date().toISOString(),
      })
      );
    return (await db.select().from(s.lessons).where(eq(s.lessons.id, id)).limit(1))[0]!;
  }));

  res.json({ created: await Promise.all(created.map(serializeLesson)) });
});

teacherRouter.patch("/lessons/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
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

  if (scope === "series" && lesson.seriesId && status === "cancelled") {
    // Cancelling a whole series never deletes anything — every currently-scheduled occurrence
    // (past not yet marked done, or future) is marked cancelled. The calendar decides whether to
    // hide cancelled lessons from the grid views; the record itself is kept either way.
    (await db.update(s.lessons)
      .set({ status: "cancelled", overrideType: "cancelled", cancelReason: "series_cancel" })
      .where(and(eq(s.lessons.seriesId, lesson.seriesId), eq(s.lessons.teacherId, teacherId), eq(s.lessons.status, "scheduled")))
      );
  } else if (scope === "series" && lesson.seriesId) {
    // Whole-series edits (e.g. default format) only touch occurrences nobody has manually
    // customized yet — a moved/cancelled/extra/custom lesson always keeps its own values.
    (await db.update(s.lessons)
      .set(patch)
      .where(and(eq(s.lessons.seriesId, lesson.seriesId), eq(s.lessons.teacherId, teacherId), eq(s.lessons.status, "scheduled"), eq(s.lessons.overrideType, "none")))
      );
  } else {
    // Single-occurrence edit: a real date/time change is a "move" (the schedule template is left
    // alone, and the next regular occurrence still appears on schedule); any other manual edit
    // that isn't a status change is a "custom" override. Cancelling never deletes the row.
    if (status === "cancelled") {
      patch.overrideType = "cancelled";
      patch.cancelReason = "teacher";
    } else if (startAt !== undefined && String(startAt) !== lesson.startAt) {
      if (lesson.overrideType === "none") patch.overrideType = "moved";
    } else if (lesson.overrideType === "none" && (title !== undefined || durationMinutes !== undefined || format !== undefined || location !== undefined)) {
      patch.overrideType = "custom";
    }
    (await db.update(s.lessons).set(patch).where(eq(s.lessons.id, lessonId)));
  }
  res.json({ ok: true });
});

teacherRouter.delete("/lessons/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });
  const fromSchedule = lesson.seriesId?.startsWith("group-schedule:") || lesson.seriesId?.startsWith("student-schedule:");
  if (fromSchedule) {
    // Occurrences generated from a group/student schedule are never hard-deleted: the generator
    // matches on plannedStart, so a physically removed row would just reappear next regeneration.
    // "Delete" here means cancel — the calendar hides cancelled lessons from the grid views.
    (await db.update(s.lessons).set({ status: "cancelled", overrideType: "cancelled", cancelReason: "teacher" }).where(eq(s.lessons.id, lessonId)));
  } else {
    (await db.delete(s.lessonAttendance).where(eq(s.lessonAttendance.lessonId, lessonId)));
    (await db.delete(s.lessonParticipantOverrides).where(eq(s.lessonParticipantOverrides.lessonId, lessonId)));
    (await db.delete(s.lessons).where(eq(s.lessons.id, lessonId)));
  }
  res.json({ ok: true });
});

teacherRouter.post("/lessons/:id/restore", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });
  if (lesson.status !== "cancelled") return res.status(400).json({ error: "Занятие не отменено" });
  const plannedStart = lesson.plannedStart ?? lesson.startAt;
  const overrideType = lesson.startAt !== plannedStart ? "moved" : "none";
  (await db.update(s.lessons).set({ status: "scheduled", overrideType, cancelReason: null }).where(eq(s.lessons.id, lessonId)));
  res.json({ ok: true });
});

teacherRouter.post("/lessons/:id/attendance", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const lessonId = pstr(req.params.id);
  const lesson = (await db.select().from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.teacherId, teacherId))).limit(1))[0];
  if (!lesson) return res.status(404).json({ error: "Занятие не найдено" });

  const { attendance } = req.body || {};
  if (!Array.isArray(attendance)) return res.status(400).json({ error: "Некорректные данные" });

  for (const row of attendance) {
    if (!row?.studentId || !["present", "absent", "excused"].includes(row.status)) continue;
    (await db.delete(s.lessonAttendance).where(and(eq(s.lessonAttendance.lessonId, lessonId), eq(s.lessonAttendance.studentId, row.studentId))));
    (await db.insert(s.lessonAttendance).values({ lessonId, studentId: row.studentId, status: row.status }));
  }
  (await db.update(s.lessons).set({ status: "done" }).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.status, "scheduled"))));
  res.json({ ok: true });
});

/**
 * Работы, которые действительно достались ученику. Таблица заданий общая для
 * всех, и без этого фильтра любой новый ученик мгновенно получает весь список
 * чужих работ — просроченных, потому что сроки у них давние.
 *
 * Принадлежность определяется по следу: есть состояние работы или попытки.
 * Отдельной выдачи заданий в приложении пока нет.
 */
async function studentHomeworkIds(studentId: string): Promise<Set<string>> {
  const [states, attempts] = await Promise.all([
    db.select({ homeworkId: s.homeworkState.homeworkId }).from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)),
    db.select({ homeworkId: s.homeworkAttempts.homeworkId }).from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)),
  ]);
  return new Set([...states.map((x) => x.homeworkId), ...attempts.map((a) => a.homeworkId)]);
}

teacherRouter.get("/roster", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = await teacherStudentIds(teacherId);
  const allHomeworks = (await db.select().from(s.homeworks));
  const today = new Date().toISOString().slice(0, 10);
  const myGroups = (await db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)));

  const roster = await Promise.all(studentIds.map(async (id) => {
    const user = (await db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0]!;
    const student = (await db.select().from(s.students).where(eq(s.students.userId, id)).limit(1))[0];
    const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)));
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

    const statuses: Record<string, ExerciseStatus> = {};
    (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id))).forEach((a) => {
      statuses[a.exerciseId] = a.status;
    });
    // Задания общие для всех — считаем только те, что достались этому ученику.
    const myHomeworkIds = await studentHomeworkIds(id);
    const myExerciseIds = allHomeworks
      .filter((hw) => myHomeworkIds.has(hw.id))
      .flatMap((hw) => (hw.sections as any[]).filter((sc) => sc.kind === "exercises").flatMap((sc) => sc.exercises.map((e: any) => e.id)));
    const progress = homeworkProgress(myExerciseIds, statuses);

    const attempts = (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, id)));
    const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

    const states = (await db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, id)));
    const overdue = allHomeworks.filter((hw) => {
      if (!myHomeworkIds.has(hw.id)) return false;
      const st = states.find((x) => x.homeworkId === hw.id);
      return hw.dueAt < today && !st?.submittedAt;
    }).length;

    // Resolve membership for every group first: an async predicate can't be
    // passed to Array.filter, which ignores the returned promise.
    const memberships = await Promise.all(
      myGroups.map(async (g) => (await db.select().from(s.groupMemberships).where(and(eq(s.groupMemberships.groupId, g.id), eq(s.groupMemberships.studentUserId, id), isNull(s.groupMemberships.leftAt))).limit(1))[0]),
    );
    const memberGroups = myGroups.filter((_g, i) => Boolean(memberships[i]));

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
    const weakTopic = weakTopicId ? (await db.select().from(s.topics).where(eq(s.topics.id, weakTopicId)).limit(1))[0]?.name ?? "" : "";

    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    return {
      id, name: `${user.name} ${user.lastName}`.trim(), grade: student?.grade ?? 11,
      avg, goal: student?.goalScore ?? 85, done: progress.done, total: progress.total,
      overdue, risk, weak: weakTopic, lastActive: lastActive || null,
      groupIds: memberGroups.map((g) => g.id), groupNames: memberGroups.map((g) => g.name),
    };
  }));

  res.json(roster);
});

teacherRouter.get("/individual", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = await teacherStudentIds(teacherId);
  const nowIso = new Date().toISOString().slice(0, 16);

  const list = await Promise.all(studentIds.map(async (id) => {
    const user = (await db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0]!;
    const student = (await db.select().from(s.students).where(eq(s.students.userId, id)).limit(1))[0];
    const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, id)));
    const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
    const risk = avg === 0 ? "risk" : avg < (student?.goalScore ?? 85) - 25 ? "risk" : avg < (student?.goalScore ?? 85) - 10 ? "attention" : "ok";

    const individualLessons = (await db.select().from(s.lessons).where(and(eq(s.lessons.studentId, id), isNull(s.lessons.groupId))));
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
  }));

  res.json(list);
});

teacherRouter.get("/students/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const user = (await db.select().from(s.users).where(eq(s.users.id, studentId)).limit(1))[0]!;
  const student = (await db.select().from(s.students).where(eq(s.students.userId, studentId)).limit(1))[0];
  const myGroups = (await db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)));
  const groupMemberships = await Promise.all(
    myGroups.map(async (g) => (await db.select().from(s.groupMemberships).where(and(eq(s.groupMemberships.groupId, g.id), eq(s.groupMemberships.studentUserId, studentId), isNull(s.groupMemberships.leftAt))).limit(1))[0]),
  );
  const groups = myGroups
    .filter((_g, i) => Boolean(groupMemberships[i]))
    .map((g) => ({ id: g.id, name: g.name }));

  const allHomeworks = (await db.select().from(s.homeworks));
  const states = (await db.select().from(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)));
  const attempts = (await db.select().from(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)));
  const today = new Date().toISOString().slice(0, 10);

  const mine = new Set([...states.map((x) => x.homeworkId), ...attempts.map((a) => a.homeworkId)]);
  const homeworks = allHomeworks.filter((hw) => mine.has(hw.id)).map((hw) => {
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

  const results = (await db.select().from(s.ctResults).where(eq(s.ctResults.studentId, studentId))).sort((a, b) => a.date.localeCompare(b.date));

  const topicSums = new Map<string, { sum: number; n: number }>();
  results.forEach((r) => {
    Object.entries(r.topicAccuracy as Record<string, number>).forEach(([topicId, pct]) => {
      const e = topicSums.get(topicId) || { sum: 0, n: 0 };
      e.sum += pct;
      e.n += 1;
      topicSums.set(topicId, e);
    });
  });
  const topicAccuracy = await Promise.all((
    await Promise.all(
      Array.from(topicSums.entries()).map(async ([topicId, v]) => ({ topicId, topicName: (await db.select().from(s.topics).where(eq(s.topics.id, topicId)).limit(1))[0]?.name ?? topicId, accuracy: Math.round(v.sum / v.n) })),
    )
  ).sort((a, b) => a.accuracy - b.accuracy));

  const avg = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
  const lastActive = attempts.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), "");

  res.json({
    id: studentId, name: user.name, lastName: user.lastName, email: user.email,
    grade: student?.grade ?? 11, goalScore: student?.goalScore ?? 85, note: student?.note ?? null,
    startScore: student?.startScore ?? null, startGrade: student?.startGrade ?? null, goalGrade: student?.goalGrade ?? null,
    groups, avg, lastActive: lastActive || null, homeworks, results, topicAccuracy,
  });
});

teacherRouter.patch("/students/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const {
    name, lastName, grade, goalScore, startScore, startGrade, goalGrade, note,
    scheduleSubjectId, scheduleSlots, scheduleStartDate, scheduleEndDate, scheduleActive,
    scheduleFormat, scheduleLocation,
  } = req.body || {};
  if (name !== undefined || lastName !== undefined) {
    const userPatch: Partial<typeof s.users.$inferInsert> = {};
    if (name !== undefined && String(name).trim()) userPatch.name = String(name).trim();
    if (lastName !== undefined) userPatch.lastName = String(lastName).trim();
    (await db.update(s.users).set(userPatch).where(eq(s.users.id, studentId)));
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

  if (Object.keys(patch).length) (await db.update(s.students).set(patch).where(eq(s.students.userId, studentId)));
  await enforceStudentLessonLifecycle(studentId);
  if (scheduleSlots !== undefined) await reconcileStudentScheduleLessons(studentId);
  res.json({ ok: true });
});

teacherRouter.post("/students/:id/generate-lessons", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const student = (await db.select().from(s.students).where(eq(s.students.userId, studentId)).limit(1))[0];
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

  const seriesId = `student-schedule:${studentId}`;
  const existingPlanned = new Set(
    (await db.select({ plannedStart: s.lessons.plannedStart, startAt: s.lessons.startAt }).from(s.lessons).where(eq(s.lessons.seriesId, seriesId)))
      .map((l) => l.plannedStart ?? l.startAt),
  );

  const created: string[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= until) {
    const weekday = (cursor.getDay() + 6) % 7;
    const time = slotsByDay.get(weekday);
    if (time) {
      const plannedStart = `${cursor.toISOString().slice(0, 10)}T${time}`;
      if (!existingPlanned.has(plannedStart)) {
        const id = randomUUID();
        (await db.insert(s.lessons)
          .values({
            id, teacherId, groupId: null, studentId, title: "", startAt: plannedStart, plannedStart, overrideType: "none",
            durationMinutes: 60, format: student.scheduleFormat, location: student.scheduleLocation || "",
            status: "scheduled", seriesId, note: null, createdAt: new Date().toISOString(),
          })
          );
        created.push(id);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({ ok: true, created: created.length });
});

teacherRouter.delete("/students/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!(await teacherStudentIds(teacherId)).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  await db.transaction(async (tx) => {
    const individualLessonIds = (await tx.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.studentId, studentId))).map((l) => l.id);
    (await tx.delete(s.lessonAttendance).where(eq(s.lessonAttendance.studentId, studentId)));
    (await tx.delete(s.lessonParticipantOverrides).where(eq(s.lessonParticipantOverrides.studentId, studentId)));
    if (individualLessonIds.length) {
      (await tx.delete(s.lessonParticipantOverrides).where(inArray(s.lessonParticipantOverrides.lessonId, individualLessonIds)));
      (await tx.delete(s.lessons).where(inArray(s.lessons.id, individualLessonIds)));
    }
    (await tx.delete(s.groupMemberships).where(eq(s.groupMemberships.studentUserId, studentId)));
    (await tx.delete(s.studentFreezes).where(eq(s.studentFreezes.studentId, studentId)));
    (await tx.delete(s.studentInvites).where(eq(s.studentInvites.acceptedUserId, studentId)));
    (await tx.delete(s.homeworkState).where(eq(s.homeworkState.studentId, studentId)));
    (await tx.delete(s.homeworkAttempts).where(eq(s.homeworkAttempts.studentId, studentId)));
    (await tx.delete(s.attachments).where(eq(s.attachments.studentId, studentId)));
    (await tx.delete(s.teacherFeedback).where(eq(s.teacherFeedback.studentId, studentId)));
    (await tx.delete(s.ctSessions).where(eq(s.ctSessions.studentId, studentId)));
    (await tx.delete(s.ctResults).where(eq(s.ctResults.studentId, studentId)));
    (await tx.delete(s.theoryProgress).where(eq(s.theoryProgress.studentId, studentId)));
    (await tx.delete(s.techniqueProgress).where(eq(s.techniqueProgress.studentId, studentId)));
    (await tx.delete(s.reviewCards).where(eq(s.reviewCards.studentId, studentId)));
    (await tx.delete(s.gameRecords).where(eq(s.gameRecords.studentId, studentId)));
    (await tx.delete(s.parentLinks).where(eq(s.parentLinks.studentUserId, studentId)));
    (await tx.delete(s.notifications).where(eq(s.notifications.userId, studentId)));
    (await tx.delete(s.settings).where(eq(s.settings.userId, studentId)));
    (await tx.delete(s.passwordResets).where(eq(s.passwordResets.userId, studentId)));
    (await tx.delete(s.students).where(eq(s.students.userId, studentId)));
    (await tx.delete(s.users).where(eq(s.users.id, studentId)));
  });

  res.json({ ok: true });
});

teacherRouter.get("/review-queue", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentIds = await teacherStudentIds(teacherId);
  if (!studentIds.length) return res.json([]);

  const submitted = (await db
    .select()
    .from(s.homeworkState)
    .where(and(inArray(s.homeworkState.studentId, studentIds), isNotNull(s.homeworkState.submittedAt), isNull(s.homeworkState.reviewedAt)))
    );

  const queue = await Promise.all(submitted.map(async (hs) => {
    const user = (await db.select().from(s.users).where(eq(s.users.id, hs.studentId)).limit(1))[0]!;
    const hw = (await db.select().from(s.homeworks).where(eq(s.homeworks.id, hs.homeworkId)).limit(1))[0]!;
    const attempts = (await db.select().from(s.homeworkAttempts).where(and(eq(s.homeworkAttempts.studentId, hs.studentId), eq(s.homeworkAttempts.homeworkId, hs.homeworkId))));
    const manual = attempts.filter((a) => a.status === "manual").length;
    const hints = attempts.reduce((sum, a) => sum + a.hintsOpened, 0);
    // reduce() can't await, so count attachments with an explicit loop.
    let files = 0;
    for (const a of attempts) {
      files += (await db.select().from(s.attachments).where(and(eq(s.attachments.studentId, hs.studentId), eq(s.attachments.homeworkId, hs.homeworkId), eq(s.attachments.exerciseId, a.exerciseId)))).length;
    }
    return {
      id: `${hs.studentId}:${hs.homeworkId}`, studentId: hs.studentId, studentName: `${user.name} ${user.lastName}`.trim(),
      homeworkId: hs.homeworkId, title: hw.title, submittedAt: hs.submittedAt,
      answers: attempts.length, manual, files, hints,
    };
  }));

  res.json(queue);
});

teacherRouter.post("/review/:studentId/:homeworkId", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.studentId);
  const homeworkId = pstr(req.params.homeworkId);
  const { grade, comment, flagged } = req.body || {};

  const id = randomUUID();
  (await db.insert(s.teacherFeedback)
    .values({ id, studentId, homeworkId, teacherId, grade: grade || "", text: comment || "", flagged: flagged || [], createdAt: new Date().toISOString() })
    );
  (await db.update(s.homeworkState).set({ reviewedAt: new Date().toISOString() }).where(and(eq(s.homeworkState.studentId, studentId), eq(s.homeworkState.homeworkId, homeworkId))));

  const teacher = (await db.select().from(s.users).where(eq(s.users.id, teacherId)).limit(1))[0]!;
  const hw = (await db.select().from(s.homeworks).where(eq(s.homeworks.id, homeworkId)).limit(1))[0]!;
  (await db.insert(s.notifications)
    .values({ id: randomUUID(), userId: studentId, text: `${teacher.name} ${teacher.lastName} проверил${teacher.name.endsWith("а") ? "а" : ""} «${hw.title}»`, date: new Date().toISOString().slice(0, 10), kind: "feedback", read: false, homeworkId })
    );

  res.json({ ok: true, id });
});
