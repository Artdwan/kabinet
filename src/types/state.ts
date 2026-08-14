// Client-side aggregate of a student's own progress, now sourced from
// GET /api/student/state instead of localStorage.

import type {
  Account,
  Attempt,
  CtResult,
  CtSession,
  GameProgress,
  Notification,
  ReviewCardState,
  Settings,
  TeacherFeedback,
  TechniqueProgress,
  TheoryState,
} from "./index";

export interface HomeworkState {
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt?: string | null;
  attempts: Record<string, Attempt>;
}

export interface Store {
  account: Account | null;
  settings: Settings;
  homework: Record<string, HomeworkState>;
  teacherFeedback: Record<string, TeacherFeedback>;
  tests: Record<string, CtSession>;
  results: CtResult[];
  theory: Record<string, TheoryState>;
  techniques: Record<string, TechniqueProgress>;
  reviewCards: Record<string, ReviewCardState>;
  games: Record<string, GameProgress>;
  notifications: Notification[];
}

export const EMPTY_STORE: Store = {
  account: null,
  settings: { instantCheck: true, reduceMotion: false, compactCards: false },
  homework: {},
  teacherFeedback: {},
  tests: {},
  results: [],
  theory: {},
  techniques: {},
  reviewCards: {},
  games: {},
  notifications: [],
};
