import { useApiData } from "../../services/useApiData";
import { fmtDate, TODAY_ISO } from "../../services/mockApi";
import { StatusBadge } from "../../components/StatusBadge";
import type { HomeworkStatus } from "../../types";

interface ResultRow {
  id: string;
  date: string;
  title: string;
  minutes: number;
  score: number;
}

interface HomeworkRow {
  id: string;
  title: string;
  dueAt: string;
  done: number;
  total: number;
  submittedAt: string | null;
  reviewedAt: string | null;
}

interface ProgressData {
  results: ResultRow[];
  homeworks: HomeworkRow[];
}

function statusOf(h: HomeworkRow): HomeworkStatus {
  if (h.reviewedAt) return "reviewed";
  if (h.submittedAt) return "submitted";
  if (h.dueAt < TODAY_ISO) return "overdue";
  if (h.done > 0) return "in_progress";
  return "new";
}

export function ParentReportsPage() {
  const { data: progress } = useApiData<ProgressData>("/parent/child/progress");
  const results = [...(progress?.results ?? [])].reverse();
  const homeworks = progress?.homeworks ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Результаты тестов ЦТ</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тест</th>
              <th>Время</th>
              <th>Балл</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.title}</td>
                <td>{r.minutes} мин</td>
                <td>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Домашние работы</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Работа</th>
              <th>Дедлайн</th>
              <th>Прогресс</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {homeworks.map((h) => (
              <tr key={h.id}>
                <td>{h.title}</td>
                <td>{fmtDate(h.dueAt)}</td>
                <td>{h.done}/{h.total}</td>
                <td><StatusBadge status={statusOf(h)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
