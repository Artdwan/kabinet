// CRM: воронка лидов, клиенты-плательщики, их дети, абонементы и оплаты.
// Перенесено из отдельного приложения my-crm; здесь всё живёт в той же базе
// и под тем же логином преподавателя, что и учебная часть.
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";
import { pstr, uploadName } from "../lib/params.js";
import { registerTariffRoutes } from "./crm-tariffs.js";

export const crmRouter = Router();
crmRouter.use(requireAuth, requireRole("teacher"));

// Чеки лежат в базе, поэтому файл держим в памяти, а не на диске.
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES },
});

const now = () => new Date().toISOString();
const str = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

const LEAD_STATUSES = s.leadStatuses as readonly string[];
function leadStatus(v: unknown): (typeof s.leadStatuses)[number] | null {
  return typeof v === "string" && LEAD_STATUSES.includes(v)
    ? (v as (typeof s.leadStatuses)[number])
    : null;
}

// ---------------------------------------------------------------------------
// Лиды
// ---------------------------------------------------------------------------

crmRouter.get("/leads", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const rows = await db
    .select()
    .from(s.leads)
    .where(eq(s.leads.teacherId, teacherId))
    .orderBy(desc(s.leads.createdAt));
  // Клиент, созданный из лида, — чтобы на карточке не предлагать конвертацию дважды.
  const clients = await db
    .select({ id: s.clients.id, fromLeadId: s.clients.fromLeadId })
    .from(s.clients)
    .where(eq(s.clients.teacherId, teacherId));
  res.json(
    rows.map((l) => ({
      ...l,
      clientId: clients.find((c) => c.fromLeadId === l.id)?.id ?? null,
    })),
  );
});

crmRouter.post("/leads", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const name = str(req.body?.name);
  if (!name) return res.status(400).json({ error: "Укажите имя или ник" });
  const id = randomUUID();
  const ts = now();
  await db.insert(s.leads).values({
    id,
    teacherId,
    name,
    who: str(req.body?.who, "новое обращение"),
    grade: str(req.body?.grade, "Класс не указан"),
    subject: str(req.body?.subject),
    channel: str(req.body?.channel),
    status: "NEW",
    sub: str(req.body?.sub, "Новый диалог"),
    task: str(req.body?.task) || null,
    createdAt: ts,
    updatedAt: ts,
  });
  res.json((await db.select().from(s.leads).where(eq(s.leads.id, id)).limit(1))[0]);
});

crmRouter.patch("/leads/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const id = pstr(req.params.id);
  const lead = (
    await db.select().from(s.leads).where(and(eq(s.leads.id, id), eq(s.leads.teacherId, teacherId))).limit(1)
  )[0];
  if (!lead) return res.status(404).json({ error: "Лид не найден" });

  const patch: Partial<typeof s.leads.$inferInsert> = { updatedAt: now() };
  const status = leadStatus(req.body?.status);
  if (status) patch.status = status;
  if (typeof req.body?.sub === "string") patch.sub = str(req.body.sub);
  if (typeof req.body?.task === "string") patch.task = str(req.body.task) || null;

  await db.update(s.leads).set(patch).where(eq(s.leads.id, id));
  res.json((await db.select().from(s.leads).where(eq(s.leads.id, id)).limit(1))[0]);
});

// Лид на этапе «Итог» превращается в плательщика и первого ребёнка: заявка
// описывает ребёнка, даже когда пишет родитель.
crmRouter.post("/leads/:id/convert", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const leadId = pstr(req.params.id);
  const lead = (
    await db.select().from(s.leads).where(and(eq(s.leads.id, leadId), eq(s.leads.teacherId, teacherId))).limit(1)
  )[0];
  if (!lead) return res.status(404).json({ error: "Лид не найден" });

  const existing = (
    await db.select().from(s.clients).where(eq(s.clients.fromLeadId, leadId)).limit(1)
  )[0];
  if (existing) return res.json(existing);

  const clientId = randomUUID();
  await db.insert(s.clients).values({
    id: clientId,
    teacherId,
    name: lead.name,
    who: lead.who,
    channel: lead.channel,
    phone: null,
    fromLeadId: leadId,
    createdAt: now(),
  });
  await db.insert(s.crmStudents).values({
    id: randomUUID(),
    clientId,
    name: lead.name,
    grade: lead.grade,
    userId: null,
    createdAt: now(),
  });
  res.json((await db.select().from(s.clients).where(eq(s.clients.id, clientId)).limit(1))[0]);
});

// ---------------------------------------------------------------------------
// Клиенты и их дети
// ---------------------------------------------------------------------------

/** Клиенты с детьми, абонементами и оплатами. receiptData не выбираем: иначе
 *  каждая загрузка страницы тянула бы из базы все файлы чеков. */
async function clientsWithNested(teacherId: string) {
  const clients = await db
    .select()
    .from(s.clients)
    .where(eq(s.clients.teacherId, teacherId))
    .orderBy(desc(s.clients.createdAt));
  if (!clients.length) return [];

  const students = await db.select().from(s.crmStudents);
  const subs = await db.select().from(s.subscriptions);
  const pays = await db
    .select({
      id: s.payments.id,
      subscriptionId: s.payments.subscriptionId,
      amount: s.payments.amount,
      paidAt: s.payments.paidAt,
      note: s.payments.note,
      receiptName: s.payments.receiptName,
    })
    .from(s.payments);

  return clients.map((c) => ({
    ...c,
    students: students
      .filter((st) => st.clientId === c.id)
      .map((st) => ({
        ...st,
        subscriptions: subs
          .filter((sub) => sub.studentId === st.id)
          .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
          .map((sub) => ({
            ...sub,
            pricePerLesson: Number(sub.pricePerLesson),
            monthlyPrice: sub.monthlyPrice == null ? null : Number(sub.monthlyPrice),
            discountPercent: Number(sub.discountPercent),
            payments: pays
              .filter((p) => p.subscriptionId === sub.id)
              .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
              .map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                paidAt: p.paidAt,
                note: p.note,
                hasReceipt: p.receiptName !== null,
              })),
          })),
      })),
  }));
}

crmRouter.get("/clients", async (req: AuthedRequest, res) => {
  res.json(await clientsWithNested(req.auth!.sub));
});

crmRouter.post("/clients", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const name = str(req.body?.name);
  if (!name) return res.status(400).json({ error: "Укажите имя" });
  const id = randomUUID();
  await db.insert(s.clients).values({
    id,
    teacherId,
    name,
    who: str(req.body?.who, "клиент"),
    channel: str(req.body?.channel),
    phone: str(req.body?.phone) || null,
    fromLeadId: null,
    createdAt: now(),
  });
  res.json((await db.select().from(s.clients).where(eq(s.clients.id, id)).limit(1))[0]);
});

/** Ученики CRM вместе с плательщиком и — если есть связь — учебным аккаунтом. */
crmRouter.get("/students", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const clients = await db.select().from(s.clients).where(eq(s.clients.teacherId, teacherId));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const students = (await db.select().from(s.crmStudents)).filter((st) => byId.has(st.clientId));
  const subs = await db.select().from(s.subscriptions);

  const linked = await Promise.all(
    students.map(async (st) => {
      if (!st.userId) return null;
      const u = (await db.select().from(s.users).where(eq(s.users.id, st.userId)).limit(1))[0];
      const sd = (await db.select().from(s.students).where(eq(s.students.userId, st.userId)).limit(1))[0];
      return u ? { name: `${u.name} ${u.lastName}`.trim(), grade: sd?.grade ?? null, goalScore: sd?.goalScore ?? null } : null;
    }),
  );

  res.json(
    students.map((st, i) => {
      const c = byId.get(st.clientId)!;
      return {
        ...st,
        client: { id: c.id, name: c.name, who: c.who, phone: c.phone },
        subscriptionCount: subs.filter((sub) => sub.studentId === st.id).length,
        account: linked[i],
      };
    }),
  );
});

crmRouter.post("/students", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const clientId = str(req.body?.clientId);
  const name = str(req.body?.name);
  if (!clientId || !name) return res.status(400).json({ error: "Укажите клиента и имя ученика" });
  const client = (
    await db.select().from(s.clients).where(and(eq(s.clients.id, clientId), eq(s.clients.teacherId, teacherId))).limit(1)
  )[0];
  if (!client) return res.status(404).json({ error: "Клиент не найден" });

  const id = randomUUID();
  await db.insert(s.crmStudents).values({
    id,
    clientId,
    name,
    grade: str(req.body?.grade, "Класс не указан"),
    userId: str(req.body?.userId) || null,
    createdAt: now(),
  });
  res.json((await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, id)).limit(1))[0]);
});

crmRouter.patch("/students/:id", async (req: AuthedRequest, res) => {
  const id = pstr(req.params.id);
  const student = (await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, id)).limit(1))[0];
  if (!student) return res.status(404).json({ error: "Ученик не найден" });

  const patch: Partial<typeof s.crmStudents.$inferInsert> = {};
  if (typeof req.body?.name === "string") patch.name = str(req.body.name);
  if (typeof req.body?.grade === "string") patch.grade = str(req.body.grade, "Класс не указан");
  if ("userId" in (req.body ?? {})) patch.userId = str(req.body.userId) || null;

  await db.update(s.crmStudents).set(patch).where(eq(s.crmStudents.id, id));
  res.json((await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, id)).limit(1))[0]);
});

crmRouter.delete("/students/:id", async (req: AuthedRequest, res) => {
  await db.delete(s.crmStudents).where(eq(s.crmStudents.id, pstr(req.params.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Абонементы
// ---------------------------------------------------------------------------

crmRouter.get("/subscriptions", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const clients = await db.select().from(s.clients).where(eq(s.clients.teacherId, teacherId));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const students = (await db.select().from(s.crmStudents)).filter((st) => clientById.has(st.clientId));
  const studentById = new Map(students.map((st) => [st.id, st]));

  const subs = (await db.select().from(s.subscriptions)).filter((sub) => studentById.has(sub.studentId));
  const pays = await db
    .select({
      id: s.payments.id,
      subscriptionId: s.payments.subscriptionId,
      amount: s.payments.amount,
      paidAt: s.payments.paidAt,
      note: s.payments.note,
      receiptName: s.payments.receiptName,
    })
    .from(s.payments);

  res.json(
    subs
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((sub) => {
        const st = studentById.get(sub.studentId)!;
        const c = clientById.get(st.clientId)!;
        return {
          ...sub,
          pricePerLesson: Number(sub.pricePerLesson),
          monthlyPrice: sub.monthlyPrice == null ? null : Number(sub.monthlyPrice),
          discountPercent: Number(sub.discountPercent),
          student: { id: st.id, name: st.name, grade: st.grade, client: { id: c.id, name: c.name } },
          payments: pays
            .filter((p) => p.subscriptionId === sub.id)
            .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
            .map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              paidAt: p.paidAt,
              note: p.note,
              hasReceipt: p.receiptName !== null,
            })),
        };
      }),
  );
});

crmRouter.post("/subscriptions", async (req: AuthedRequest, res) => {
  const studentId = str(req.body?.studentId);
  const subject = str(req.body?.subject);
  // Из <input type="month"> приходит YYYY-MM.
  const period = str(req.body?.periodStart);
  const lessonsCount = Number(req.body?.lessonsCount);
  const pricePerLesson = str(req.body?.pricePerLesson);
  // Фиксированная стоимость месяца: если задана, число занятий остаётся
  // справочным и в расчёт суммы не входит.
  const monthlyPrice = str(req.body?.monthlyPrice) || null;
  if (!studentId || !subject || !period || !lessonsCount || (!pricePerLesson && !monthlyPrice)) {
    return res
      .status(400)
      .json({ error: "Заполните ученика, предмет, период, количество занятий и цену" });
  }
  const student = (await db.select().from(s.crmStudents).where(eq(s.crmStudents.id, studentId)).limit(1))[0];
  if (!student) return res.status(404).json({ error: "Ученик не найден" });

  const periodStart = period.length === 7 ? `${period}-01` : period;
  const dup = (
    await db
      .select()
      .from(s.subscriptions)
      .where(
        and(
          eq(s.subscriptions.studentId, studentId),
          eq(s.subscriptions.subject, subject),
          eq(s.subscriptions.periodStart, periodStart),
        ),
      )
      .limit(1)
  )[0];
  if (dup) return res.status(409).json({ error: "Такой абонемент уже есть" });

  const id = randomUUID();
  await db.insert(s.subscriptions).values({
    id,
    studentId,
    subject,
    periodStart,
    lessonsCount,
    monthlyPrice,
    pricePerLesson: pricePerLesson || "0",
    discountPercent: str(req.body?.discountPercent, "0"),
    createdAt: now(),
  });
  res.json((await db.select().from(s.subscriptions).where(eq(s.subscriptions.id, id)).limit(1))[0]);
});

// ---------------------------------------------------------------------------
// Оплаты
// ---------------------------------------------------------------------------

crmRouter.post("/payments", receiptUpload.single("receipt"), async (req: AuthedRequest, res) => {
  const subscriptionId = str(req.body?.subscriptionId);
  const amount = str(req.body?.amount);
  const paidAt = str(req.body?.paidAt);
  if (!subscriptionId || !amount || !paidAt) {
    return res.status(400).json({ error: "Укажите абонемент, сумму и дату" });
  }
  const sub = (await db.select().from(s.subscriptions).where(eq(s.subscriptions.id, subscriptionId)).limit(1))[0];
  if (!sub) return res.status(404).json({ error: "Абонемент не найден" });

  const file = req.file;
  const keepReceipt =
    file && file.size > 0 && (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf");

  const id = randomUUID();
  await db.insert(s.payments).values({
    id,
    subscriptionId,
    amount,
    paidAt,
    note: str(req.body?.note) || null,
    receiptName: keepReceipt ? uploadName(file!.originalname) : null,
    receiptType: keepReceipt ? file!.mimetype : null,
    receiptData: keepReceipt ? file!.buffer : null,
    createdAt: now(),
  });
  res.json({ id, hasReceipt: Boolean(keepReceipt) });
});

crmRouter.delete("/payments/:id", async (req: AuthedRequest, res) => {
  await db.delete(s.payments).where(eq(s.payments.id, pstr(req.params.id)));
  res.json({ ok: true });
});

crmRouter.get("/payments/:id/receipt", async (req: AuthedRequest, res) => {
  const p = (
    await db
      .select({ name: s.payments.receiptName, type: s.payments.receiptType, data: s.payments.receiptData })
      .from(s.payments)
      .where(eq(s.payments.id, pstr(req.params.id)))
      .limit(1)
  )[0];
  if (!p?.data) return res.status(404).json({ error: "Чек не найден" });
  res.setHeader("Content-Type", p.type || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(p.name || "receipt")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(p.data);
});

// ---------------------------------------------------------------------------
// Шаблоны ответов
// ---------------------------------------------------------------------------

crmRouter.get("/templates", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(s.templates).where(eq(s.templates.teacherId, req.auth!.sub));
  res.json(rows.sort((a, b) => (a.stage ?? "я").localeCompare(b.stage ?? "я") || a.title.localeCompare(b.title)));
});

crmRouter.post("/templates", async (req: AuthedRequest, res) => {
  const title = str(req.body?.title);
  const body = str(req.body?.body);
  if (!title || !body) return res.status(400).json({ error: "Укажите название и текст" });
  const id = randomUUID();
  const ts = now();
  await db.insert(s.templates).values({
    id,
    teacherId: req.auth!.sub,
    title,
    body,
    stage: leadStatus(req.body?.stage),
    createdAt: ts,
    updatedAt: ts,
  });
  res.json((await db.select().from(s.templates).where(eq(s.templates.id, id)).limit(1))[0]);
});

crmRouter.patch("/templates/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const id = pstr(req.params.id);
  const existing = (
    await db.select().from(s.templates).where(and(eq(s.templates.id, id), eq(s.templates.teacherId, teacherId))).limit(1)
  )[0];
  if (!existing) return res.status(404).json({ error: "Шаблон не найден" });

  const title = str(req.body?.title);
  const body = str(req.body?.body);
  if (!title || !body) return res.status(400).json({ error: "Укажите название и текст" });

  await db
    .update(s.templates)
    .set({ title, body, stage: leadStatus(req.body?.stage), updatedAt: now() })
    .where(eq(s.templates.id, id));
  res.json((await db.select().from(s.templates).where(eq(s.templates.id, id)).limit(1))[0]);
});

crmRouter.delete("/templates/:id", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  await db
    .delete(s.templates)
    .where(and(eq(s.templates.id, pstr(req.params.id)), eq(s.templates.teacherId, teacherId)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Реклама и показатели воронки
// ---------------------------------------------------------------------------

const bynOf = (amount: string, rate: string) => Number(amount) * Number(rate);

crmRouter.get("/ad-spend", async (req: AuthedRequest, res) => {
  const rows = await db
    .select()
    .from(s.adSpend)
    .where(eq(s.adSpend.teacherId, req.auth!.sub))
    .orderBy(desc(s.adSpend.spentOn));
  res.json(
    rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      rate: Number(r.rate),
      amountByn: bynOf(r.amount, r.rate),
    })),
  );
});

crmRouter.post("/ad-spend", async (req: AuthedRequest, res) => {
  const spentOn = str(req.body?.spentOn);
  const amount = str(req.body?.amount);
  if (!spentOn || !amount) return res.status(400).json({ error: "Укажите дату и сумму" });

  const currency = req.body?.currency === "USD" ? "USD" : "BYN";
  // Для BYN курс всегда 1 — вводить его вручную незачем.
  const rate = currency === "BYN" ? "1" : str(req.body?.rate);
  if (currency === "USD" && (!rate || Number(rate) <= 0)) {
    return res.status(400).json({ error: "Укажите курс НБРБ на дату расхода" });
  }

  const id = randomUUID();
  await db.insert(s.adSpend).values({
    id,
    teacherId: req.auth!.sub,
    spentOn,
    channel: str(req.body?.channel),
    amount,
    currency,
    rate,
    note: str(req.body?.note) || null,
    createdAt: now(),
  });
  res.json({ id });
});

crmRouter.delete("/ad-spend/:id", async (req: AuthedRequest, res) => {
  await db
    .delete(s.adSpend)
    .where(and(eq(s.adSpend.id, pstr(req.params.id)), eq(s.adSpend.teacherId, req.auth!.sub)));
  res.json({ ok: true });
});

/**
 * Показатели за период. Считаются из фактических данных, а не из тарифов:
 * лиды по дате создания, выручка по дате оплаты, расход по дате траты.
 * Привязку выручки к конкретному объявлению Артур пока отложил, поэтому
 * здесь только суммарные цифры за период.
 */
crmRouter.get("/stats", async (req: AuthedRequest, res) => {
  const teacherId = req.auth!.sub;
  const from = str(req.query?.from as string, "0000-01-01");
  const to = str(req.query?.to as string, "9999-12-31");
  const inRange = (d: string | null) => Boolean(d) && d! >= from && d! <= `${to}￿`;

  const leads = await db.select().from(s.leads).where(eq(s.leads.teacherId, teacherId));
  const clients = await db.select().from(s.clients).where(eq(s.clients.teacherId, teacherId));
  const clientIds = new Set(clients.map((c) => c.id));
  const students = (await db.select().from(s.crmStudents)).filter((st) => clientIds.has(st.clientId));
  const studentIds = new Set(students.map((st) => st.id));
  const subs = (await db.select().from(s.subscriptions)).filter((sub) => studentIds.has(sub.studentId));
  const subIds = new Set(subs.map((sub) => sub.id));

  const payments = (await db
    .select({ id: s.payments.id, subscriptionId: s.payments.subscriptionId, amount: s.payments.amount, paidAt: s.payments.paidAt })
    .from(s.payments)).filter((p) => subIds.has(p.subscriptionId));

  const spend = await db.select().from(s.adSpend).where(eq(s.adSpend.teacherId, teacherId));

  const leadsInPeriod = leads.filter((l) => inRange(l.createdAt));
  const convertedInPeriod = clients.filter((c) => c.fromLeadId && inRange(c.createdAt));
  const revenue = payments.filter((p) => inRange(p.paidAt)).reduce((sum, p) => sum + Number(p.amount), 0);
  const spentByn = spend
    .filter((r) => inRange(r.spentOn))
    .reduce((sum, r) => sum + bynOf(r.amount, r.rate), 0);

  res.json({
    from,
    to,
    leads: leadsInPeriod.length,
    // Квалифицированные — дошедшие до «Квалификации» и дальше.
    qualified: leadsInPeriod.filter((l) => LEAD_STATUSES.indexOf(l.status) >= 2).length,
    clients: convertedInPeriod.length,
    revenue,
    spentByn,
    // CAC — сколько рекламы пришлось на одного нового клиента; ROAS — сколько
    // выручки на рубль рекламы. Без расхода обе величины неопределены.
    cac: convertedInPeriod.length && spentByn ? spentByn / convertedInPeriod.length : null,
    roas: spentByn ? revenue / spentByn : null,
  });
});

// Тарифы и автосоздание абонементов — отдельным модулем.
registerTariffRoutes(crmRouter);
