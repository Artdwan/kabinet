import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Gamepad2,
  Home,
  LayoutGrid,
  Library,
  ListChecks,
  UsersRound,
  Users,
} from "lucide-react";
import type { Role } from "../types";

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: number;
}

export function navForRole(role: Role, badges: { homework?: number; review?: number }): NavItem[] {
  if (role === "teacher") {
    return [
      { to: "/teacher", label: "Обзор", shortLabel: "Обзор", icon: LayoutGrid },
      { to: "/teacher/calendar", label: "Календарь", shortLabel: "Календарь", icon: CalendarDays },
      { to: "/teacher/groups", label: "Группы", shortLabel: "Группы", icon: UsersRound },
      { to: "/teacher/students", label: "Ученики", shortLabel: "Ученики", icon: Users },
      { to: "/teacher/review", label: "Проверка работ", shortLabel: "Проверка", icon: ClipboardCheck, badge: badges.review },
      { to: "/teacher/assign", label: "Материалы", shortLabel: "Материалы", icon: FolderOpen },
    ];
  }
  if (role === "parent") {
    return [
      { to: "/parent", label: "Прогресс ребёнка", shortLabel: "Прогресс", icon: Home },
      { to: "/parent/reports", label: "Отчёты", shortLabel: "Отчёты", icon: FileText },
    ];
  }
  return [
    { to: "/home", label: "Главная", shortLabel: "Главная", icon: Home },
    { to: "/homework", label: "Домашние задания", shortLabel: "ДЗ", icon: BookOpen, badge: badges.homework },
    { to: "/theory", label: "Теория", shortLabel: "Теория", icon: Library },
    { to: "/tests", label: "Тесты ЦТ", shortLabel: "Тесты", icon: ListChecks },
    { to: "/trainers", label: "Тренажёры", shortLabel: "Игры", icon: Gamepad2 },
    { to: "/techniques", label: "Техники", shortLabel: "Техники", icon: Brain },
    { to: "/stats", label: "Статистика", shortLabel: "Статистика", icon: BarChart3 },
  ];
}
