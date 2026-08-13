import { useState } from "react";
import { GROUPS, STUDENTS } from "../../data/roles";
import { fmtDate } from "../../services/mockApi";
import { Chip, ChipRow } from "../../components/Chip";

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "В норме", cls: "tag-ok" },
  attention: { label: "Внимание", cls: "tag-accent" },
  risk: { label: "Риск", cls: "tag-bad" },
};

export function TeacherStudentsPage() {
  const [group, setGroup] = useState<string | null>(null);

  const rows = STUDENTS.filter((s) => {
    if (!group) return true;
    return GROUPS.find((g) => g.id === group)?.studentIds.includes(s.id);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ChipRow>
        <Chip active={group === null} onClick={() => setGroup(null)}>Все группы</Chip>
        {GROUPS.map((g) => (
          <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</Chip>
        ))}
      </ChipRow>

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
              <td>{s.weak}</td>
              <td>{fmtDate(s.lastActive)}</td>
              <td><span className={`tag ${RISK_LABEL[s.risk].cls}`}>{RISK_LABEL[s.risk].label}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
