// Перерасчёт и возврат при досрочном прекращении абонемента.
//
// Артур выбрал схему «CRM считает, Артур подтверждает», но самих правил не
// задавал, поэтому политика настраиваемая: по какой цене засчитывать
// проведённые занятия и сколько удерживать. Расчёт всегда возвращается
// с разбивкой — сумму нужно объяснить, а не просто показать.
import type { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import type { AuthedRequest } from "../auth.js";
import { pstr } from "../lib/params.js";

const now = () => new Date().toISOString();

export interface RefundPolicy {
  refundBasis: "SUBSCRIPTION" | "FULL";
  withholdPercent: number;
  withholdFixed: number;
}

const DEFAULT_POLICY: RefundPolicy = {
  refundBasis: "SUBSCRIPTION",
  withholdPercent: 0,
  withholdFixed: 0,
};

export async function policyFor(teacherId: string): Promise<RefundPolicy> {
  const row = (
    await db.select().from(s.crmSettings).where(eq(s.crmSettings.teacherId, teacherId)).limit(1)
  )[0];
  if (!row) return { ...DEFAULT_POLICY };
  return {
    refundBasis: row.refundBasis,
    withholdPercent: Number(row.withholdPercent),
    withholdFixed: Number(row.withholdFixed),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type SubRow = typeof s.subscriptions.$inferSelect;

/**
 * Сколько занятий по абонементу считать проведёнными. Берём из календаря:
 * состоявшиеся занятия месяца, где ученик был отмечен. Неявка без
 * уважительной причины занятие сжигает, отмеченная как «уважительная» — нет.
 * Число это только предложение: Артур правит его перед подтверждением.
 */
export async function lessonsUsedFromCalendar(sub: SubRow, accountId: string | null) {
  if (!accountId) return null;

  const periodEnd = new Date(
    Date.UTC(Number(sub.periodStart.slice(0, 4)), Number(sub.periodStart.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select({ id: s.lessons.id, startAt: s.lessons.startAt, status: s.lessons.status })
    .from(s.lessons)
    .where(eq(s.lessons.status, "done"));

  const inPeriod = rows.filter((l) => l.startAt >= sub.periodStart && l.startAt < periodEnd);
  if (inPeriod.length === 0) return 0;

  const attendance = await db
    .select()
    .from(s.lessonAttendance)
    .where(
      and(
        eq(s.lessonAttendance.studentId, accountId),
        inArray(
          s.lessonAttendance.lessonId,
          inPeriod.map((l) => l.id),
        ),
      ),
    );

  return attendance.filter((a) => a.status === "present" || a.status === "absent").length;
}

/** Разбивка возврата. Ничего не пишет — только считает. */
export function computeRefund(opts: {
  sub: SubRow;
  paidAmount: number;
  lessonsUsed: number;
  policy: RefundPolicy;
}) {
  const { sub, paidAmount, lessonsUsed, policy } = opts;
  const discount = Number(sub.discountPercent) / 100;
  const lessons = sub.lessonsCount || 1;

  // Полная стоимость занятия — до скидки; для фиксированного месяца делим
  // сумму месяца на число занятий.
  const fullPerLesson =
    sub.monthlyPrice != null ? Number(sub.monthlyPrice) / lessons : Number(sub.pricePerLesson);
  // По цене абонемента — то есть со скидкой.
  const subPerLesson = fullPerLesson * (1 - discount);
  const perLesson = policy.refundBasis === "FULL" ? fullPerLesson : subPerLesson;

  const used = Math.max(0, Math.min(lessonsUsed, lessons));
  const usedCost = round2(used * perLesson);
  const base = Math.max(0, paidAmount - usedCost);
  const withheld = round2(Math.min(base, base * (policy.withholdPercent / 100) + policy.withholdFixed));
  const amount = round2(Math.max(0, base - withheld));

  return {
    lessonsUsed: used,
    lessonsTotal: lessons,
    perLesson: round2(perLesson),
    usedCost,
    paidAmount: round2(paidAmount),
    withheld,
    amount,
    basis: policy.refundBasis,
  };
}

export function registerRefundRoutes(router: Router) {
  router.get("/settings", async (req: AuthedRequest, res) => {
    res.json(await policyFor(req.auth!.sub));
  });

  router.patch("/settings", async (req: AuthedRequest, res) => {
    const basis = req.body?.refundBasis === "FULL" ? "FULL" : "SUBSCRIPTION";
    const values = {
      teacherId: req.auth!.sub,
      refundBasis: basis as "SUBSCRIPTION" | "FULL",
      withholdPercent: String(Number(req.body?.withholdPercent) || 0),
      withholdFixed: String(Number(req.body?.withholdFixed) || 0),
      updatedAt: now(),
    };
    await db
      .insert(s.crmSettings)
      .values(values)
      .onConflictDoUpdate({ target: s.crmSettings.teacherId, set: values });
    res.json(await policyFor(req.auth!.sub));
  });

  /** Предварительный расчёт: показать Артуру, из чего сложилась сумма. */
  router.get("/subscriptions/:id/refund/preview", async (req: AuthedRequest, res) => {
    const sub = (
      await db.select().from(s.subscriptions).where(eq(s.subscriptions.id, pstr(req.params.id))).limit(1)
    )[0];
    if (!sub) return res.status(404).json({ error: "Абонемент не найден" });

    const student = (
      await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, sub.studentId)).limit(1)
    )[0];
    const payments = await db
      .select()
      .from(s.payments)
      .where(eq(s.payments.subscriptionId, sub.id));
    const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const suggested = await lessonsUsedFromCalendar(sub, student?.userId ?? null);
    const lessonsUsed =
      req.query?.lessonsUsed != null ? Number(req.query.lessonsUsed) : (suggested ?? 0);

    const policy = await policyFor(req.auth!.sub);
    res.json({
      ...computeRefund({ sub, paidAmount, lessonsUsed, policy }),
      // Откуда взялось предложенное число занятий — чтобы цифра не выглядела
      // взявшейся из ниоткуда.
      suggestedFromCalendar: suggested,
      linkedAccount: Boolean(student?.userId),
      policy,
    });
  });

  /** Подтверждение: записать возврат и закрыть абонемент. */
  router.post("/subscriptions/:id/refund", async (req: AuthedRequest, res) => {
    const id = pstr(req.params.id);
    const sub = (await db.select().from(s.subscriptions).where(eq(s.subscriptions.id, id)).limit(1))[0];
    if (!sub) return res.status(404).json({ error: "Абонемент не найден" });
    if (sub.terminatedAt) return res.status(409).json({ error: "Абонемент уже прекращён" });

    const payments = await db.select().from(s.payments).where(eq(s.payments.subscriptionId, id));
    const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const policy = await policyFor(req.auth!.sub);
    const calc = computeRefund({
      sub,
      paidAmount,
      lessonsUsed: Number(req.body?.lessonsUsed) || 0,
      policy,
    });

    await db.insert(s.refunds).values({
      id: randomUUID(),
      subscriptionId: id,
      lessonsUsed: calc.lessonsUsed,
      usedCost: String(calc.usedCost),
      paidAmount: String(calc.paidAmount),
      withheld: String(calc.withheld),
      amount: String(calc.amount),
      basis: calc.basis,
      note: typeof req.body?.note === "string" ? req.body.note.trim() || null : null,
      createdAt: now(),
    });
    await db.update(s.subscriptions).set({ terminatedAt: now() }).where(eq(s.subscriptions.id, id));

    res.json(calc);
  });
}
