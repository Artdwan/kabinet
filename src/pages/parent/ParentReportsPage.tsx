import { HOMEWORKS } from "../../data/content";
import { useStore } from "../../services/StoreContext";
import { fmtDate, homeworkProgress } from "../../services/mockApi";
import { allResults, liveStatus } from "../../services/selectors";
import { StatusBadge } from "../../components/StatusBadge";

export function ParentReportsPage() {
  const { store } = useStore();
  const results = [...allResults(store)].reverse();

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
            {HOMEWORKS.map((h) => {
              const p = homeworkProgress(h, store.homework[h.id]);
              return (
                <tr key={h.id}>
                  <td>{h.title}</td>
                  <td>{fmtDate(h.dueAt)}</td>
                  <td>{p.done}/{p.total}</td>
                  <td><StatusBadge status={liveStatus(h, store)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
