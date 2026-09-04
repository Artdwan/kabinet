// Тарифы и автосоздание абонементов.
//
// Цены намеренно не зашиты в код: у центра они меняются и зависят от предмета,
// класса и того, первый ли это абонемент ученика. Артур заводит правила сам,
// а движок их подбирает и применяет.
import type { Router } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import type { AuthedRequest } from "../auth.js";
import { pstr } from "../lib/params.js";

const now = () => new Date().toISOString();
const str = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

type TariffRow = typeof s.tariffs.$inferSelect;

/** «9 класс» → 9. Класс в CRM — свободный текст, поэтому берём первое число. */
export function gradeNumber(grade: string): number | null {
  const m = grade.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Первое число следующего месяца, YYYY-MM-DD. */
export function nextPeriod(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
}

/** Подходящий тариф: по предмету, классу и тому, первый ли это абонемент. */
export function pickTariff(
  all: TariffRow[],
  opts: { subject: string; grade: string; isFirst: boolean },
): TariffRow | null {
  const g = gradeNumber(opts.grade);
  const matches = all
    .filter((t) => t.active)
    .filter((t) => !t.subject || t.subject === opts.subject)
    .filter((t) => {
      if (t.gradeFrom == null && t.gradeTo == null) return true;
      if (g == null) return false;
      return (t.gradeFrom == null || g >= t.gradeFrom) && (t.gradeTo == null || g <= t.gradeTo);
    })
    .filter(
      (t) => t.appliesTo === "ANY" || (opts.isFirst ? t.appliesTo === "FIRST" : t.appliesTo === "REPEAT"),
    );

  // Меньший priority выигрывает; при равенстве точнее считается более узкий
  // тариф — с указанным предметом и классом.
  const specificity = (t: TariffRow) =>
    (t.subject ? 1 : 0) + (t.gradeFrom != null || t.gradeTo != null ? 1 : 0);
  matches.sort((a, b) => a.priority - b.priority || specificity(b) - specificity(a));
  return matches[0] ?? null;
}

function tariffPatch(body: Record<string, unknown>) {
  const mode = body.mode === "FIXED_MONTH" ? "FIXED_MONTH" : "PER_LESSON";
  const appliesTo = body.appliesTo === "FIRST" ? "FIRST" : body.appliesTo === "REPEAT" ? "REPEAT" : "ANY";
  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
  return {
    name: str(body.name, "Без названия"),
    subject: str(body.subject) || null,
    gradeFrom: num(body.gradeFrom),
    gradeTo: num(body.gradeTo),
    appliesTo: appliesTo as "FIRST" | "REPEAT" | "ANY",
    mode: mode as "PER_LESSON" | "FIXED_MONTH",
    pricePerLesson: mode === "PER_LESSON" ? str(body.pricePerLesson) || null : null,
    monthlyPrice: mode === "FIXED_MONTH" ? str(body.monthlyPrice) || null : null,
    discountPercent: str(body.discountPercent, "0"),
    lessonsPerMonth: num(body.lessonsPerMonth),
    active: body.active !== false,
    priority: Number(body.priority ?? 100),
  };
}

const asNumber = (v: string | null) => (v == null ? null : Number(v));

/**
 * Абонементы на следующий месяц по тем, что уже есть: для каждой пары
 * ученик+предмет берётся последний абонемент, к нему подбирается тариф (уже
 * как к повторному) и переносится число занятий. Повторный запуск ничего не
 * дублирует — месяцы, которые уже заведены, пропускаются.
 */
export async function generateNextMonth(teacherId: string, period: string) {
  const clients = await db.select().from(s.clients).where(eq(s.clients.teacherId, teacherId));
  const clientIds = new Set(clients.map((c) => c.id));
  const students = (await db.select().from(s.crmStudents)).filter((st) => clientIds.has(st.clientId));
  const studentById = new Map(students.map((st) => [st.id, st]));
  const subs = (await db.select().from(s.subscriptions)).filter((sub) => studentById.has(sub.studentId));
  const tariffs = await db.select().from(s.tariffs).where(eq(s.tariffs.teacherId, teacherId));

  const latest = new Map<string, (typeof subs)[number]>();
  for (const sub of subs) {
    const key = `${sub.studentId}|${sub.subject}`;
    const cur = latest.get(key);
    if (!cur || sub.periodStart > cur.periodStart) latest.set(key, sub);
  }

  const created: { student: string; subject: string; total: number; tariff: string | null }[] = [];
  let skipped = 0;

  for (const prev of latest.values()) {
    // Досрочно прекращённый абонемент на следующий месяц не переносится.
    if (prev.terminatedAt) continue;
    if (prev.periodStart >= period) {
      skipped++;
      continue;
    }
    const student = studentById.get(prev.studentId)!;
    const t = pickTariff(tariffs, { subject: prev.subject, grade: student.grade, isFirst: false });

    const lessonsCount = t?.lessonsPerMonth ?? prev.lessonsCount;
    const mode = t ? t.mode : prev.monthlyPrice ? "FIXED_MONTH" : "PER_LESSON";
    const monthlyPrice = mode === "FIXED_MONTH" ? (t?.monthlyPrice ?? prev.monthlyPrice) : null;
    const pricePerLesson = t?.pricePerLesson ?? prev.pricePerLesson;
    // Скидка первого абонемента не тянется в следующий месяц — только та,
    // что задана подходящим (повторным) тарифом.
    const discountPercent = t ? t.discountPercent : "0";

    await db.insert(s.subscriptions).values({
      id: randomUUID(),
      studentId: prev.studentId,
      subject: prev.subject,
      periodStart: period,
      lessonsCount,
      monthlyPrice,
      pricePerLesson,
      discountPercent,
      createdAt: now(),
    });

    const base = monthlyPrice ? Number(monthlyPrice) : lessonsCount * Number(pricePerLesson);
    created.push({
      student: student.name,
      subject: prev.subject,
      total: base * (1 - Number(discountPercent) / 100),
      tariff: t?.name ?? null,
    });
  }

  return { period, created, skipped };
}

export function registerTariffRoutes(router: Router) {
  router.get("/tariffs", async (req: AuthedRequest, res) => {
    const rows = await db.select().from(s.tariffs).where(eq(s.tariffs.teacherId, req.auth!.sub));
    res.json(
      rows
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
        .map((t) => ({
          ...t,
          pricePerLesson: asNumber(t.pricePerLesson),
          monthlyPrice: asNumber(t.monthlyPrice),
          discountPercent: Number(t.discountPercent),
        })),
    );
  });

  router.post("/tariffs", async (req: AuthedRequest, res) => {
    const patch = tariffPatch(req.body ?? {});
    if (patch.mode === "PER_LESSON" && !patch.pricePerLesson) {
      return res.status(400).json({ error: "Укажите цену за занятие" });
    }
    if (patch.mode === "FIXED_MONTH" && !patch.monthlyPrice) {
      return res.status(400).json({ error: "Укажите стоимость месяца" });
    }
    const id = randomUUID();
    await db.insert(s.tariffs).values({ id, teacherId: req.auth!.sub, ...patch, createdAt: now() });
    res.json({ id });
  });

  router.patch("/tariffs/:id", async (req: AuthedRequest, res) => {
    const id = pstr(req.params.id);
    const existing = (
      await db
        .select()
        .from(s.tariffs)
        .where(and(eq(s.tariffs.id, id), eq(s.tariffs.teacherId, req.auth!.sub)))
        .limit(1)
    )[0];
    if (!existing) return res.status(404).json({ error: "Тариф не найден" });
    await db.update(s.tariffs).set(tariffPatch(req.body ?? {})).where(eq(s.tariffs.id, id));
    res.json({ ok: true });
  });

  router.delete("/tariffs/:id", async (req: AuthedRequest, res) => {
    await db
      .delete(s.tariffs)
      .where(and(eq(s.tariffs.id, pstr(req.params.id)), eq(s.tariffs.teacherId, req.auth!.sub)));
    res.json({ ok: true });
  });

  /** Что подставить в форму нового абонемента. */
  router.get("/tariffs/suggest", async (req: AuthedRequest, res) => {
    const studentId = str(req.query?.studentId as string);
    const subject = str(req.query?.subject as string);
    if (!studentId || !subject) return res.status(400).json({ error: "Нужны ученик и предмет" });

    const student = (
      await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, studentId)).limit(1)
    )[0];
    if (!student) return res.status(404).json({ error: "Ученик не найден" });

    const prior = await db.select().from(s.subscriptions).where(eq(s.subscriptions.studentId, studentId));
    const all = await db.select().from(s.tariffs).where(eq(s.tariffs.teacherId, req.auth!.sub));
    const isFirst = prior.length === 0;
    const t = pickTariff(all, { subject, grade: student.grade, isFirst });

    res.json(
      t
        ? {
            tariffId: t.id,
            name: t.name,
            mode: t.mode,
            isFirst,
            pricePerLesson: asNumber(t.pricePerLesson),
            monthlyPrice: asNumber(t.monthlyPrice),
            discountPercent: Number(t.discountPercent),
            lessonsPerMonth: t.lessonsPerMonth,
          }
        : { tariffId: null, isFirst },
    );
  });

  router.post("/subscriptions/generate", async (req: AuthedRequest, res) => {
    const period = str(req.body?.period) || nextPeriod();
    res.json(await generateNextMonth(req.auth!.sub, period));
  });
}
