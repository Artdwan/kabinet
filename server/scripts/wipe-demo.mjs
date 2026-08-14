import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_PATH || "./data/kabinet.db";
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const demoUserIds = ["acc-tc", "acc-st", "acc-pr", "st-1002", "st-1003", "st-1004", "st-1005"];
const demoGroupIds = ["gr-11a", "gr-chem"];

const uPh = demoUserIds.map(() => "?").join(",");
const gPh = demoGroupIds.map(() => "?").join(",");

const run = (sql, params = []) => db.prepare(sql).run(...params);

const tx = db.transaction(() => {
  run(`DELETE FROM attachments WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM teacher_feedback WHERE student_id IN (${uPh}) OR teacher_id IN (${uPh})`, [...demoUserIds, ...demoUserIds]);
  run(`DELETE FROM ct_results WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM ct_sessions WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM theory_progress WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM technique_progress WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM review_cards WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM game_records WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM homework_attempts WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM homework_state WHERE student_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM notifications WHERE user_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM settings WHERE user_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM parent_links WHERE parent_user_id IN (${uPh}) OR student_user_id IN (${uPh})`, [...demoUserIds, ...demoUserIds]);
  run(`DELETE FROM group_members WHERE group_id IN (${gPh}) OR student_user_id IN (${uPh})`, [...demoGroupIds, ...demoUserIds]);
  run(`DELETE FROM groups WHERE id IN (${gPh}) OR teacher_id IN (${uPh})`, [...demoGroupIds, ...demoUserIds]);
  run(`DELETE FROM students WHERE user_id IN (${uPh})`, demoUserIds);
  run(`DELETE FROM users WHERE id IN (${uPh})`, demoUserIds);
});

tx();

console.log("Demo accounts and their data removed.");
for (const t of ["users", "students", "groups", "group_members", "homework_state", "ct_results", "notifications", "settings"]) {
  const row = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get();
  console.log(`${t}: ${row.n} rows remaining`);
}

const contentCheck = db.prepare("SELECT COUNT(*) as n FROM subjects").get();
console.log(`subjects (content, should be untouched): ${contentCheck.n}`);
