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
    direction: group.direction, goal: group.goal, scheduleNote: group.scheduleNote, startDate: group.startDate,
    color: group.color, maxStudents: group.maxStudents, hwDefaults: group.hwDefaults,
    students, avgScore, weakTopics, homeworkStats, upcomingLessons, recentLessons,
  });
});

function groupFieldsFromBody(body: any) {
  const patch: Partial<typeof s.groups.$inferInsert> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.subjectId !== undefined) patch.subjectId = body.subjectId;
  if (body.grade !== undefined) patch.grade = body.grade === null || body.grade === "" ? null : Number(body.grade);
  if (body.description !== undefined) patch.description = body.description && String(body.description).trim() ? String(body.description).trim() : null;
  if (body.direction !== undefined) patch.direction = body.direction || null;
  if (body.goal !== undefined) patch.goal = body.goal && String(body.goal).trim() ? String(body.goal).trim() : null;
  if (body.scheduleNote !== undefined) patch.scheduleNote = body.scheduleNote && String(body.scheduleNote).trim() ? String(body.scheduleNote).trim() : null;
  if (body.startDate !== undefined) patch.startDate = body.startDate || null;
  if (body.color !== undefined) patch.color = body.color || null;
  if (body.maxStudents !== undefined) patch.maxStudents = body.maxStudents === null || body.maxStudents === "" ? null : Number(body.maxStudents);
  if (body.hwDefaults !== undefined) patch.hwDefaults = body.hwDefaults || null;
  return patch;
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
  const { name, lastName, email, groupId, grade, goalScore, note } = req.body || {};
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
      teacherId,
      note: note && String(note).trim() ? String(note).trim() : null,
    })
    .run();
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
    groups, avg, lastActive: lastActive || null, homeworks, results, topicAccuracy,
  });
});

teacherRouter.patch("/students/:id", (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const studentId = pstr(req.params.id);
  if (!teacherStudentIds(teacherId).includes(studentId)) return res.status(404).json({ error: "Ученик не найден" });

  const { grade, goalScore, note } = req.body || {};
  const patch: Partial<typeof s.students.$inferInsert> = {};
  if (grade !== undefined) patch.grade = Number(grade);
  if (goalScore !== undefined) patch.goalScore = Number(goalScore);
  if (note !== undefined) patch.note = note && String(note).trim() ? String(note).trim() : null;

  db.update(s.students).set(patch).where(eq(s.students.userId, studentId)).run();
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
