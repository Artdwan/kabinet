import { useState } from "react";
import { useApiData } from "../../services/useApiData";
import { api, ApiError } from "../../services/apiClient";
import { useToast } from "../../services/ToastContext";
import { SUBJECTS } from "../../data/content";

interface RosterRow {
  id: string;
  name: string;
}

interface GroupRow {
  id: string;
  name: string;
  subjectId: string;
  grade: number | null;
  description: string | null;
  studentIds: string[];
}

export function TeacherGroupsPage() {
  const { data: roster = [] } = useApiData<RosterRow[]>("/teacher/roster");
  const { data: groups = [], reload: reloadGroups } = useApiData<GroupRow[]>("/teacher/groups");
  const { show } = useToast();

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSubject, setNewGroupSubject] = useState(SUBJECTS[0]?.id ?? "");
  const [newGroupGrade, setNewGroupGrade] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [addEmailByGroup, setAddEmailByGroup] = useState<Record<string, string>>({});
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);

  const nameOf = (studentId: string) => roster.find((r) => r.id === studentId)?.name ?? studentId;
  const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      await api.post("/teacher/groups", {
        name: newGroupName.trim(),
        subjectId: newGroupSubject,
        grade: newGroupGrade.trim() ? Number(newGroupGrade) : undefined,
        description: newGroupDescription.trim() || undefined,
      });
      setNewGroupName("");
      setNewGroupGrade("");
      setNewGroupDescription("");
      show("Группа создана", "ok");
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось создать группу", "bad");
    } finally {
      setCreatingGroup(false);
    }
  };

  const addStudent = async (groupId: string) => {
    const email = (addEmailByGroup[groupId] || "").trim();
    if (!email) return;
    setAddingGroupId(groupId);
    try {
      await api.post(`/teacher/groups/${groupId}/members`, { email });
      setAddEmailByGroup((m) => ({ ...m, [groupId]: "" }));
      show("Ученик добавлен в группу", "ok");
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось добавить ученика", "bad");
    } finally {
      setAddingGroupId(null);
    }
  };

  const removeStudent = async (groupId: string, studentId: string) => {
    try {
      await api.del(`/teacher/groups/${groupId}/members/${studentId}`);
      show("Ученик убран из группы", "ok");
      reloadGroups();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось убрать ученика", "bad");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Новая группа</label>
          <input className="input" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Например, 10 «Б» · химия" />
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Предмет</label>
          <select className="input" value={newGroupSubject} onChange={(e) => setNewGroupSubject(e.target.value)}>
            {SUBJECTS.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 90 }}>
          <label>Класс</label>
          <input className="input" type="number" min={1} max={11} value={newGroupGrade} onChange={(e) => setNewGroupGrade(e.target.value)} placeholder="11" />
        </div>
        <div className="field" style={{ minWidth: 220, flex: 1 }}>
          <label>Описание (необязательно)</label>
          <input className="input" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder="Например, подготовка к ЦТ, вечерняя группа" />
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!newGroupName.trim() || creatingGroup} onClick={createGroup}>
          Создать группу
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="card-meta">Групп пока нет — создайте первую выше.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div className="card-title" style={{ fontSize: 15 }}>
                    {g.name}{g.grade ? ` · ${g.grade} класс` : ""}
                  </div>
                  <div className="card-meta">{subjectName(g.subjectId)} · учеников: {g.studentIds.length}</div>
                  {g.description && <p className="card-body" style={{ margin: "4px 0 0" }}>{g.description}</p>}
                </div>
              </div>

              {g.studentIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {g.studentIds.map((id) => (
                    <span key={id} className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {nameOf(id)}
                      <button
                        type="button"
                        onClick={() => removeStudent(g.id, id)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 12, padding: 0 }}
                        title="Убрать из группы"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ maxWidth: 260 }}
                  value={addEmailByGroup[g.id] || ""}
                  onChange={(e) => setAddEmailByGroup((m) => ({ ...m, [g.id]: e.target.value }))}
                  placeholder="email зарегистрированного ученика"
                />
                <button type="button" className="btn btn-secondary btn-sm" disabled={!addEmailByGroup[g.id]?.trim() || addingGroupId === g.id} onClick={() => addStudent(g.id)}>
                  Добавить в группу
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
