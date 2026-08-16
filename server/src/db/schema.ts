import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role", { enum: ["student", "teacher", "parent"] }).notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  lastName: text("last_name").notNull().default(""),
  extra: text("extra").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const passwordResets = sqliteTable("password_resets", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const students = sqliteTable("students", {
  userId: text("user_id").primaryKey().references(() => users.id),
  grade: integer("grade").notNull().default(11),
  city: text("city").notNull().default(""),
  goalScore: integer("goal_score").notNull().default(85),
  teacherId: text("teacher_id").references(() => users.id),
  note: text("note"),
});

export const parentLinks = sqliteTable(
  "parent_links",
  {
    parentUserId: text("parent_user_id").notNull().references(() => users.id),
    studentUserId: text("student_user_id").notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.parentUserId, t.studentUserId] })],
);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  subjectId: text("subject_id").notNull(),
  grade: integer("grade"),
  description: text("description"),
  direction: text("direction", { enum: ["ct", "school", "improvement"] }),
  goal: text("goal"),
  scheduleNote: text("schedule_note"),
  scheduleDays: text("schedule_days", { mode: "json" }), // number[], 0=Monday..6=Sunday
  scheduleTime: text("schedule_time"), // "17:00"
  startDate: text("start_date"),
  color: text("color"),
  maxStudents: integer("max_students"),
  hwDefaults: text("hw_defaults", { mode: "json" }), // { dueDays, hintsAllowed, showSolutions, maxAttempts, remindersEnabled }
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id").notNull().references(() => groups.id),
    studentUserId: text("student_user_id").notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.studentUserId] })],
);

export const studentInvites = sqliteTable("student_invites", {
  token: text("token").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  name: text("name").notNull(),
  lastName: text("last_name").notNull().default(""),
  grade: integer("grade"),
  goalScore: integer("goal_score"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  acceptedUserId: text("accepted_user_id").references(() => users.id),
  acceptedAt: text("accepted_at"),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  studentId: text("student_id").references(() => users.id),
  title: text("title").notNull().default(""),
  startAt: text("start_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  format: text("format", { enum: ["online", "offline"] }).notNull().default("offline"),
  location: text("location").notNull().default(""),
  status: text("status", { enum: ["scheduled", "done", "cancelled"] }).notNull().default("scheduled"),
  seriesId: text("series_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  title: text("title").notNull(),
  type: text("type", { enum: ["theory", "formula", "example", "video", "pdf", "task", "recording", "other"] }).notNull().default("other"),
  url: text("url"),
  content: text("content"),
  createdAt: text("created_at").notNull(),
});

export const lessonAttendance = sqliteTable(
  "lesson_attendance",
  {
    lessonId: text("lesson_id").notNull().references(() => lessons.id),
    studentId: text("student_id").notNull().references(() => users.id),
    status: text("status", { enum: ["present", "absent", "excused"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.studentId] })],
);

// ---------------------------------------------------------------------------
// Content (global, seeded; read-only via API — a future authoring UI would
// write here without changing anything below this section)
// ---------------------------------------------------------------------------

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
});

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  name: text("name").notNull(),
});

export const homeworks = sqliteTable("homeworks", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  assignedAt: text("assigned_at").notNull(),
  dueAt: text("due_at").notNull(),
  allowInstantCheck: integer("allow_instant_check", { mode: "boolean" }).notNull().default(true),
  sections: text("sections", { mode: "json" }).notNull(), // HomeworkSection[]
});

export const theoryMaterials = sqliteTable("theory_materials", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  minutes: integer("minutes").notNull(),
  isNew: integer("is_new", { mode: "boolean" }).notNull().default(false),
  blocks: text("blocks", { mode: "json" }).notNull(), // ContentBlock[]
  relatedHomeworkIds: text("related_homework_ids", { mode: "json" }).notNull(), // string[]
  quiz: text("quiz", { mode: "json" }).notNull(), // QuizQuestion[]
});

export const ctTests = sqliteTable("ct_tests", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id"),
  title: text("title").notNull(),
  format: text("format", { enum: ["thematic", "full"] }).notNull(),
  difficulty: text("difficulty").notNull(),
  minutes: integer("minutes").notNull(),
  description: text("description").notNull(),
  questions: text("questions", { mode: "json" }).notNull(), // CtQuestion[]
});

export const techniques = sqliteTable("techniques", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  minutes: integer("minutes").notNull(),
  trainerId: text("trainer_id"),
  summary: text("summary").notNull(),
  steps: text("steps", { mode: "json" }).notNull(), // string[]
});

export const reviewCardDefs = sqliteTable("review_card_defs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  topicId: text("topic_id").notNull(),
});

export const trainers = sqliteTable("trainers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["equations", "order", "color", "error"] }).notNull(),
  subtitle: text("subtitle").notNull(),
  description: text("description").notNull(),
  techniqueId: text("technique_id"),
  seconds: integer("seconds"),
  lives: integer("lives"),
  rounds: text("rounds", { mode: "json" }), // TrainerRoundStep[]
  items: text("items", { mode: "json" }), // TrainerColorItem[]
});

// ---------------------------------------------------------------------------
// Per-student progress (real, private — this is what used to live in
// localStorage under mockApi)
// ---------------------------------------------------------------------------

export const homeworkState = sqliteTable(
  "homework_state",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    homeworkId: text("homework_id").notNull().references(() => homeworks.id),
    startedAt: text("started_at"),
    submittedAt: text("submitted_at"),
    reviewedAt: text("reviewed_at"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.homeworkId] })],
);

export const homeworkAttempts = sqliteTable(
  "homework_attempts",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    homeworkId: text("homework_id").notNull().references(() => homeworks.id),
    exerciseId: text("exercise_id").notNull(),
    value: text("value", { mode: "json" }).notNull().default("\"\""), // string | string[]
    status: text("status", { enum: ["not_started", "saved", "correct", "wrong", "manual"] })
      .notNull()
      .default("not_started"),
    attempts: integer("attempts").notNull().default(0),
    hintsOpened: integer("hints_opened").notNull().default(0),
    solutionOpened: integer("solution_opened", { mode: "boolean" }).notNull().default(false),
    draftText: text("draft_text").notNull().default(""),
    drawing: text("drawing"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.homeworkId, t.exerciseId] })],
);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => users.id),
  homeworkId: text("homework_id").notNull(),
  exerciseId: text("exercise_id").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  type: text("type").notNull(),
  kind: text("kind", { enum: ["PDF", "ФОТО"] }).notNull(),
  filePath: text("file_path").notNull(),
  createdAt: text("created_at").notNull(),
});

export const teacherFeedback = sqliteTable("teacher_feedback", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => users.id),
  homeworkId: text("homework_id").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  grade: text("grade").notNull(),
  text: text("text").notNull(),
  flagged: text("flagged", { mode: "json" }).notNull(), // FlaggedExercise[]
  createdAt: text("created_at").notNull(),
});

export const ctSessions = sqliteTable(
  "ct_sessions",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    testId: text("test_id").notNull(),
    startedAt: text("started_at").notNull(),
    answers: text("answers", { mode: "json" }).notNull(),
    flagged: text("flagged", { mode: "json" }).notNull(),
    current: integer("current").notNull().default(0),
    elapsed: integer("elapsed").notNull().default(0),
    finishedAt: text("finished_at"),
    only: text("only", { mode: "json" }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.testId] })],
);

export const ctResults = sqliteTable("ct_results", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => users.id),
  testId: text("test_id").notNull(),
  title: text("title").notNull(),
  subjectId: text("subject_id").notNull(),
  date: text("date").notNull(),
  score: integer("score").notNull(),
  minutes: integer("minutes").notNull(),
  topicAccuracy: text("topic_accuracy", { mode: "json" }).notNull(), // Record<topicId, pct>
});

export const theoryProgress = sqliteTable(
  "theory_progress",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    materialId: text("material_id").notNull(),
    progress: integer("progress").notNull().default(0),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    lastBlock: integer("last_block").notNull().default(0),
    quiz: text("quiz", { mode: "json" }).notNull().default("{}"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.materialId] })],
);

export const techniqueProgress = sqliteTable(
  "technique_progress",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    techniqueId: text("technique_id").notNull(),
    practiced: integer("practiced").notNull().default(0),
    done: text("done", { mode: "json" }).notNull().default("[]"),
    lastAt: text("last_at"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.techniqueId] })],
);

export const reviewCards = sqliteTable(
  "review_cards",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    cardId: text("card_id").notNull(),
    box: integer("box").notNull().default(1),
    due: text("due").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.cardId] })],
);

export const gameRecords = sqliteTable(
  "game_records",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    trainerId: text("trainer_id").notNull(),
    best: integer("best").notNull().default(0),
    played: integer("played").notNull().default(0),
    lastScore: integer("last_score").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.trainerId] })],
);

export const settings = sqliteTable("settings", {
  userId: text("user_id").primaryKey().references(() => users.id),
  instantCheck: integer("instant_check", { mode: "boolean" }).notNull().default(true),
  reduceMotion: integer("reduce_motion", { mode: "boolean" }).notNull().default(false),
  compactCards: integer("compact_cards", { mode: "boolean" }).notNull().default(false),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  date: text("date").notNull(),
  kind: text("kind", { enum: ["feedback", "deadline", "assign"] }).notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  homeworkId: text("homework_id"),
});
