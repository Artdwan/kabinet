import { pgTable, text, integer, boolean, jsonb, numeric, primaryKey, unique, customType } from "drizzle-orm/pg-core";

// pg-core has no bytea column type. Receipts (сканы чеков) live in the
// database so an ordinary pg_dump captures them along with everything else.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role", { enum: ["student", "teacher", "parent"] }).notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  lastName: text("last_name").notNull().default(""),
  extra: text("extra").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const students = pgTable("students", {
  userId: text("user_id").primaryKey().references(() => users.id),
  grade: integer("grade").notNull().default(11),
  city: text("city").notNull().default(""),
  goalScore: integer("goal_score").notNull().default(85),
  startScore: integer("start_score"),
  startGrade: integer("start_grade"),
  goalGrade: integer("goal_grade"),
  teacherId: text("teacher_id").references(() => users.id),
  note: text("note"),
  scheduleSubjectId: text("schedule_subject_id"),
  scheduleSlots: jsonb("schedule_slots"), // { day: number (0=Monday..6=Sunday), time: string ("HH:MM") }[]
  scheduleStartDate: text("schedule_start_date"),
  scheduleEndDate: text("schedule_end_date"),
  scheduleActive: boolean("schedule_active").notNull().default(true),
  scheduleFormat: text("schedule_format", { enum: ["offline", "online"] }).notNull().default("offline"),
  scheduleLocation: text("schedule_location"),
});

export const parentLinks = pgTable(
  "parent_links",
  {
    parentUserId: text("parent_user_id").notNull().references(() => users.id),
    studentUserId: text("student_user_id").notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.parentUserId, t.studentUserId] })],
);

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  subjectId: text("subject_id").notNull(),
  grade: integer("grade"),
  description: text("description"),
  direction: text("direction", { enum: ["ct", "school", "improvement"] }),
  goal: text("goal"),
  scheduleNote: text("schedule_note"),
  scheduleDays: jsonb("schedule_days"), // deprecated, superseded by scheduleSlots
  scheduleTime: text("schedule_time"), // deprecated, superseded by scheduleSlots
  scheduleSlots: jsonb("schedule_slots"), // { day: number (0=Monday..6=Sunday), time: string ("HH:MM") }[]
  scheduleFormat: text("schedule_format", { enum: ["offline", "online"] }).notNull().default("offline"),
  scheduleLocation: text("schedule_location"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  active: boolean("active").notNull().default(true),
  color: text("color"),
  maxStudents: integer("max_students"),
  hwDefaults: jsonb("hw_defaults"), // { dueDays, hintsAllowed, showSolutions, maxAttempts, remindersEnabled }
});

// A holiday/break window for a group: the generator skips creating regular occurrences inside
// it, and any already-materialized ones get cancelled (not deleted) with cancelReason
// "group_paused". A manual "extra" lesson can still be scheduled inside a pause.
export const groupPauses = pgTable("group_pauses", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

// A temporary pause within an otherwise-active group membership (illness, travel, etc.) — unlike
// leaving the group, the student stays a member and reappears on the roster once the window ends.
// A lesson planned inside the window doesn't count against the student's attendance: they're
// still visible on the roster (no history gap) but their expectation is "excused" rather than
// "expected", so the lesson is excluded from the attendance-rate denominator.
export const studentFreezes = pgTable("student_freezes", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id),
  studentId: text("student_id").notNull().references(() => users.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

// Deprecated, superseded by groupMemberships (which carries join/leave dates). Left in place —
// unused by app code — as a historical record of the flat pre-migration membership data.
export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id").notNull().references(() => groups.id),
    studentUserId: text("student_user_id").notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.studentUserId] })],
);

// A student's participation in a group is a series of periods, not a single flag: leaving and
// later rejoining creates a new period rather than reopening the old one, so history stays
// unambiguous. A period with leftAt = null is the student's current (active) membership, if any.
export const groupMemberships = pgTable("group_memberships", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id),
  studentUserId: text("student_user_id").notNull().references(() => users.id),
  joinedAt: text("joined_at").notNull(),
  leftAt: text("left_at"),
});

export const studentInvites = pgTable("student_invites", {
  token: text("token").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id), // deprecated, superseded by groupIds
  groupIds: jsonb("group_ids"), // string[]
  name: text("name").notNull(),
  lastName: text("last_name").notNull().default(""),
  grade: integer("grade"),
  goalScore: integer("goal_score"),
  startScore: integer("start_score"),
  startGrade: integer("start_grade"),
  goalGrade: integer("goal_grade"),
  note: text("note"),
  scheduleSubjectId: text("schedule_subject_id"),
  scheduleSlots: jsonb("schedule_slots"), // { day: number (0=Monday..6=Sunday), time: string ("HH:MM") }[]
  scheduleStartDate: text("schedule_start_date"),
  scheduleEndDate: text("schedule_end_date"),
  scheduleFormat: text("schedule_format", { enum: ["offline", "online"] }).notNull().default("offline"),
  scheduleLocation: text("schedule_location"),
  createdAt: text("created_at").notNull(),
  acceptedUserId: text("accepted_user_id").references(() => users.id),
  acceptedAt: text("accepted_at"),
});

export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  studentId: text("student_id").references(() => users.id),
  title: text("title").notNull().default(""),
  startAt: text("start_at").notNull(), // actual/current start time
  plannedStart: text("planned_start"), // when this occurrence was originally due per the schedule; null for pre-migration rows
  overrideType: text("override_type", { enum: ["none", "moved", "cancelled", "extra", "custom"] }).notNull().default("none"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  format: text("format", { enum: ["online", "offline"] }).notNull().default("offline"),
  location: text("location").notNull().default(""),
  status: text("status", { enum: ["scheduled", "done", "cancelled"] }).notNull().default("scheduled"),
  cancelReason: text("cancel_reason", { enum: ["teacher", "series_cancel", "group_ended", "group_paused", "schedule_ended"] }),
  seriesId: text("series_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const materials = pgTable("materials", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  title: text("title").notNull(),
  type: text("type", { enum: ["theory", "formula", "example", "video", "pdf", "task", "recording", "other"] }).notNull().default("other"),
  url: text("url"),
  content: text("content"),
  createdAt: text("created_at").notNull(),
});

export const lessonAttendance = pgTable(
  "lesson_attendance",
  {
    lessonId: text("lesson_id").notNull().references(() => lessons.id),
    studentId: text("student_id").notNull().references(() => users.id),
    status: text("status", { enum: ["present", "absent", "excused"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.studentId] })],
);

// A lesson's roster is computed by default from group membership at its plannedStart. An
// override lets the teacher deviate for one specific occurrence without touching membership or
// the schedule template: "include" adds someone who wouldn't otherwise be there (a guest, or a
// student added after the fact), "exclude" drops someone the default roster would include.
export const lessonParticipantOverrides = pgTable(
  "lesson_participant_overrides",
  {
    lessonId: text("lesson_id").notNull().references(() => lessons.id),
    studentId: text("student_id").notNull().references(() => users.id),
    action: text("action", { enum: ["include", "exclude"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.studentId] })],
);

// ---------------------------------------------------------------------------
// Content (global, seeded; read-only via API — a future authoring UI would
// write here without changing anything below this section)
// ---------------------------------------------------------------------------

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  short: text("short").notNull(),
});

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  name: text("name").notNull(),
});

export const homeworks = pgTable("homeworks", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  assignedAt: text("assigned_at").notNull(),
  dueAt: text("due_at").notNull(),
  allowInstantCheck: boolean("allow_instant_check").notNull().default(true),
  sections: jsonb("sections").notNull(), // HomeworkSection[]
});

export const theoryMaterials = pgTable("theory_materials", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  minutes: integer("minutes").notNull(),
  isNew: boolean("is_new").notNull().default(false),
  blocks: jsonb("blocks").notNull(), // ContentBlock[]
  relatedHomeworkIds: jsonb("related_homework_ids").notNull(), // string[]
  quiz: jsonb("quiz").notNull(), // QuizQuestion[]
});

export const ctTests = pgTable("ct_tests", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  topicId: text("topic_id"),
  title: text("title").notNull(),
  format: text("format", { enum: ["thematic", "full"] }).notNull(),
  difficulty: text("difficulty").notNull(),
  minutes: integer("minutes").notNull(),
  description: text("description").notNull(),
  questions: jsonb("questions").notNull(), // CtQuestion[]
});

export const techniques = pgTable("techniques", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  minutes: integer("minutes").notNull(),
  trainerId: text("trainer_id"),
  summary: text("summary").notNull(),
  steps: jsonb("steps").notNull(), // string[]
});

export const reviewCardDefs = pgTable("review_card_defs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  topicId: text("topic_id").notNull(),
});

export const trainers = pgTable("trainers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["equations", "order", "color", "error"] }).notNull(),
  subtitle: text("subtitle").notNull(),
  description: text("description").notNull(),
  techniqueId: text("technique_id"),
  seconds: integer("seconds"),
  lives: integer("lives"),
  rounds: jsonb("rounds"), // TrainerRoundStep[]
  items: jsonb("items"), // TrainerColorItem[]
});

// ---------------------------------------------------------------------------
// Per-student progress (real, private — this is what used to live in
// localStorage under mockApi)
// ---------------------------------------------------------------------------

export const homeworkState = pgTable(
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

export const homeworkAttempts = pgTable(
  "homework_attempts",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    homeworkId: text("homework_id").notNull().references(() => homeworks.id),
    exerciseId: text("exercise_id").notNull(),
    value: jsonb("value").notNull().default("\"\""), // string | string[]
    status: text("status", { enum: ["not_started", "saved", "correct", "wrong", "manual"] })
      .notNull()
      .default("not_started"),
    attempts: integer("attempts").notNull().default(0),
    hintsOpened: integer("hints_opened").notNull().default(0),
    solutionOpened: boolean("solution_opened").notNull().default(false),
    draftText: text("draft_text").notNull().default(""),
    drawing: text("drawing"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.homeworkId, t.exerciseId] })],
);

export const attachments = pgTable("attachments", {
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

export const teacherFeedback = pgTable("teacher_feedback", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => users.id),
  homeworkId: text("homework_id").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  grade: text("grade").notNull(),
  text: text("text").notNull(),
  flagged: jsonb("flagged").notNull(), // FlaggedExercise[]
  createdAt: text("created_at").notNull(),
});

export const ctSessions = pgTable(
  "ct_sessions",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    testId: text("test_id").notNull(),
    startedAt: text("started_at").notNull(),
    answers: jsonb("answers").notNull(),
    flagged: jsonb("flagged").notNull(),
    current: integer("current").notNull().default(0),
    elapsed: integer("elapsed").notNull().default(0),
    finishedAt: text("finished_at"),
    only: jsonb("only"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.testId] })],
);

export const ctResults = pgTable("ct_results", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => users.id),
  testId: text("test_id").notNull(),
  title: text("title").notNull(),
  subjectId: text("subject_id").notNull(),
  date: text("date").notNull(),
  score: integer("score").notNull(),
  minutes: integer("minutes").notNull(),
  topicAccuracy: jsonb("topic_accuracy").notNull(), // Record<topicId, pct>
});

export const theoryProgress = pgTable(
  "theory_progress",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    materialId: text("material_id").notNull(),
    progress: integer("progress").notNull().default(0),
    favorite: boolean("favorite").notNull().default(false),
    read: boolean("read").notNull().default(false),
    lastBlock: integer("last_block").notNull().default(0),
    quiz: jsonb("quiz").notNull().default("{}"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.materialId] })],
);

export const techniqueProgress = pgTable(
  "technique_progress",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    techniqueId: text("technique_id").notNull(),
    practiced: integer("practiced").notNull().default(0),
    done: jsonb("done").notNull().default("[]"),
    lastAt: text("last_at"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.techniqueId] })],
);

export const reviewCards = pgTable(
  "review_cards",
  {
    studentId: text("student_id").notNull().references(() => users.id),
    cardId: text("card_id").notNull(),
    box: integer("box").notNull().default(1),
    due: text("due").notNull(),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.cardId] })],
);

export const gameRecords = pgTable(
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

export const settings = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => users.id),
  instantCheck: boolean("instant_check").notNull().default(true),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  compactCards: boolean("compact_cards").notNull().default(false),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  date: text("date").notNull(),
  kind: text("kind", { enum: ["feedback", "deadline", "assign"] }).notNull(),
  read: boolean("read").notNull().default(false),
  homeworkId: text("homework_id"),
});

// ---------------------------------------------------------------------------
// CRM: продажи и деньги. Перенесено из отдельного приложения my-crm.
//
// Ключевое отличие от учебной части: Client — это плательщик (обычно родитель),
// а crmStudents — ребёнок, за которого платят. У одного клиента может быть
// несколько детей, и абонемент принадлежит ребёнку, а не плательщику.
// ---------------------------------------------------------------------------

export const leadStatuses = ["NEW", "IN_DIALOG", "QUALIFICATION", "DIAGNOSTIC", "DECISION", "RESULT"] as const;

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  who: text("who").notNull().default(""),
  grade: text("grade").notNull().default(""),
  subject: text("subject").notNull().default(""),
  channel: text("channel").notNull().default(""),
  status: text("status", { enum: leadStatuses }).notNull().default("NEW"),
  sub: text("sub").notNull().default(""),
  task: text("task"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/// Плательщик — обычно родитель, иногда сам ученик (например, 11 класс).
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  who: text("who").notNull().default(""),
  channel: text("channel").notNull().default(""),
  phone: text("phone"),
  fromLeadId: text("from_lead_id").unique().references(() => leads.id),
  createdAt: text("created_at").notNull(),
});

/// Ребёнок, за которого платит клиент. `userId` связывает его с учебным
/// аккаунтом в кабинете — до слияния это был внешний id в другой базе,
/// теперь это обычный внешний ключ. null, пока аккаунта нет.
export const crmStudents = pgTable("crm_students", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  grade: text("grade").notNull().default(""),
  userId: text("user_id").unique().references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id").notNull().references(() => crmStudents.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    // Первое число месяца, YYYY-MM-DD.
    periodStart: text("period_start").notNull(),
    lessonsCount: integer("lessons_count").notNull(),
    /// Дата досрочного прекращения. Такой абонемент не переносится на
    /// следующий месяц автогенерацией.
    terminatedAt: text("terminated_at"),
    /// Если задана — стоимость месяца фиксированная, независимо от числа
    /// занятий, и pricePerLesson в расчёте не участвует.
    monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }),
    pricePerLesson: numeric("price_per_lesson", { precision: 10, scale: 2 }).notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    createdAt: text("created_at").notNull(),
  },
  // По ученику, а не по клиенту: двое детей одного родителя могут ходить
  // на один предмет в одном месяце.
  (t) => [unique().on(t.studentId, t.subject, t.periodStart)],
);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAt: text("paid_at").notNull(),
  note: text("note"),
  receiptName: text("receipt_name"),
  receiptType: text("receipt_type"),
  receiptData: bytea("receipt_data"),
  createdAt: text("created_at").notNull(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // null — шаблон подходит любому этапу воронки.
  stage: text("stage", { enum: leadStatuses }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/// Рекламные расходы. Храним сумму в исходной валюте и курс на дату
/// (Артур ставит его вручную по НБРБ), а не только пересчёт: курс потом
/// не переписывается задним числом и расход остаётся сверяемым с кабинетом.
export const adSpend = pgTable("ad_spend", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  spentOn: text("spent_on").notNull(), // YYYY-MM-DD
  channel: text("channel").notNull().default(""),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency", { enum: ["BYN", "USD"] }).notNull().default("BYN"),
  /// Сколько BYN за единицу валюты. Для BYN — 1.
  rate: numeric("rate", { precision: 10, scale: 4 }).notNull().default("1"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

/// Тариф — правило ценообразования, которое Артур заводит сам. Цены не
/// зашиты в код: у центра они меняются и зависят от предмета, класса и того,
/// первый ли это абонемент ученика.
///
/// Класс ученика в CRM — свободный текст («9 класс»), поэтому диапазон
/// задаётся числами, а из текста берётся первое число.
export const tariffs = pgTable("tariffs", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  /// null — тариф подходит любому предмету.
  subject: text("subject"),
  gradeFrom: integer("grade_from"),
  gradeTo: integer("grade_to"),
  /// FIRST — только первый абонемент ученика, REPEAT — последующие, ANY — любой.
  appliesTo: text("applies_to", { enum: ["FIRST", "REPEAT", "ANY"] }).notNull().default("ANY"),
  /// PER_LESSON — цена за занятие × количество; FIXED_MONTH — фиксированная
  /// сумма за месяц независимо от числа занятий.
  mode: text("mode", { enum: ["PER_LESSON", "FIXED_MONTH"] }).notNull().default("PER_LESSON"),
  pricePerLesson: numeric("price_per_lesson", { precision: 10, scale: 2 }),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  lessonsPerMonth: integer("lessons_per_month"),
  active: boolean("active").notNull().default(true),
  /// Меньше — выше приоритет при совпадении нескольких тарифов.
  priority: integer("priority").notNull().default(100),
  createdAt: text("created_at").notNull(),
});

/// Настройки CRM одного преподавателя. Пока здесь только политика возврата:
/// правила Артур не задавал, поэтому они настраиваемые, а не зашиты в код.
export const crmSettings = pgTable("crm_settings", {
  teacherId: text("teacher_id").primaryKey().references(() => users.id),
  /// По какой цене засчитываются проведённые занятия при возврате.
  /// SUBSCRIPTION — по цене абонемента (со скидкой), FULL — по полной, то
  /// есть скидка первого месяца при досрочном уходе не сохраняется.
  refundBasis: text("refund_basis", { enum: ["SUBSCRIPTION", "FULL"] }).notNull().default("SUBSCRIPTION"),
  /// Удержание: процент от возврата и/или фиксированная сумма.
  withholdPercent: numeric("withhold_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  withholdFixed: numeric("withhold_fixed", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: text("updated_at").notNull(),
});

/// Возврат по досрочно прекращённому абонементу. Хранится вместе с расчётом:
/// сколько занятий зачли, по какой цене и сколько удержали — чтобы потом
/// можно было объяснить сумму, а не пересчитывать её заново.
export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().unique().references(() => subscriptions.id, { onDelete: "cascade" }),
  lessonsUsed: integer("lessons_used").notNull(),
  usedCost: numeric("used_cost", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
  withheld: numeric("withheld", { precision: 10, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  basis: text("basis", { enum: ["SUBSCRIPTION", "FULL"] }).notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});
