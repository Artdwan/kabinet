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

contentRouter.get("/subjects", (_req, res) => {
  res.json(db.select().from(s.subjects).all());
});

contentRouter.get("/topics", (_req, res) => {
  res.json(db.select().from(s.topics).all());
});

contentRouter.get("/homeworks", (_req, res) => {
  res.json(db.select().from(s.homeworks).all());
});

contentRouter.get("/homeworks/:id", (req, res) => {
  const hw = db.select().from(s.homeworks).where(eq(s.homeworks.id, pstr(req.params.id))).get();
  if (!hw) return res.status(404).json({ error: "Работа не найдена" });
  res.json(hw);
});

contentRouter.get("/theory", (_req, res) => {
  res.json(db.select().from(s.theoryMaterials).all());
});

contentRouter.get("/theory/:id", (req, res) => {
  const m = db.select().from(s.theoryMaterials).where(eq(s.theoryMaterials.id, pstr(req.params.id))).get();
  if (!m) return res.status(404).json({ error: "Материал не найден" });
  res.json(m);
});

contentRouter.get("/ct-tests", (_req, res) => {
  res.json(db.select().from(s.ctTests).all());
});

contentRouter.get("/ct-tests/:id", (req, res) => {
  const t = db.select().from(s.ctTests).where(eq(s.ctTests.id, pstr(req.params.id))).get();
  if (!t) return res.status(404).json({ error: "Тест не найден" });
  res.json(t);
});

contentRouter.get("/techniques", (_req, res) => {
  res.json(db.select().from(s.techniques).all());
});

contentRouter.get("/trainers", (_req, res) => {
  res.json(db.select().from(s.trainers).all());
});

contentRouter.get("/review-card-defs", (_req, res) => {
  res.json(db.select().from(s.reviewCardDefs).all());
});
