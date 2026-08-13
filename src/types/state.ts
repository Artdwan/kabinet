// The single persisted "Store" blob — mirrors project/data/mockApi.js EMPTY exactly.

import type {
  Account,
  GameProgress,
  HomeworkState,
  ReviewCardState,
  ReviewedEntry,
  Settings,
  TechniqueProgress,
  CtSession,
  CtResult,
  TheoryState,
} from "./index";

export interface LastPlace {
  kind: "homework";
  id: string;
  exerciseId: string;
}

export interface TeacherState {
  reviewed: Record<string, ReviewedEntry>;
  assigned: string[];
}

export interface Store {
  auth: boolean;
  account: Account;
  registered: Account[];
  games: Record<string, GameProgress>;
  techniques: Record<string, TechniqueProgress>;
  reviewCards: Record<string, ReviewCardState>;
  teacher: TeacherState;
  homework: Record<string, HomeworkState>;
  tests: Record<string, CtSession>;
  theory: Record<string, TheoryState>;
  results: CtResult[];
  settings: Settings;
  readNotifications: string[];
  lastPlace: LastPlace | null;
}
