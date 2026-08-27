import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { pstr } from "../lib/params.js";

export const contentRouter = Router();

// TODO backend hardening: this ships exercise answers/solutions to every
// client regardless of unlock state. Acceptable for now (matches the
// prototype's documented scope); tightening it means stripping
// answer/solution fields per-request based on that student's attempt state.

contentRouter.get("/subjects", async (_req, res) => {
  res.json((await db.select().from(s.subjects)));
});

contentRouter.get("/topics", async (_req, res) => {
  res.json((await db.select().from(s.topics)));
});

contentRouter.get("/homeworks", async (_req, res) => {
  res.json((await db.select().from(s.homeworks)));
});

contentRouter.get("/homeworks/:id", async (req, res) => {
  const hw = (await db.select().from(s.homeworks).where(eq(s.homeworks.id, pstr(req.params.id))).limit(1))[0];
  if (!hw) return res.status(404).json({ error: "Работа не найдена" });
  res.json(hw);
});

contentRouter.get("/theory", async (_req, res) => {
  res.json((await db.select().from(s.theoryMaterials)));
});

contentRouter.get("/theory/:id", async (req, res) => {
  const m = (await db.select().from(s.theoryMaterials).where(eq(s.theoryMaterials.id, pstr(req.params.id))).limit(1))[0];
  if (!m) return res.status(404).json({ error: "Материал не найден" });
  res.json(m);
});

contentRouter.get("/ct-tests", async (_req, res) => {
  res.json((await db.select().from(s.ctTests)));
});

contentRouter.get("/ct-tests/:id", async (req, res) => {
  const t = (await db.select().from(s.ctTests).where(eq(s.ctTests.id, pstr(req.params.id))).limit(1))[0];
  if (!t) return res.status(404).json({ error: "Тест не найден" });
  res.json(t);
});

contentRouter.get("/techniques", async (_req, res) => {
  res.json((await db.select().from(s.techniques)));
});

contentRouter.get("/trainers", async (_req, res) => {
  res.json((await db.select().from(s.trainers)));
});

contentRouter.get("/review-card-defs", async (_req, res) => {
  res.json((await db.select().from(s.reviewCardDefs)));
});
