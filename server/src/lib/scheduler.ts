// Автосоздание абонементов на следующий месяц 20-го числа.
//
// Отдельного планировщика в проекте нет, поэтому просто просыпаемся раз в час
// и смотрим на дату. Генерация идемпотентна — уже заведённые месяцы она
// пропускает, — так что перезапуск сервера или лишний тик ничего не портят.
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema.js";
import { generateNextMonth, nextPeriod } from "../routes/crm-tariffs.js";

const GENERATE_ON_DAY = 20;
const HOUR = 60 * 60 * 1000;

let lastRunFor = "";

async function tick() {
  const today = new Date();
  if (today.getDate() !== GENERATE_ON_DAY) return;

  const period = nextPeriod(today);
  // Один прогон на месяц: за сутки будет 24 тика, работать должен первый.
  if (lastRunFor === period) return;
  lastRunFor = period;

  try {
    const teachers = await db.select().from(s.users).where(eq(s.users.role, "teacher"));
    for (const t of teachers) {
      const r = await generateNextMonth(t.id, period);
      if (r.created.length) {
        console.log(`[abonements] ${t.email}: создано ${r.created.length} на ${period}`);
      }
    }
  } catch (e) {
    // Расписание не должно ронять сервер.
    console.error("[abonements] не удалось создать абонементы:", e);
  }
}

export function startSubscriptionScheduler() {
  void tick();
  setInterval(() => void tick(), HOUR).unref();
}
