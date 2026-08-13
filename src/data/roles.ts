/**
 * Роли, техники запоминания и тренажёры.
 * Ported 1:1 from the design prototype's project/data/roles.js.
 * TODO backend: users/roles → GET /me, /groups, /children; techniques and
 * games are static content, progress is stored on the user profile (POST /progress).
 */
import type {
  Account,
  ChildLink,
  Group,
  ParentWeekDay,
  ReviewCard,
  ReviewInterval,
  ReviewQueueItem,
  RoleDef,
  TeacherStudent,
  Technique,
  Trainer,
  Wave,
  WeekPlanDay,
  Zone,
} from "../types";

export const ROLES: RoleDef[] = [
  { id: "student", name: "Ученик", hint: "Задания, теория, тесты, тренажёры" },
  { id: "teacher", name: "Преподаватель", hint: "Ученики, проверка работ, назначения" },
  { id: "parent", name: "Родитель", hint: "Прогресс ребёнка и отчёты" },
];

export const ACCOUNTS: Account[] = [
  { id: "acc-st", role: "student", login: "maksim@demo", name: "Максим", lastName: "Ковалевич", extra: "11 класс · математика, химия" },
  { id: "acc-tc", role: "teacher", login: "irina@demo", name: "Ирина", lastName: "Петровна", extra: "Математика и химия · 2 группы" },
  { id: "acc-pr", role: "parent", login: "parent@demo", name: "Елена", lastName: "Ковалевич", extra: "Родитель Максима" },
];

/* ── ПРЕПОДАВАТЕЛЬ ───────────────────────────────────────────────── */
export const GROUPS: Group[] = [
  { id: "gr-11a", name: "11 «А» · ЦТ математика", studentIds: ["st-1001", "st-1002", "st-1003", "st-1004"] },
  { id: "gr-chem", name: "Химия · интенсив", studentIds: ["st-1001", "st-1005"] },
];

export const STUDENTS: TeacherStudent[] = [
  { id: "st-1001", name: "Максим Ковалевич", grade: 11, avg: 71, goal: 85, done: 3, total: 12, risk: "ok", weak: "Дробные уравнения", lastActive: "2026-08-13" },
  { id: "st-1002", name: "Алина Дубровская", grade: 11, avg: 82, goal: 90, done: 12, total: 12, risk: "ok", weak: "Стереометрия", lastActive: "2026-08-12" },
  { id: "st-1003", name: "Егор Савченко", grade: 11, avg: 58, goal: 75, done: 2, total: 12, risk: "attention", weak: "Проценты", lastActive: "2026-08-08" },
  { id: "st-1004", name: "Полина Жук", grade: 11, avg: 66, goal: 80, done: 7, total: 12, risk: "ok", weak: "Логарифмы", lastActive: "2026-08-13" },
  { id: "st-1005", name: "Илья Морозов", grade: 11, avg: 49, goal: 70, done: 0, total: 8, risk: "risk", weak: "Растворы", lastActive: "2026-08-04" },
];

// Review queue: work that's been submitted and awaits teacher grading.
export const REVIEW_QUEUE: ReviewQueueItem[] = [
  { id: "rq-1", studentId: "st-1001", homeworkId: "hw-04", title: "Строение атома — контрольные вопросы", submittedAt: "2026-08-09", answers: 3, manual: 3, files: 0, hints: 0 },
  { id: "rq-2", studentId: "st-1002", homeworkId: "hw-02", title: "Тетрадь 02 — Пропорции и дробные уравнения", submittedAt: "2026-08-12", answers: 12, manual: 2, files: 3, hints: 1 },
  { id: "rq-3", studentId: "st-1004", homeworkId: "hw-03", title: "Растворы: массовая доля и разбавление", submittedAt: "2026-08-11", answers: 4, manual: 1, files: 1, hints: 4 },
];

/* ── РОДИТЕЛЬ ─────────────────────────────────────────────────────── */
export const CHILD_LINK: ChildLink = { parentId: "acc-pr", studentId: "st-1001", name: "Максим", grade: 11 };

export const PARENT_WEEK: ParentWeekDay[] = [
  { day: "Пн", minutes: 65, tasks: 8 },
  { day: "Вт", minutes: 40, tasks: 5 },
  { day: "Ср", minutes: 0, tasks: 0 },
  { day: "Чт", minutes: 75, tasks: 11 },
  { day: "Пт", minutes: 35, tasks: 4 },
  { day: "Сб", minutes: 90, tasks: 14 },
  { day: "Вс", minutes: 20, tasks: 2 },
];

export const PARENT_ADVICE: string[] = [
  "Не проверяйте ответы за ребёнка: спросите, как он объяснил бы решение вслух. Это и есть техника Фейнмана, она даёт больше, чем контроль оценок.",
  "Если день пропущен, помогите взять из него одно правило или три лёгких задания вместо двойной нормы — двойная норма ведёт к отказу от занятий.",
  "Слабые темы сейчас — дробные уравнения и растворы. Достаточно 10 минут повторения в день по красной зоне карточек.",
];

/* ── ТЕХНИКИ ЗАПОМИНАНИЯ ─────────────────────────────────────────── */
export const TECHNIQUES: Technique[] = [
  {
    id: "tq-feynman", title: "Слепой пересказ решения", subtitle: "Принцип Фейнмана",
    minutes: 10, kind: "core", trainerId: "tr-steps",
    summary: "Объясняете решение вслух, не глядя в тетрадь. Пассивное «понял» превращается в активное «умею» — а на ЦТ стресс блокирует именно пассивную память.",
    steps: [
      "Разберите пример до конца и закройте решение листом.",
      "Проговорите вслух каждый шаг: что видим, что делаем, почему.",
      "Запнулись — подсмотрите, но не переписывайте: вернитесь к началу и проговорите заново.",
      "Финальный прогон без единой подсказки.",
    ],
  },
  {
    id: "tq-color", title: "Цветовой код", subtitle: "Визуализация структуры",
    minutes: 5, kind: "core", trainerId: "tr-color",
    summary: "Длинная формула пугает целиком. Разбейте её зрительно: красный — степени, синий — логарифмы и тригонометрия, зелёный — числовые коэффициенты.",
    steps: [
      "Красным обводите степени и показатели.",
      "Синим — логарифмы и тригонометрические функции.",
      "Зелёным — числовые коэффициенты.",
      "Повторяйте формулу как цветовую картинку, а не как строку букв.",
    ],
  },
  {
    id: "tq-fingers", title: "Пальцы", subtitle: "Для запоминания алгоритмов",
    minutes: 4, kind: "core", trainerId: null,
    summary: "Каждый шаг типового алгоритма привязан к пальцу. Перед решением сожмите кулак и разгибайте пальцы по шагам — это защищает от пропуска действий.",
    steps: [
      "Мизинец — найти ОДЗ.",
      "Безымянный — найти производную.",
      "Средний — приравнять к нулю, критические точки.",
      "Указательный — расставить знаки на прямой.",
      "Большой — записать ответ.",
    ],
  },
  {
    id: "tq-derive", title: "От частного к общему", subtitle: "Анти-зубрёжка",
    minutes: 8, kind: "core", trainerId: null,
    summary: "Формулы не учат по справочнику — их выводят 2–3 раза на черновике. Мозг прочнее держит то, что создал сам.",
    steps: [
      "Запомните одну базовую формулу темы (матрёшку).",
      "Остальные выведите из неё на черновике.",
      "Пример: из log_a(bc) = log_a b + log_a c выводятся частное и степень за 10 секунд.",
    ],
  },
  {
    id: "tq-audio", title: "Диктофон для ушей", subtitle: "Аудио-повтор",
    minutes: 15, kind: "core", trainerId: null,
    summary: "Теоремы, признаки и свойства хорошо ложатся на слух. Собственный голос мозг воспринимает как важную команду.",
    steps: [
      "Начитайте сложные формулировки на диктофон своим голосом.",
      "Слушайте 15 минут перед сном.",
      "Повторите утром, пока чистите зубы.",
    ],
  },
  {
    id: "tq-reverse", title: "Обратный ход", subtitle: "Спецтехника для ЦТ",
    minutes: 12, kind: "core", trainerId: "tr-error",
    summary: "Большая часть потерь на ЦТ — невнимательность. Внесите в черновик нарочитую ошибку, дойдите до ответа, а затем найдите её заново: мозг включает «режим детектива».",
    steps: [
      "Решите уравнение, специально потеряв минус на третьем шаге.",
      "Доведите решение до ответа.",
      "Решите заново, отыскивая подложенную ошибку.",
      "Зафиксируйте, какой шаг оказался самым уязвимым.",
    ],
  },
];

// Интервальное повторение: 5-карточный бокс.
export const REVIEW_INTERVALS: ReviewInterval[] = [
  { n: 1, label: "через 20 минут", hint: "Проговорить алгоритм вслух" },
  { n: 2, label: "на следующий день", hint: "Пробежать задачу взглядом утром" },
  { n: 3, label: "через 3 дня", hint: "Решить заново и быстрее" },
  { n: 4, label: "через 7 дней", hint: "Контроль на выходных" },
  { n: 5, label: "через 14 дней", hint: "Финальная проверка, карточка уходит в архив" },
];

export const REVIEW_CARDS: ReviewCard[] = [
  { id: "rc-1", title: "ОДЗ дробного уравнения и посторонние корни", topicId: "tp-frac", zone: "red", box: 2, due: "2026-08-14" },
  { id: "rc-2", title: "Смешивание растворов: баланс массы вещества", topicId: "tp-solut", zone: "red", box: 1, due: "2026-08-13" },
  { id: "rc-3", title: "Основное свойство пропорции", topicId: "tp-prop", zone: "yellow", box: 3, due: "2026-08-16" },
  { id: "rc-4", title: "Процент от числа и обратная задача", topicId: "tp-perc", zone: "yellow", box: 3, due: "2026-08-17" },
  { id: "rc-5", title: "Линейное уравнение с параметром a", topicId: "tp-lin", zone: "green", box: 5, due: "2026-08-27" },
];

export const ZONES: Zone[] = [
  { id: "red", name: "Красная зона", desc: "Путаете постоянно — ошибка в каждом третьем тесте", freq: "Каждый день по 5 минут", color: "var(--color-bad)" },
  { id: "yellow", name: "Жёлтая зона", desc: "Знаете, но решаете медленно", freq: "Через день, в дни предмета", color: "var(--color-accent)" },
  { id: "green", name: "Зелёная зона", desc: "Щёлкаете как орешки", freq: "Раз в две недели", color: "var(--color-ok)" },
];

// Недельная архитектура нагрузки.
export const WEEK_PLAN: WeekPlanDay[] = [
  { day: "Понедельник", block: "Математика + смежные (физика, химия)" },
  { day: "Вторник", block: "Языки + обществоведение" },
  { day: "Среда", block: "Самый слабый предмет + разбор ошибок" },
  { day: "Четверг", block: "Математика (основной блок)" },
  { day: "Пятница", block: "Языки + история" },
  { day: "Суббота", block: "Слабый предмет + недельный разбор" },
  { day: "Воскресенье", block: "Выходной, лёгкое повторение за завтраком" },
];

export const WAVES: Wave[] = [
  { n: 1, when: "Утро · 45 мин", what: "Новая тема или разбор сложного номера ЦТ" },
  { n: 2, when: "День · 45 мин", what: "Задачи строго по этой же теме — закрепление" },
  { n: 3, when: "Вечер · 30–40 мин", what: "Повторение прошлой темы и прогон формул без подглядывания" },
];

/* ── ТРЕНАЖЁРЫ ───────────────────────────────────────────────────── */
export const TRAINERS: Trainer[] = [
  {
    id: "tr-equations", title: "Уравняй!", kind: "equations",
    subtitle: "Линейные уравнения на скорость",
    description: "Три жизни, комбо за серию верных ответов и таймер на каждое уравнение. Задания генерируются, поэтому серия не повторяется.",
    techniqueId: null, seconds: 25, lives: 3,
  },
  {
    id: "tr-steps", title: "Слепой пересказ", kind: "order",
    subtitle: "Соберите решение по шагам",
    description: "Шаги решения перемешаны. Восстановите порядок по памяти — это письменный вариант техники Фейнмана.",
    techniqueId: "tq-feynman",
    rounds: [
      { id: "o1", prompt: "Решите уравнение (2x − 1)/(x + 4) = 3", steps: ["Записать ОДЗ: x ≠ −4", "Умножить обе части на (x + 4)", "Получить 2x − 1 = 3x + 12", "Привести подобные: −x = 13", "Записать ответ x = −13 и проверить ОДЗ"] },
      { id: "o2", prompt: "Найдите массовую долю после разбавления 150 г 20 %-го раствора 50 г воды", steps: ["Найти массу вещества: 150 · 0,2 = 30 г", "Найти новую массу раствора: 150 + 50 = 200 г", "Разделить массу вещества на массу раствора", "Перевести в проценты: 0,15 = 15 %"] },
      { id: "o3", prompt: "Исследование функции через производную", steps: ["Найти ОДЗ функции", "Найти производную", "Приравнять производную к нулю", "Расставить знаки на числовой прямой", "Записать промежутки и ответ"] },
    ],
  },
  {
    id: "tr-color", title: "Цветовой код", kind: "color",
    subtitle: "Красный, синий, зелёный",
    description: "Определите, каким цветом обводится элемент формулы: степени — красным, логарифмы и тригонометрия — синим, числовые коэффициенты — зелёным.",
    techniqueId: "tq-color",
    items: [
      { id: "c1", text: "x⁴", color: "red" }, { id: "c2", text: "log₂(x)", color: "blue" },
      { id: "c3", text: "5", color: "green" }, { id: "c4", text: "sin(2α)", color: "blue" },
      { id: "c5", text: "a^(n+1)", color: "red" }, { id: "c6", text: "−3/4", color: "green" },
      { id: "c7", text: "cos²β", color: "blue" }, { id: "c8", text: "0,25", color: "green" },
      { id: "c9", text: "(x + 1)³", color: "red" }, { id: "c10", text: "ln(e)", color: "blue" },
    ],
  },
  {
    id: "tr-error", title: "Обратный ход", kind: "error",
    subtitle: "Найдите подложенную ошибку",
    description: "В решении спрятан ровно один неверный шаг. Найдите его — техника включает «режим детектива» и цементирует алгоритм.",
    techniqueId: "tq-reverse",
    rounds: [
      { id: "e1", prompt: "Решите уравнение 5(x − 2) = 3x + 4", steps: ["5x − 10 = 3x + 4", "5x − 3x = 4 − 10", "2x = −6", "x = −3"], badIndex: 1, why: "При переносе −10 вправо знак меняется на плюс: 5x − 3x = 4 + 10, значит 2x = 14 и x = 7." },
      { id: "e2", prompt: "Найдите массовую долю: 40 г соли в 200 г раствора", steps: ["ω = m(в-ва) / m(р-ра)", "ω = 40 / 240", "ω = 0,167", "ω ≈ 16,7 %"], badIndex: 1, why: "200 г — это уже масса раствора, воду добавлять не нужно: ω = 40 / 200 = 20 %." },
      { id: "e3", prompt: "Решите пропорцию 3 : 8 = x : 24", steps: ["3 · 24 = 8 · x", "72 = 8x", "x = 72 · 8", "x = 576"], badIndex: 2, why: "Из 72 = 8x следует деление, а не умножение: x = 72 / 8 = 9." },
    ],
  },
];

export function trainerById(id: string): Trainer | undefined {
  return TRAINERS.find((t) => t.id === id);
}

export function techniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}
