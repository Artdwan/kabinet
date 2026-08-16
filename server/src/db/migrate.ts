import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "./client.js";
import { lessons, lessonAttendance } from "./schema.js";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");

// Cancelling a whole series used to leave every future occurrence in the calendar marked
// "cancelled" instead of removing it (single, non-series cancellations are left alone — those
// are deliberately kept visible). Purge any such lingering future-dated series lessons left
// over from before that fix, on every deploy, so this never needs a manual cleanup.
const nowIso = new Date().toISOString().slice(0, 16);
const staleCancelled = db
  .select({ id: lessons.id })
  .from(lessons)
  .where(and(eq(lessons.status, "cancelled"), isNotNull(lessons.seriesId), gte(lessons.startAt, nowIso)))
  .all()
  .map((l) => l.id);
if (staleCancelled.length) {
  db.delete(lessonAttendance).where(inArray(lessonAttendance.lessonId, staleCancelled)).run();
  db.delete(lessons).where(inArray(lessons.id, staleCancelled)).run();
  console.log(`Cleaned up ${staleCancelled.length} stale cancelled future lesson(s).`);
}
