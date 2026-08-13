import type { HomeworkStatus } from "../types";

const META: Record<HomeworkStatus, { label: string; cls: string }> = {
  new: { label: "Новая", cls: "tag-neutral" },
  in_progress: { label: "В работе", cls: "tag-accent" },
  submitted: { label: "Сдана", cls: "tag-accent" },
  reviewed: { label: "Проверена", cls: "tag-ok" },
  overdue: { label: "Просрочена", cls: "tag-bad" },
};

export function StatusBadge({ status }: { status: HomeworkStatus }) {
  const m = META[status];
  return <span className={`tag ${m.cls}`}>{m.label}</span>;
}

export function statusLabel(status: HomeworkStatus): string {
  return META[status].label;
}

export function ctaForStatus(status: HomeworkStatus): string {
  switch (status) {
    case "new":
      return "Начать";
    case "in_progress":
      return "Продолжить";
    case "submitted":
      return "Посмотреть";
    case "reviewed":
      return "Посмотреть результат";
    case "overdue":
      return "Открыть";
    default:
      return "Открыть";
  }
}
