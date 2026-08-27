import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { signToken, requireAuth, type AuthedRequest } from "../auth.js";
import { sendMail } from "../lib/mailer.js";

export const authRouter = Router();

function publicAccount(u: typeof s.users.$inferSelect) {
  return { id: u.id, role: u.role, login: u.email, name: u.name, lastName: u.lastName, extra: u.extra };
}

authRouter.get("/student-invite/:token", async (req, res) => {
  const invite = (await db.select().from(s.studentInvites).where(eq(s.studentInvites.token, String(req.params.token))).limit(1))[0];
  if (!invite || invite.acceptedUserId) return res.status(404).json({ error: "Приглашение не найдено или уже использовано" });
  const teacher = (await db.select().from(s.users).where(eq(s.users.id, invite.teacherId)).limit(1))[0];
  const groupIds = (invite.groupIds as string[] | null) ?? (invite.groupId ? [invite.groupId] : []);
  const groupNames = (
    await Promise.all(
      groupIds.map(async (id) => (await db.select().from(s.groups).where(eq(s.groups.id, id)).limit(1))[0]?.name),
    )
  ).filter((n): n is string => Boolean(n));
  res.json({
    name: invite.name, lastName: invite.lastName,
    teacherName: teacher ? `${teacher.name} ${teacher.lastName}`.trim() : "",
    groupName: groupNames.join(", ") || null,
  });
});

authRouter.post("/register", async (req, res) => {
  const { role, email, password, name, lastName, extra, inviteToken } = req.body || {};
  if (!role || !["student", "teacher", "parent"].includes(role)) return res.status(400).json({ error: "Некорректная роль" });
  if (!email || !String(email).includes("@")) return res.status(400).json({ error: "Введите корректный email" });
  if (!password || String(password).length < 6) return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя" });

  const existing = (await db.select().from(s.users).where(eq(s.users.email, email)).limit(1))[0];
  if (existing) return res.status(409).json({ error: "Такой email уже зарегистрирован" });

  let invite: typeof s.studentInvites.$inferSelect | undefined;
  if (inviteToken && role === "student") {
    invite = (await db.select().from(s.studentInvites).where(eq(s.studentInvites.token, String(inviteToken))).limit(1))[0];
    if (!invite || invite.acceptedUserId) return res.status(400).json({ error: "Приглашение не найдено или уже использовано" });
  }

  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(String(password), 10);
  (await db.insert(s.users)
    .values({ id, role, email, passwordHash, name: String(name).trim(), lastName: String(lastName || "").trim(), extra: String(extra || ""), createdAt: new Date().toISOString() })
    );
  (await db.insert(s.settings).values({ userId: id, instantCheck: true, reduceMotion: false, compactCards: false }));

  if (role === "student") {
    (await db.insert(s.students)
      .values({
        userId: id,
        grade: invite?.grade ?? 11,
        city: "",
        goalScore: invite?.goalScore ?? 85,
        startScore: invite?.startScore ?? null,
        startGrade: invite?.startGrade ?? null,
        goalGrade: invite?.goalGrade ?? null,
        teacherId: invite?.teacherId ?? null,
        note: invite?.note ?? null,
        scheduleSubjectId: invite?.scheduleSubjectId ?? null,
        scheduleSlots: invite?.scheduleSlots ?? null,
        scheduleStartDate: invite?.scheduleStartDate ?? null,
        scheduleEndDate: invite?.scheduleEndDate ?? null,
        scheduleFormat: invite?.scheduleFormat ?? "offline",
        scheduleLocation: invite?.scheduleLocation ?? null,
      })
      );
    if (invite) {
      const groupIds = (invite.groupIds as string[] | null) ?? (invite.groupId ? [invite.groupId] : []);
      const joinedAt = new Date().toISOString().slice(0, 10);
      for (const groupId of groupIds) {
        (await db.insert(s.groupMemberships).values({ id: randomUUID(), groupId, studentUserId: id, joinedAt, leftAt: null }));
      }
      (await db.update(s.studentInvites).set({ acceptedUserId: id, acceptedAt: new Date().toISOString() }).where(eq(s.studentInvites.token, invite.token)));
    }
  }
  if (role === "parent" && extra) {
    // "extra" doubles as the child's account id/code the parent was given by the teacher.
    const child = (await db.select().from(s.users).where(eq(s.users.id, String(extra).trim())).limit(1))[0];
    if (child && child.role === "student") {
      (await db.insert(s.parentLinks).values({ parentUserId: id, studentUserId: child.id }));
    }
  }

  const user = (await db.select().from(s.users).where(eq(s.users.id, id)).limit(1))[0]!;
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, account: publicAccount(user) });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = (await db.select().from(s.users).where(eq(s.users.email, String(email || ""))).limit(1))[0];
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Неверный email или пароль" });
  }
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, account: publicAccount(user) });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = (await db.select().from(s.users).where(eq(s.users.id, req.auth!.sub)).limit(1))[0];
  if (!user) return res.status(404).json({ error: "Аккаунт не найден" });
  res.json({ account: publicAccount(user) });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  // Always respond the same way regardless of whether the email exists, so the
  // endpoint can't be used to enumerate registered accounts.
  const user = email ? (await db.select().from(s.users).where(eq(s.users.email, String(email).trim())).limit(1))[0] : undefined;

  if (user) {
    (await db.delete(s.passwordResets).where(lt(s.passwordResets.expiresAt, new Date().toISOString())));
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    (await db.insert(s.passwordResets).values({ token, userId: user.id, expiresAt, createdAt: new Date().toISOString() }));

    const base = process.env.FRONTEND_URL || "https://kabinet.targetologistcabinet.space";
    const link = `${base}/reset-password?token=${token}`;
    try {
      await sendMail(
        user.email,
        "Восстановление пароля — Кабинет ученика",
        `<p>Здравствуйте, ${user.name}!</p><p>Чтобы установить новый пароль, перейдите по ссылке (действительна 1 час):</p><p><a href="${link}">${link}</a></p><p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>`,
      );
    } catch (e) {
      console.error("[forgot-password] failed to send email:", e);
    }
  }

  res.json({ ok: true });
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || String(password).length < 6) {
    return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });
  }

  const reset = (await db.select().from(s.passwordResets).where(eq(s.passwordResets.token, String(token))).limit(1))[0];
  if (!reset || reset.expiresAt < new Date().toISOString()) {
    return res.status(400).json({ error: "Ссылка недействительна или устарела — запросите восстановление ещё раз" });
  }

  const passwordHash = bcrypt.hashSync(String(password), 10);
  (await db.update(s.users).set({ passwordHash }).where(eq(s.users.id, reset.userId)));
  (await db.delete(s.passwordResets).where(eq(s.passwordResets.token, String(token))));

  res.json({ ok: true });
});
