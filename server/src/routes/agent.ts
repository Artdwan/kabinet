// ИИ-агент: понимает просьбу словами и предлагает действие.
//
// Важное решение: агент НИЧЕГО не пишет в базу. Он только предлагает действие,
// а выполняет его интерфейс — вызывая те же самые эндпоинты, что и обычные
// формы. Поэтому у агента нет собственного пути записи: все проверки прав,
// владения и корректности остаются одни на всех, и ошибка модели не может
// обойти их стороной.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth.js";

export const agentRouter = Router();
agentRouter.use(requireAuth, requireRole("teacher"));

const MODEL = "claude-sonnet-5";
// Адрес можно переопределить — если запросы к модели идут через прокси или шлюз.
const API_URL = process.env.ANTHROPIC_BASE_URL
  ? `${process.env.ANTHROPIC_BASE_URL.replace(/\/+$/, "")}/v1/messages`
  : "https://api.anthropic.com/v1/messages";

const DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

/** Инструменты — ровно те действия, которые агенту разрешено предлагать. */
const TOOLS = [
  {
    name: "create_student",
    description:
      "Завести нового ученика. Нужны имя и email — без email аккаунт не создать, поэтому если email не назван, спроси его, а инструмент не вызывай.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Имя" },
        lastName: { type: "string", description: "Фамилия, если названа" },
        email: { type: "string", description: "Почта ученика" },
        grade: { type: "integer", description: "Класс, 6–11" },
        goalScore: { type: "integer", description: "Целевой балл, если назван" },
        startScore: { type: "integer", description: "Текущий балл, если назван" },
        groupIds: {
          type: "array",
          items: { type: "string" },
          description: "Идентификаторы групп из списка существующих групп",
        },
        note: { type: "string", description: "Заметка о ученике, если есть" },
      },
      required: ["name", "email"],
    },
  },
  {
    name: "create_group",
    description: "Создать группу занятий с расписанием.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Название группы" },
        subjectId: { type: "string", description: "Идентификатор предмета из списка предметов" },
        grade: { type: "integer", description: "Класс группы" },
        direction: {
          type: "string",
          enum: ["ct", "school", "improvement"],
          description: "ct — подготовка к ЦТ/ЦЭ, school — школьная программа, improvement — подтянуть предмет",
        },
        scheduleSlots: {
          type: "array",
          description: "Расписание: день недели (0 — понедельник, 6 — воскресенье) и время в формате ЧЧ:ММ",
          items: {
            type: "object",
            properties: {
              day: { type: "integer", minimum: 0, maximum: 6 },
              time: { type: "string", pattern: "^[0-9]{2}:[0-9]{2}$" },
            },
            required: ["day", "time"],
          },
        },
        scheduleFormat: { type: "string", enum: ["offline", "online"] },
        scheduleLocation: { type: "string", description: "Место или ссылка" },
        maxStudents: { type: "integer" },
      },
      required: ["name", "subjectId"],
    },
  },
  {
    name: "schedule_lesson",
    description:
      "Поставить занятие в календарь. Нужна либо группа, либо ученик — что-то одно. Дату считай от сегодняшней; прошедшие даты не предлагай.",
    input_schema: {
      type: "object",
      properties: {
        groupId: { type: "string", description: "Идентификатор группы" },
        studentId: { type: "string", description: "Идентификатор ученика для индивидуального занятия" },
        title: { type: "string", description: "Тема занятия, если названа" },
        startAt: { type: "string", description: "Дата и время начала в формате ГГГГ-ММ-ДДTЧЧ:ММ" },
        durationMinutes: { type: "integer", description: "Длительность в минутах, по умолчанию 60" },
        format: { type: "string", enum: ["offline", "online"] },
        location: { type: "string" },
        repeatWeekly: { type: "boolean", description: "Повторять еженедельно" },
        repeatUntil: { type: "string", description: "До какой даты повторять, ГГГГ-ММ-ДД" },
      },
      required: ["startAt"],
    },
  },
  {
    name: "create_lead",
    description: "Записать новую заявку в CRM.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Имя обратившегося" },
        who: { type: "string", description: "Кто пишет: мама, папа, сам ученик" },
        grade: { type: "string", description: "Класс, например «9 класс»" },
        subject: { type: "string", description: "Предмет" },
        channel: { type: "string", description: "Откуда пришёл: Instagram, Telegram и т. п." },
        sub: { type: "string", description: "Комментарий к заявке" },
      },
      required: ["name"],
    },
  },
];

/** Живой контекст: агент должен подставлять реальные идентификаторы, а не выдумывать. */
async function buildContext(teacherId: string) {
  const [groups, subjects, roster] = await Promise.all([
    db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)),
    db.select().from(s.subjects),
    db.select().from(s.students).where(eq(s.students.teacherId, teacherId)),
  ]);

  const users = await db.select().from(s.users).where(eq(s.users.role, "student"));
  const byId = new Map(users.map((u) => [u.id, u]));

  const groupLines = groups
    .filter((g) => g.active)
    .map((g) => {
      const slots = (g.scheduleSlots as { day: number; time: string }[] | null) ?? [];
      const when = slots.map((sl) => `${DAYS[sl.day]} ${sl.time}`).join(", ");
      return `- ${g.name} (id: ${g.id}, предмет: ${g.subjectId}${g.grade ? `, ${g.grade} класс` : ""}${when ? `, ${when}` : ""})`;
    });

  const studentLines = roster.map((st) => {
    const u = byId.get(st.userId);
    return `- ${u ? `${u.name} ${u.lastName}`.trim() : st.userId} (id: ${st.userId}, ${st.grade} класс)`;
  });

  const subjectLines = subjects.map((sub) => `- ${sub.name} (id: ${sub.id})`);

  return { groupLines, studentLines, subjectLines };
}

function systemPrompt(ctx: Awaited<ReturnType<typeof buildContext>>) {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const dayName = DAYS[(today.getDay() + 6) % 7];

  return [
    "Ты помощник преподавателя в приложении Art.Teach — центра подготовки к ЦТ и ЦЭ по математике и химии.",
    "Твоя задача — понять просьбу и предложить одно конкретное действие, вызвав подходящий инструмент.",
    "",
    `Сегодня ${iso}, ${dayName}.`,
    "",
    "Правила:",
    "- Идентификаторы групп, учеников и предметов бери только из списков ниже. Не выдумывай их.",
    "- Если для действия не хватает обязательных данных — спроси недостающее обычным текстом и не вызывай инструмент.",
    "- Если просьба не про эти действия, ответь текстом и объясни, что умеешь.",
    "- Не выдумывай сведения об учениках, оценках и оплатах: ты видишь только списки ниже.",
    "- Отвечай по-русски, коротко и по делу.",
    "",
    ctx.subjectLines.length ? `Предметы:\n${ctx.subjectLines.join("\n")}` : "Предметов пока нет.",
    "",
    ctx.groupLines.length ? `Группы:\n${ctx.groupLines.join("\n")}` : "Групп пока нет.",
    "",
    ctx.studentLines.length ? `Ученики:\n${ctx.studentLines.join("\n")}` : "Учеников пока нет.",
  ].join("\n");
}

/**
 * Названия для идентификаторов, которые вернула модель: в карточке
 * подтверждения должно стоять «11 «А» · ЦТ математика», а не «gr-11a» —
 * иначе подтверждать нечего, читать нечего.
 */
async function labelsFor(teacherId: string, input: Record<string, unknown>) {
  const ids: string[] = [];
  for (const key of ["groupId", "studentId", "subjectId"]) {
    if (typeof input[key] === "string") ids.push(input[key] as string);
  }
  if (Array.isArray(input.groupIds)) ids.push(...(input.groupIds as string[]).filter((v) => typeof v === "string"));
  if (!ids.length) return {};

  const labels: Record<string, string> = {};
  const [groups, subjects, users] = await Promise.all([
    db.select().from(s.groups).where(eq(s.groups.teacherId, teacherId)),
    db.select().from(s.subjects),
    db.select().from(s.users).where(eq(s.users.role, "student")),
  ]);

  for (const g of groups) if (ids.includes(g.id)) labels[g.id] = g.name;
  for (const sub of subjects) if (ids.includes(sub.id)) labels[sub.id] = sub.name;
  for (const u of users) if (ids.includes(u.id)) labels[u.id] = `${u.name} ${u.lastName}`.trim();
  return labels;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

agentRouter.get("/status", (_req, res) => {
  res.json({ ready: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
});

agentRouter.post("/chat", async (req: AuthedRequest, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        "Агент не подключён: в server/.env не задан ANTHROPIC_API_KEY. Добавьте ключ и перезапустите сервер.",
    });
  }

  const history: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (!messages.length) return res.status(400).json({ error: "Пустой запрос" });

  try {
    const ctx = await buildContext(req.auth!.sub);
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(ctx),
        tools: TOOLS,
        messages,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("[agent] Anthropic API:", upstream.status, detail.slice(0, 500));
      const message =
        upstream.status === 401
          ? "Ключ ANTHROPIC_API_KEY отклонён — проверьте его."
          : upstream.status === 429
            ? "Слишком много запросов к модели, попробуйте через минуту."
            : "Модель сейчас недоступна.";
      return res.status(502).json({ error: message });
    }

    const data = (await upstream.json()) as {
      content: ({ type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown })[];
    };

    const text = data.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const call = data.content.find(
      (b): b is { type: "tool_use"; name: string; input: Record<string, unknown> } => b.type === "tool_use",
    );

    // Действие возвращается как предложение. Выполнит его интерфейс — после
    // подтверждения и через обычные эндпоинты.
    res.json({
      reply: text,
      action: call
        ? { tool: call.name, input: call.input, labels: await labelsFor(req.auth!.sub, call.input) }
        : null,
    });
  } catch (e) {
    console.error("[agent]", e);
    res.status(500).json({ error: "Не удалось обратиться к модели" });
  }
});
