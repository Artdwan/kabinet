import { useEffect, useRef, useState } from "react";
import { Bot, CornerDownLeft, X } from "lucide-react";
import { api, ApiError } from "../services/apiClient";
import { useToast } from "../services/ToastContext";

/**
 * Помощник преподавателя. Агент только предлагает действие — выполняется оно
 * отсюда, вызовом тех же эндпоинтов, что и обычные формы. Поэтому ничего не
 * появляется в базе без явного подтверждения.
 */

interface AgentAction {
  tool: string;
  input: Record<string, unknown>;
  /** Названия для идентификаторов — их и показываем вместо gr-11a. */
  labels?: Record<string, string>;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  action?: AgentAction | null;
  done?: string;
}

const DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

const TOOL_TITLE: Record<string, string> = {
  create_student: "Добавить ученика",
  create_group: "Создать группу",
  schedule_lesson: "Поставить занятие",
  create_lead: "Записать заявку",
};

/** Куда уходит подтверждённое действие — обычные эндпоинты приложения. */
const TOOL_ENDPOINT: Record<string, string> = {
  create_student: "/teacher/students",
  create_group: "/teacher/groups",
  schedule_lesson: "/teacher/lessons",
  create_lead: "/crm/leads",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Имя",
  lastName: "Фамилия",
  email: "Почта",
  grade: "Класс",
  goalScore: "Целевой балл",
  startScore: "Текущий балл",
  groupIds: "Группы",
  note: "Заметка",
  subjectId: "Предмет",
  direction: "Направление",
  scheduleSlots: "Расписание",
  scheduleFormat: "Формат",
  scheduleLocation: "Место",
  maxStudents: "Мест",
  groupId: "Группа",
  studentId: "Ученик",
  title: "Тема",
  startAt: "Начало",
  durationMinutes: "Длительность",
  format: "Формат",
  location: "Место",
  repeatWeekly: "Повторять еженедельно",
  repeatUntil: "Повторять до",
  who: "Кто обратился",
  subject: "Предмет",
  channel: "Канал",
  sub: "Комментарий",
};

const SUBJECT_NAME: Record<string, string> = { math: "Математика", chem: "Химия" };
const DIRECTION_NAME: Record<string, string> = {
  ct: "подготовка к ЦТ",
  school: "школьная программа",
  improvement: "подтянуть предмет",
};

function formatValue(key: string, value: unknown, labels: Record<string, string> = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && labels[value]) return labels[value];
  if (Array.isArray(value) && value.every((v) => typeof v === "string" && labels[v]))
    return value.map((v) => labels[v as string]).join(", ");
  if (key === "scheduleSlots" && Array.isArray(value)) {
    return value.map((sl) => `${DAYS[(sl as { day: number }).day]} ${(sl as { time: string }).time}`).join(", ");
  }
  if (key === "startAt" && typeof value === "string") {
    const [d, t] = value.split("T");
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}${t ? `, ${t}` : ""}`;
  }
  if (key === "subjectId" && typeof value === "string") return SUBJECT_NAME[value] ?? value;
  if (key === "direction" && typeof value === "string") return DIRECTION_NAME[value] ?? value;
  if (key === "format" || key === "scheduleFormat") return value === "online" ? "онлайн" : "очно";
  if (key === "durationMinutes") return `${value} мин`;
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (Array.isArray(value)) return value.length ? `${value.length}` : "—";
  return String(value);
}

const EXAMPLES = [
  "Добавь ученика Дмитрия Лапшина, 10 класс, dima@mail.ru, цель 80",
  "Создай группу «11 «Б» · ЦТ математика», вторник и пятница в 17:30",
  "Поставь занятие группе 11 «А» в среду в 16:00 на полтора часа",
];

export function AgentPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { show } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api
      .get<{ ready: boolean }>("/agent/status")
      .then((r) => setReady(r.ready))
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const history = [...messages, { role: "user" as const, content: question }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const r = await api.post<{ reply: string; action: AgentAction | null }>("/agent/chat", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([
        ...history,
        { role: "assistant", content: r.reply || (r.action ? "Проверьте и подтвердите:" : "…"), action: r.action },
      ]);
    } catch (e) {
      setMessages([
        ...history,
        {
          role: "assistant",
          content: e instanceof ApiError ? e.message : "Не удалось связаться с агентом.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(index: number) {
    const msg = messages[index];
    if (!msg.action) return;
    const endpoint = TOOL_ENDPOINT[msg.action.tool];
    if (!endpoint) return;

    setBusy(true);
    try {
      await api.post(endpoint, msg.action.input);
      const label = TOOL_TITLE[msg.action.tool] ?? "Действие";
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, action: null, done: `${label} — готово` } : m)),
      );
      show(`${label} — готово`, "ok");
      onChanged();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Не удалось выполнить действие", "bad");
    } finally {
      setBusy(false);
    }
  }

  function decline(index: number) {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, action: null, done: "Отменено" } : m)),
    );
  }

  return (
    <div className="agent-panel" role="dialog" aria-label="Помощник">
      <header className="agent-head">
        <div>
          <div className="agent-title">
            <Bot size={15} /> Помощник
          </div>
          <div className="card-meta">Заводит учеников, группы, занятия и заявки</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
          <X size={15} />
        </button>
      </header>

      <div className="agent-body">
        {ready === false && (
          <div className="agent-warn">
            Агент не подключён. Добавьте <code>ANTHROPIC_API_KEY</code> в <code>server/.env</code> и
            перезапустите сервер.
          </div>
        )}

        {messages.length === 0 && ready !== false && (
          <div className="agent-intro">
            <p className="card-body">Напишите словами, что нужно сделать. Например:</p>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="agent-example" onClick={() => send(ex)}>
                {ex}
              </button>
            ))}
            <p className="card-meta" style={{ marginTop: 12 }}>
              Ничего не сохранится, пока вы не подтвердите — агент только предлагает.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "agent-msg agent-msg-user" : "agent-msg"}>
            <div className="agent-text">{m.content}</div>

            {m.action && (
              <div className="agent-action">
                <div className="agent-action-title">{TOOL_TITLE[m.action.tool] ?? m.action.tool}</div>
                <dl className="agent-fields">
                  {Object.entries(m.action.input)
                    .filter(([, v]) => v !== null && v !== undefined && v !== "")
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{FIELD_LABEL[k] ?? k}</dt>
                        <dd>{formatValue(k, v, m.action?.labels)}</dd>
                      </div>
                    ))}
                </dl>
                <div className="agent-action-btns">
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decline(i)}>
                    Отмена
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirm(i)}>
                    Подтвердить
                  </button>
                </div>
              </div>
            )}

            {m.done && <div className="agent-done">{m.done}</div>}
          </div>
        ))}

        {busy && <div className="agent-msg agent-typing">Думает…</div>}
        <div ref={endRef} />
      </div>

      <div className="agent-input">
        <textarea
          ref={inputRef}
          className="input"
          rows={2}
          placeholder="Что нужно сделать?"
          value={input}
          disabled={ready === false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !input.trim() || ready === false}
          onClick={() => void send(input)}
        >
          <CornerDownLeft size={13} /> Отправить
        </button>
      </div>
    </div>
  );
}
