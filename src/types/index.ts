// Domain types, named and shaped to match the source prototype's data
// (project/data/content.js, mockApi.js, roles.js) field-for-field so the
// ported content needs no reshaping.

export type Role = "student" | "teacher" | "parent";

export interface Student {
  id: string;
  name: string;
  lastName: string;
  grade: number;
  city: string;
  goalScore: number;
  subjectIds: string[];
  teacher: string;
}

export interface Subject {
  id: string;
  name: string;
  short: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
}

export interface TopicAccuracy {
  topicId: string;
  accuracy: number;
  answered: number;
}

export interface Notification {
  id: string;
  text: string;
  date: string;
  kind: "feedback" | "deadline" | "assign";
}

export interface Recommendation {
  id: string;
  topicId: string;
  title: string;
  why: string;
  action: "theory" | "test" | "homework";
  targetId: string;
}

// ---------------------------------------------------------------------------
// Block-based content model, shared by theory materials and homework "content" sections.
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "formula"; lines: string[]; caption: string }
  | { type: "note"; title: string; text: string }
  | { type: "warning"; title: string; text: string }
  | { type: "video"; title: string; duration: string }
  | { type: "image"; caption: string };

export interface WorkedExample {
  id: string;
  title: string;
  prompt: string;
  steps: string[];
  answer: string;
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export type ExerciseType = "number" | "text" | "single" | "multi" | "manual";

export interface ExerciseOption {
  id: string;
  label: string;
}

export type SolutionPolicyMode =
  | "immediate"
  | "after_attempts"
  | "after_submit"
  | "teacher_approval";

export interface SolutionPolicy {
  mode: SolutionPolicyMode;
  attempts?: number;
}

export interface ExerciseSolution {
  steps: string[];
  answerText: string;
}

export interface Exercise {
  id: string;
  no: string;
  topicId: string;
  type: ExerciseType;
  prompt: string;
  answer: number | string | string[] | null;
  options?: ExerciseOption[];
  points: number;
  hints: string[];
  solution: ExerciseSolution;
  solutionPolicy: SolutionPolicy;
}

export type HomeworkSection =
  | { id: string; kind: "content"; title: string; blocks: ContentBlock[] }
  | { id: string; kind: "examples"; title: string; examples: WorkedExample[] }
  | { id: string; kind: "exercises"; title: string; hint?: string; exercises: Exercise[] };

export type HomeworkStatus = "new" | "in_progress" | "submitted" | "reviewed" | "overdue";

export interface FlaggedExercise {
  exerciseId: string;
  note: string;
}

export interface TeacherFeedback {
  id: string;
  teacher: string;
  date: string;
  grade: string;
  text: string;
  flagged: FlaggedExercise[];
}

export interface Homework {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  summary: string;
  assignedAt: string;
  dueAt: string;
  status: HomeworkStatus;
  allowInstantCheck: boolean;
  sections: HomeworkSection[];
  feedback: TeacherFeedback | null;
}

// Per-exercise student work state, keyed by exerciseId inside HomeworkState.attempts.
export type ExerciseStatus = "not_started" | "saved" | "correct" | "wrong" | "manual";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "PDF" | "ФОТО";
}

export interface Attempt {
  value: string | number | string[];
  status: ExerciseStatus;
  attempts: number;
  hintsOpened: number;
  solutionOpened: boolean;
  draftText: string;
  drawing: string | null;
  files: Attachment[];
  draftOpen?: boolean;
}

export interface HomeworkState {
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt?: string | null;
  attempts: Record<string, Attempt>;
}

// ---------------------------------------------------------------------------
// Theory library
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  prompt: string;
  type: "single" | "short";
  options?: ExerciseOption[];
  answer: string;
  explain: string;
}

export interface TheoryMaterial {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  summary: string;
  minutes: number;
  isNew: boolean;
  blocks: ContentBlock[];
  relatedHomeworkIds: string[];
  quiz: QuizQuestion[];
}

export interface QuizAnswerState {
  value: string;
  status: "correct" | "wrong";
}

export interface TheoryState {
  progress: number;
  favorite: boolean;
  read: boolean;
  lastBlock: number;
  quiz: Record<string, QuizAnswerState>;
}

// ---------------------------------------------------------------------------
// CT (ЦТ) tests
// ---------------------------------------------------------------------------

export type CtQuestionType = "single" | "multi" | "short";

export interface CtQuestion {
  id: string;
  no: number;
  topicId: string;
  type: CtQuestionType;
  text: string;
  options?: ExerciseOption[];
  answer: string | string[];
  hint: string;
  solution: string;
}

export type CtTestFormat = "thematic" | "full";

export interface CtTest {
  id: string;
  subjectId: string;
  topicId: string | null;
  title: string;
  format: CtTestFormat;
  difficulty: string;
  minutes: number;
  description: string;
  questions: CtQuestion[];
}

export interface CtSession {
  testId: string;
  startedAt: string;
  answers: Record<string, string | string[] | undefined>;
  flagged: Record<string, boolean>;
  current: number;
  elapsed: number;
  finishedAt: string | null;
  only: string[] | null;
}

// Static seed result history (project/data/content.js CT_RESULTS)
export interface CtResult {
  id: string;
  testId: string;
  title: string;
  subjectId: string;
  date: string;
  score: number;
  minutes: number;
}

// ---------------------------------------------------------------------------
// Memory techniques, spaced repetition, trainers/games
// ---------------------------------------------------------------------------

export interface Technique {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  kind: "core";
  trainerId: string | null;
  summary: string;
  steps: string[];
}

export interface TechniqueProgress {
  practiced: number;
  done: number[];
  lastAt?: string;
}

export interface ReviewInterval {
  n: number;
  label: string;
  hint: string;
}

export type ReviewZone = "red" | "yellow" | "green";

export interface ReviewCard {
  id: string;
  title: string;
  topicId: string;
  zone: ReviewZone;
  box: number;
  due: string;
}

export interface ReviewCardState {
  box: number;
  due: string;
  zone?: ReviewZone;
  archived?: boolean;
}

export interface Zone {
  id: ReviewZone;
  name: string;
  desc: string;
  freq: string;
  color: string;
}

export interface WeekPlanDay {
  day: string;
  block: string;
}

export interface Wave {
  n: number;
  when: string;
  what: string;
}

export type TrainerKind = "equations" | "order" | "color" | "error";

export interface TrainerRoundStep {
  id: string;
  prompt: string;
  steps: string[];
  badIndex?: number;
  why?: string;
}

export interface TrainerColorItem {
  id: string;
  text: string;
  color: "red" | "blue" | "green";
}

export interface Trainer {
  id: string;
  title: string;
  kind: TrainerKind;
  subtitle: string;
  description: string;
  techniqueId: string | null;
  seconds?: number;
  lives?: number;
  rounds?: TrainerRoundStep[];
  items?: TrainerColorItem[];
}

export interface GameProgress {
  best: number;
  played: number;
  lastScore: number;
}

// ---------------------------------------------------------------------------
// Accounts / roles / settings
// ---------------------------------------------------------------------------

export interface RoleDef {
  id: Role;
  name: string;
  hint: string;
}

export interface Account {
  id: string;
  role: Role;
  login: string;
  name: string;
  lastName: string;
  extra: string;
}

export interface Settings {
  instantCheck: boolean;
  reduceMotion: boolean;
  compactCards: boolean;
}

// ---------------------------------------------------------------------------
// Teacher & parent side
// ---------------------------------------------------------------------------

export interface Group {
  id: string;
  name: string;
  studentIds: string[];
}

export type RiskLevel = "ok" | "attention" | "risk";

export interface TeacherStudent {
  id: string;
  name: string;
  grade: number;
  avg: number;
  goal: number;
  done: number;
  total: number;
  risk: RiskLevel;
  weak: string;
  lastActive: string;
}

export interface ReviewQueueItem {
  id: string;
  studentId: string;
  homeworkId: string;
  title: string;
  submittedAt: string;
  answers: number;
  manual: number;
  files: number;
  hints: number;
}

export interface ReviewedEntry {
  grade: string;
  comment: string;
  at: string;
}

export interface ChildLink {
  parentId: string;
  studentId: string;
  name: string;
  grade: number;
}

export interface ParentWeekDay {
  day: string;
  minutes: number;
  tasks: number;
}
