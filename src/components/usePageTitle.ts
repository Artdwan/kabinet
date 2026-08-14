import { useLocation, useParams } from "react-router-dom";
import { homeworkById, ctTestById, THEORY_MATERIALS } from "../data/content";

export function usePageTitle(): { title: string; crumbs: string[] } {
  const location = useLocation();
  const params = useParams();
  const path = location.pathname;

  if (path.startsWith("/homework/") && params.hwId) {
    const hw = homeworkById(params.hwId);
    return { title: hw?.title || "Домашняя работа", crumbs: ["Домашние задания"] };
  }
  if (path === "/homework") return { title: "Домашние задания", crumbs: [] };
  if (path.startsWith("/theory/") && params.materialId) {
    const m = THEORY_MATERIALS.find((t) => t.id === params.materialId);
    return { title: m?.title || "Материал", crumbs: ["Теория"] };
  }
  if (path === "/theory") return { title: "Теория", crumbs: [] };
  if (path.startsWith("/tests/") && params.testId) {
    const t = ctTestById(params.testId);
    return { title: t?.title || "Тест", crumbs: ["Тесты ЦТ"] };
  }
  if (path === "/tests") return { title: "Тесты ЦТ", crumbs: [] };
  if (path === "/trainers") return { title: "Тренажёры", crumbs: [] };
  if (path.startsWith("/trainers/")) return { title: "Тренажёр", crumbs: ["Тренажёры"] };
  if (path === "/techniques") return { title: "Техники запоминания", crumbs: [] };
  if (path === "/stats") return { title: "Статистика", crumbs: [] };
  if (path === "/settings") return { title: "Настройки", crumbs: [] };
  if (path === "/home") return { title: "Главная", crumbs: [] };
  if (path === "/teacher") return { title: "Обзор", crumbs: [] };
  if (path === "/teacher/students") return { title: "Ученики", crumbs: [] };
  if (path === "/teacher/review") return { title: "Проверка работ", crumbs: [] };
  if (path === "/teacher/assign") return { title: "Материалы", crumbs: [] };
  if (path === "/parent") return { title: "Прогресс ребёнка", crumbs: [] };
  if (path === "/parent/reports") return { title: "Отчёты", crumbs: [] };
  return { title: "Кабинет", crumbs: [] };
}
