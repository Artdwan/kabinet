import { useState } from "react";
import { useApiData } from "../../services/useApiData";
import { fmtDate } from "../../services/mockApi";
import { Chip, ChipRow } from "../../components/Chip";

interface RosterRow {
  id: string;
  name: string;
  grade: number;
  avg: number;
  goal: number;
  done: number;
  total: number;
  weak: string;
  lastActive: string | null;
  risk: "ok" | "attention" | "risk";
}

interface GroupRow {
  id: string;
  name: string;
  studentIds: string[];
}

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Риск", cls: "tag-bad" },
};

export function TeacherStudentsPage() {
  const [group, setGroup] = useState<string | null>(null);
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [] } = useApiData<GroupRow[]>("/teacher/groups");

  const rows = roster.filter((s) => {
    if (!group) return true;
    return groups.find((g) => g.id === group)?.studentIds.includes(s.id);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ChipRow>
        <Chip active={group === null} onClick={() => setGroup(null)}>Все группы</Chip>
        {groups.map((g) => (
          <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</Chip>
        ))}
      </ChipRow>

      {rows.length === 0 ? (
        <div className="card-meta">Учеников пока нет.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Ученик</th>
              <th>Средний балл</th>
              <th>Цель</th>
              <th>Выполнено</th>
              <th>Слабая тема</th>
              <th>Активность</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.avg}</td>
                <td>{s.goal}</td>
                <td>{s.done}/{s.total}</td>
                <td>{s.weak || "—"}</td>
                <td>{s.lastActive ? fmtDate(s.lastActive.slice(0, 10)) : "—"}</td>
                <td><span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
