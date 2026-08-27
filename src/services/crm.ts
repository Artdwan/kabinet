// Общие типы и расчёты для раздела CRM. Перенесено из my-crm; даты здесь
// приходят с сервера ISO-строками, поэтому форматтеры принимают строку.
import { api } from "./apiClient";

export const LEAD_STAGES = [
  { key: "NEW", label: "Новый", color: "#7457e8" },
  { key: "IN_DIALOG", label: "В диалоге", color: "#299fe6" },
  { key: "QUALIFICATION", label: "Квалификация", color: "#e7a93b" },
  { key: "DIAGNOSTIC", label: "Диагностика", color: "#e66d70" },
  { key: "DECISION", label: "Решение", color: "#4fb78a" },
  { key: "RESULT", label: "Итог", color: "#9aa0ab" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["key"];

export function stageIndex(stage: LeadStage): number {
  return LEAD_STAGES.findIndex((s) => s.key === stage);
}

export function stageLabel(stage: LeadStage | null): string {
  return LEAD_STAGES.find((s) => s.key === stage)?.label ?? "Любой этап";
}

export function stageColor(stage: LeadStage): string {
  return LEAD_STAGES[Math.max(0, stageIndex(stage))].color;
}

export interface Lead {
  id: string;
  name: string;
  who: string;
  grade: string;
  subject: string;
  channel: string;
  status: LeadStage;
  sub: string;
  task: string | null;
  clientId: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
  hasReceipt: boolean;
}

export interface Subscription {
  id: string;
  studentId: string;
  subject: string;
  periodStart: string;
  lessonsCount: number;
  pricePerLesson: number;
  discountPercent: number;
  payments: Payment[];
}

export interface CrmStudent {
  id: string;
  clientId: string;
  name: string;
  grade: string;
  userId: string | null;
  subscriptions: Subscription[];
}

export interface Client {
  id: string;
  name: string;
  who: string;
  channel: string;
  phone: string | null;
  fromLeadId: string | null;
  students: CrmStudent[];
}

export interface StudentRow {
  id: string;
  clientId: string;
  name: string;
  grade: string;
  userId: string | null;
  client: { id: string; name: string; who: string; phone: string | null };
  subscriptionCount: number;
  account: { name: string; grade: number | null; goalScore: number | null } | null;
}

export interface SubscriptionRow extends Subscription {
  student: { id: string; name: string; grade: string; client: { id: string; name: string } };
}

export interface Template {
  id: string;
  title: string;
  body: string;
  stage: LeadStage | null;
}

// --- деньги ---------------------------------------------------------------

export function subscriptionTotal(lessonsCount: number, pricePerLesson: number, discountPercent: number): number {
  return lessonsCount * pricePerLesson * (1 - discountPercent / 100);
}

export function paidTotal(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

export function remainingAmount(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export function paymentStatus(total: number, paid: number): PaymentStatus {
  // Небольшой допуск: умножение на скидку даёт дробный хвост, из-за которого
  // полностью оплаченный абонемент показывал бы остаток вроде 0,001.
  if (paid >= total - 0.005) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Оплачен",
  PARTIAL: "Частично",
  UNPAID: "Не оплачен",
};

export const PAYMENT_STATUS_TAG: Record<PaymentStatus, string> = {
  PAID: "tag tag-ok",
  PARTIAL: "tag tag-accent",
  UNPAID: "tag tag-bad",
};

export function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export function formatPeriod(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(iso));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

// --- шаблоны --------------------------------------------------------------

export const PLACEHOLDERS = ["{имя}", "{класс}", "{предмет}", "{канал}"];

export function renderTemplate(
  body: string,
  vars: { name: string; grade: string; subject: string; channel: string },
): string {
  return body
    .replaceAll("{имя}", vars.name)
    .replaceAll("{класс}", vars.grade)
    .replaceAll("{предмет}", vars.subject)
    .replaceAll("{канал}", vars.channel);
}

/** Открывает чек в новой вкладке: файл лежит в базе и отдаётся только с
 *  токеном, поэтому обычной ссылкой его не показать. */
export async function openReceipt(paymentId: string): Promise<void> {
  const url = await api.blob(`/crm/payments/${paymentId}/receipt`);
  window.open(url, "_blank", "noreferrer");
  // Даём вкладке успеть забрать содержимое, затем освобождаем память.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** navigator.clipboard недоступен вне защищённого контекста (обычный HTTP на
 *  сервере) и отклоняется, когда вкладка не в фокусе. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
