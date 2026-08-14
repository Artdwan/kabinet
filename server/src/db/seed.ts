import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db, sqlite } from "./client.js";
import * as s from "./schema.js";
import { CT_TESTS, HOMEWORKS, REVIEW_CARD_DEFS, SUBJECTS, TECHNIQUES, THEORY_MATERIALS, TOPICS, TRAINERS } from "./seedContent.js";

const now = () => new Date().toISOString();
const hash = (pw: string) => bcrypt.hashSync(pw, 10);

function seedContent() {
  db.insert(s.subjects).values(SUBJECTS).onConflictDoNothing().run();
  db.insert(s.topics).values(TOPICS).onConflictDoNothing().run();
  db.insert(s.homeworks)
    .values(HOMEWORKS.map((h) => ({ ...h, sections: h.sections })))
    .onConflictDoNothing()
    .run();
  db.insert(s.theoryMaterials)
    .values(THEORY_MATERIALS.map((m) => ({ ...m, isNew: m.isNew })))
    .onConflictDoNothing()
    .run();
  db.insert(s.ctTests).values(CT_TESTS as (typeof s.ctTests.$inferInsert)[]).onConflictDoNothing().run();
  db.insert(s.techniques).values(TECHNIQUES).onConflictDoNothing().run();
  db.insert(s.trainers).values(TRAINERS as (typeof s.trainers.$inferInsert)[]).onConflictDoNothing().run();
  db.insert(s.reviewCardDefs).values(REVIEW_CARD_DEFS).onConflictDoNothing().run();
}

function upsertUser(u: { id: string; role: "student" | "teacher" | "parent"; email: string; password: string; name: string; lastName: string; extra: string }) {
  db.insert(s.users)
    .values({ id: u.id, role: u.role, email: u.email, passwordHash: hash(u.password), name: u.name, lastName: u.lastName, extra: u.extra, createdAt: now() })
    .onConflictDoNothing()
    .run();
  db.insert(s.settings).values({ userId: u.id, instantCheck: true, reduceMotion: false, compactCards: false }).onConflictDoNothing().run();
}

function seedDemoAccounts() {
  const DEMO_PASSWORD = "demo1234";

  upsertUser({ id: "acc-tc", role: "teacher", email: "irina@demo", password: DEMO_PASSWORD, name: "Ирина", lastName: "Петровна", extra: "Математика и химия · 2 группы" });
  upsertUser({ id: "acc-st", role: "student", email: "maksim@demo", password: DEMO_PASSWORD, name: "Максим", lastName: "Ковалевич", extra: "11 класс · математика, химия" });
  upsertUser({ id: "acc-pr", role: "parent", email: "parent@demo", password: DEMO_PASSWORD, name: "Елена", lastName: "Ковалевич", extra: "Родитель Максима" });

  db.insert(s.students).values({ userId: "acc-st", grade: 11, city: "Минск", goalScore: 85, teacherId: "acc-tc" }).onConflictDoNothing().run();
  db.insert(s.parentLinks).values({ parentUserId: "acc-pr", studentUserId: "acc-st" }).onConflictDoNothing().run();

  db.insert(s.groups).values({ id: "gr-11a", name: "11 «А» · ЦТ математика", teacherId: "acc-tc", subjectId: "math" }).onConflictDoNothing().run();
  db.insert(s.groups).values({ id: "gr-chem", name: "Химия · интенсив", teacherId: "acc-tc", subjectId: "chem" }).onConflictDoNothing().run();
  db.insert(s.groupMembers).values({ groupId: "gr-11a", studentUserId: "acc-st" }).onConflictDoNothing().run();
  db.insert(s.groupMembers).values({ groupId: "gr-chem", studentUserId: "acc-st" }).onConflictDoNothing().run();

  // A few lightweight classmates so the teacher's roster/review queue isn't empty.
  const classmates = [
    { id: "st-1002", name: "Алина", lastName: "Дубровская", goal: 90, groups: ["gr-11a"], results: [82, 79] },
    { id: "st-1003", name: "Егор", lastName: "Савченко", goal: 75, groups: ["gr-11a"], results: [58, 61] },
    { id: "st-1004", name: "Полина", lastName: "Жук", goal: 80, groups: ["gr-11a"], results: [66, 70] },
    { id: "st-1005", name: "Илья", lastName: "Морозов", goal: 70, groups: ["gr-chem"], results: [49] },
  ];
  for (const c of classmates) {
    upsertUser({ id: c.id, role: "student", email: `${c.id}@demo`, password: DEMO_PASSWORD, name: c.name, lastName: c.lastName, extra: "11 класс" });
    db.insert(s.students).values({ userId: c.id, grade: 11, city: "Минск", goalScore: c.goal, teacherId: "acc-tc" }).onConflictDoNothing().run();
    for (const g of c.groups) db.insert(s.groupMembers).values({ groupId: g, studentUserId: c.id }).onConflictDoNothing().run();
    c.results.forEach((score, i) => {
      db.insert(s.ctResults)
        .values({
          id: `res-${c.id}-${i}`,
          studentId: c.id,
          testId: "ct-frac",
          title: "Дробные уравнения — тренировка",
          subjectId: "math",
          date: `2026-0${7 + i}-15`,
          score,
          minutes: 18,
          topicAccuracy: { "tp-frac": score },
        })
        .onConflictDoNothing()
        .run();
    });
  }
  // st-1002 has a homework submitted and awaiting review, to populate the teacher's queue.
  db.insert(s.homeworkState)
    .values({ studentId: "st-1002", homeworkId: "hw-02", startedAt: "2026-08-05T10:00:00", submittedAt: "2026-08-12T18:00:00" })
    .onConflictDoNothing()
    .run();

  seedMaximProgress();
}

function seedMaximProgress() {
  const student = "acc-st";

  db.insert(s.homeworkState).values({ studentId: student, homeworkId: "hw-02", startedAt: "2026-08-08T18:20:00", submittedAt: null }).onConflictDoNothing().run();
  db.insert(s.homeworkState).values({ studentId: student, homeworkId: "hw-01", startedAt: "2026-07-21T17:00:00", submittedAt: "2026-07-27T21:10:00", reviewedAt: "2026-08-11T12:00:00" }).onConflictDoNothing().run();
  db.insert(s.homeworkState).values({ studentId: student, homeworkId: "hw-04", startedAt: "2026-08-05T19:00:00", submittedAt: "2026-08-09T20:30:00" }).onConflictDoNothing().run();

  const attempts: (typeof s.homeworkAttempts.$inferInsert)[] = [
    { studentId: student, homeworkId: "hw-02", exerciseId: "hw02-a1", value: "9", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-02", exerciseId: "hw02-a2", value: "56", status: "correct", attempts: 2, hintsOpened: 1, solutionOpened: false, draftText: "5k + 7k = 96", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-02", exerciseId: "hw02-a3", value: "o2", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-02", exerciseId: "hw02-b1", value: "4", status: "wrong", attempts: 1, hintsOpened: 1, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-01", exerciseId: "hw01-a1", value: "8", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-01", exerciseId: "hw01-a2", value: "1", status: "wrong", attempts: 3, hintsOpened: 2, solutionOpened: true, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-01", exerciseId: "hw01-a3", value: "6", status: "correct", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-04", exerciseId: "hw04-a1", value: "18", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-04", exerciseId: "hw04-a2", value: "o1", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
    { studentId: student, homeworkId: "hw-04", exerciseId: "hw04-a3", value: "уменьшается", status: "manual", attempts: 1, hintsOpened: 0, solutionOpened: false, draftText: "", drawing: null, updatedAt: now() },
  ];
  for (const a of attempts) db.insert(s.homeworkAttempts).values(a).onConflictDoNothing().run();

  db.insert(s.teacherFeedback)
    .values({
      id: "fb-1", studentId: student, homeworkId: "hw-01", teacherId: "acc-tc", grade: "8 / 10",
      text: "Максим, уравнения решены аккуратно. В задании 2 потерян случай a = 0 — разбери его ещё раз, на ЦТ такой пункт встречается часто. Систему решил верно и быстро.",
      flagged: [{ exerciseId: "hw01-a2", note: "Разбери случай a = 0 и перепиши вывод в тетрадь." }],
      createdAt: "2026-08-11T12:00:00",
    })
    .onConflictDoNothing()
    .run();

  db.insert(s.ctSessions)
    .values({ studentId: student, testId: "ct-solut", startedAt: "2026-08-12T19:40:00", answers: { q1: "15", q2: "o1" }, flagged: { q4: true }, current: 2, elapsed: 214, finishedAt: null, only: null })
    .onConflictDoNothing()
    .run();

  const results: { id: string; testId: string; title: string; subjectId: string; date: string; score: number; minutes: number; topicAccuracy: Record<string, number> }[] = [
    { id: "res-1", testId: "ct-lin", title: "Линейные уравнения", subjectId: "math", date: "2026-05-18", score: 64, minutes: 21, topicAccuracy: { "tp-lin": 64 } },
    { id: "res-2", testId: "ct-perc", title: "Проценты и пропорции", subjectId: "math", date: "2026-06-06", score: 68, minutes: 19, topicAccuracy: { "tp-perc": 68, "tp-prop": 72 } },
    { id: "res-3", testId: "ct-atom", title: "Строение атома", subjectId: "chem", date: "2026-06-27", score: 73, minutes: 17, topicAccuracy: { "tp-atom": 84 } },
    { id: "res-4", testId: "ct-full-math", title: "Полный вариант ЦТ, математика", subjectId: "math", date: "2026-07-19", score: 76, minutes: 164, topicAccuracy: { "tp-lin": 88, "tp-frac": 48, "tp-perc": 66, "tp-prop": 72 } },
    { id: "res-5", testId: "ct-solut", title: "Растворы", subjectId: "chem", date: "2026-08-06", score: 74, minutes: 16, topicAccuracy: { "tp-solut": 52 } },
  ];
  for (const r of results) db.insert(s.ctResults).values({ ...r, studentId: student }).onConflictDoNothing().run();

  db.insert(s.theoryProgress).values({ studentId: student, materialId: "th-prop", progress: 60, favorite: true, read: false, lastBlock: 4, quiz: {} }).onConflictDoNothing().run();
  db.insert(s.theoryProgress).values({ studentId: student, materialId: "th-solut", progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} }).onConflictDoNothing().run();

  db.insert(s.techniqueProgress).values({ studentId: student, techniqueId: "tq-feynman", practiced: 2, done: [0, 1] }).onConflictDoNothing().run();

  db.insert(s.gameRecords).values({ studentId: student, trainerId: "tr-equations", best: 7, played: 3, lastScore: 5 }).onConflictDoNothing().run();
  db.insert(s.gameRecords).values({ studentId: student, trainerId: "tr-color", best: 8, played: 1, lastScore: 8 }).onConflictDoNothing().run();

  const REVIEW_CARDS_SEED = [
    { id: "rc-1", box: 2, due: "2026-08-14" },
    { id: "rc-2", box: 1, due: "2026-08-13" },
    { id: "rc-3", box: 3, due: "2026-08-16" },
    { id: "rc-4", box: 3, due: "2026-08-17" },
    { id: "rc-5", box: 5, due: "2026-08-27" },
  ];
  for (const c of REVIEW_CARDS_SEED) db.insert(s.reviewCards).values({ studentId: student, cardId: c.id, box: c.box, due: c.due }).onConflictDoNothing().run();

  db.insert(s.notifications)
    .values([
      { id: randomUUID(), userId: student, text: "Ирина Петровна проверила «Тетрадь 01 — Линейные уравнения»", date: "2026-08-11", kind: "feedback", read: false, homeworkId: "hw-01" },
      { id: randomUUID(), userId: student, text: "Назначена новая работа по химии: «Растворы»", date: "2026-08-10", kind: "assign", read: false, homeworkId: "hw-03" },
    ])
    .onConflictDoNothing()
    .run();
}

seedContent();
seedDemoAccounts();
sqlite.close();
console.log("Seed complete.");
