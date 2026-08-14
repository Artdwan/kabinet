import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { signToken, requireAuth, type AuthedRequest } from "../auth.js";

export const authRouter = Router();

function publicAccount(u: typeof s.users.$inferSelect) {
  return { id: u.id, role: u.role, login: u.email, name: u.name, lastName: u.lastName, extra: u.extra };
}

authRouter.post("/register", async (req, res) => {
  const { role, email, password, name, lastName, extra } = req.body || {};
  if (!role || !["student", "teacher", "parent"].includes(role)) return res.status(400).json({ error: "Некорректная роль" });
  if (!email || !String(email).includes("@")) return res.status(400).json({ error: "Введите корректный email" });
  if (!password || String(password).length < 6) return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Укажите имя" });

  const existing = db.select().from(s.users).where(eq(s.users.email, email)).get();
  if (existing) return res.status(409).json({ error: "Такой email уже зарегистрирован" });

  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(String(password), 10);
  db.insert(s.users)
    .values({ id, role, email, passwordHash, name: String(name).trim(), lastName: String(lastName || "").trim(), extra: String(extra || ""), createdAt: new Date().toISOString() })
    .run();
  db.insert(s.settings).values({ userId: id, instantCheck: true, reduceMotion: false, compactCards: false }).run();

  if (role === "student") {
    db.insert(s.students).values({ userId: id, grade: 11, city: "", goalScore: 85, teacherId: null }).run();
  }
  if (role === "parent" && extra) {
    // "extra" doubles as the child's account id/code the parent was given by the teacher.
    const child = db.select().from(s.users).where(eq(s.users.id, String(extra).trim())).get();
    if (child && child.role === "student") {
      db.insert(s.parentLinks).values({ parentUserId: id, studentUserId: child.id }).run();
    }
  }

  const user = db.select().from(s.users).where(eq(s.users.id, id)).get()!;
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, account: publicAccount(user) });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.select().from(s.users).where(eq(s.users.email, String(email || ""))).get();
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Неверный email или пароль" });
  }
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, account: publicAccount(user) });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = db.select().from(s.users).where(eq(s.users.id, req.auth!.sub)).get();
  if (!user) return res.status(404).json({ error: "Аккаунт не найден" });
  res.json({ account: publicAccount(user) });
});
