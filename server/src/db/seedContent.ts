// Global content — ported 1:1 from the original prototype's content model
// (frontend src/data/content.ts, src/data/roles.ts). This is the seed for
// the read-only content tables; a future authoring UI would write here
// instead without changing any endpoint below it.

export const SUBJECTS = [
  { id: "math", name: "Математика", short: "Мат" },
  { id: "chem", name: "Химия", short: "Хим" },
];

export const TOPICS = [
  { id: "tp-prop", subjectId: "math", name: "Пропорции" },
  { id: "tp-frac", subjectId: "math", name: "Дробные уравнения" },
  { id: "tp-lin", subjectId: "math", name: "Линейные уравнения" },
  { id: "tp-perc", subjectId: "math", name: "Проценты" },
  { id: "tp-solut", subjectId: "chem", name: "Задачи на растворы" },
  { id: "tp-atom", subjectId: "chem", name: "Строение атома" },
  { id: "tp-perlaw", subjectId: "chem", name: "Периодический закон" },
];

// Weakest-first — used to seed the demo student's ct_results topicAccuracy
// history and to pick the "recommended" test/topic for a fresh account.
export const TOPIC_ACCURACY_SEED = [
  { topicId: "tp-frac", accuracy: 48 },
  { topicId: "tp-solut", accuracy: 52 },
  { topicId: "tp-perc", accuracy: 66 },
  { topicId: "tp-perlaw", accuracy: 71 },
  { topicId: "tp-atom", accuracy: 84 },
  { topicId: "tp-lin", accuracy: 88 },
];

const PROP_THEORY = [
  { type: "heading", text: "Пропорция и её основное свойство" },
  { type: "text", text: "Пропорцией называют равенство двух отношений. Если отношение a к b равно отношению c к d, то четыре числа образуют пропорцию. Числа a и d называют крайними членами, b и c — средними." },
  { type: "formula", lines: ["a : b = c : d", "a · d = b · c"], caption: "Основное свойство пропорции" },
  { type: "note", title: "Как это использовать", text: "Любое уравнение вида «дробь равна дроби» можно сразу свести к произведению крест-накрест — это самый быстрый путь к линейному уравнению." },
  { type: "heading", text: "Дробные уравнения" },
  { type: "text", text: "Уравнение называется дробным (дробно-рациональным), если переменная стоит в знаменателе. Схема решения: найти область допустимых значений, привести к общему знаменателю, избавиться от знаменателей, решить получившееся уравнение и обязательно проверить корни по ОДЗ." },
  { type: "formula", lines: ["(x + 2) / (x − 3) = 5 / 2", "2 · (x + 2) = 5 · (x − 3)", "x = 19 / 3"], caption: "Переход к линейному уравнению" },
  { type: "warning", title: "Частая ошибка", text: "Корень, обращающий знаменатель в нуль, посторонний. Для примера выше x ≠ 3: если бы получилось x = 3, ответ был бы «корней нет»." },
  { type: "video", title: "Разбор: как избавиться от знаменателей", duration: "4:12" },
  { type: "image", caption: "Схема: алгоритм решения дробного уравнения (ОДЗ → общий знаменатель → проверка)" },
];

const SOLUT_THEORY = [
  { type: "heading", text: "Массовая доля растворённого вещества" },
  { type: "text", text: "Массовая доля показывает, какую часть массы раствора составляет растворённое вещество. Её выражают в долях единицы или в процентах." },
  { type: "formula", lines: ["ω = m(в-ва) / m(р-ра)", "m(р-ра) = m(в-ва) + m(H₂O)"], caption: "Базовые соотношения" },
  { type: "note", title: "Ориентир", text: "В задачах ЦТ почти всегда достаточно двух уравнений: баланс массы раствора и баланс массы вещества." },
  { type: "heading", text: "Разбавление и упаривание" },
  { type: "text", text: "При разбавлении водой масса вещества не меняется, меняется только масса раствора. При упаривании наоборот — уходит вода, вещество остаётся." },
  { type: "formula", lines: ["m₁ · ω₁ = m₂ · ω₂"], caption: "Правило сохранения массы вещества" },
  { type: "warning", title: "Внимание", text: "Проценты нельзя складывать напрямую при смешивании растворов — складываются массы вещества, а не доли." },
];

export const THEORY_MATERIALS = [
  {
    id: "th-prop", subjectId: "math", topicId: "tp-frac",
    title: "Пропорции и дробные уравнения",
    summary: "Основное свойство пропорции, переход к линейному уравнению, ОДЗ и посторонние корни.",
    minutes: 12, isNew: false, blocks: PROP_THEORY, relatedHomeworkIds: ["hw-02"],
    quiz: [
      { id: "q1", prompt: "Чему равно произведение крайних членов пропорции a : b = c : d?", type: "single", options: [{ id: "a", label: "b · c" }, { id: "b", label: "a + d" }, { id: "c", label: "a · d" }], answer: "c", explain: "Крайние члены — a и d, их произведение равно произведению средних." },
      { id: "q2", prompt: "Какое значение x недопустимо в уравнении (x + 2)/(x − 3) = 5/2?", type: "short", answer: "3", explain: "Знаменатель x − 3 не должен быть нулём." },
      { id: "q3", prompt: "Что нужно сделать после нахождения корня дробного уравнения?", type: "single", options: [{ id: "a", label: "Проверить корень по ОДЗ" }, { id: "b", label: "Округлить до целого" }, { id: "c", label: "Умножить на знаменатель" }], answer: "a", explain: "Проверка по ОДЗ отсекает посторонние корни." },
    ],
  },
  {
    id: "th-solut", subjectId: "chem", topicId: "tp-solut",
    title: "Растворы: массовая доля и разбавление",
    summary: "Массовая доля, смешивание, разбавление и упаривание — с расчётными схемами.",
    minutes: 9, isNew: true, blocks: SOLUT_THEORY, relatedHomeworkIds: ["hw-03"],
    quiz: [
      { id: "q1", prompt: "В 200 г раствора содержится 30 г соли. Массовая доля соли (в %)?", type: "short", answer: "15", explain: "30 / 200 = 0,15 = 15 %." },
      { id: "q2", prompt: "Что не меняется при разбавлении раствора водой?", type: "single", options: [{ id: "a", label: "Масса раствора" }, { id: "b", label: "Масса растворённого вещества" }, { id: "c", label: "Массовая доля" }], answer: "b", explain: "Вода добавляет массу раствору, вещество остаётся тем же." },
    ],
  },
];

const HW02_SECTIONS = [
  { id: "sc-theory", kind: "content", title: "Теория", blocks: PROP_THEORY },
  {
    id: "sc-examples", kind: "examples", title: "Разобранные примеры",
    examples: [
      { id: "ex-1", title: "Пример 1. Пропорция с неизвестным средним членом", prompt: "Решите пропорцию 4 : 6 = x : 15.", steps: ["Запишем основное свойство: 4 · 15 = 6 · x.", "60 = 6x, значит x = 10.", "Проверка: 4 : 6 = 10 : 15 = 2 : 3. ✓"], answer: "x = 10" },
      { id: "ex-2", title: "Пример 2. Дробное уравнение с проверкой ОДЗ", prompt: "Решите уравнение (2x − 1)/(x + 4) = 3.", steps: ["ОДЗ: x + 4 ≠ 0, то есть x ≠ −4.", "Умножим обе части на (x + 4): 2x − 1 = 3x + 12.", "−x = 13, значит x = −13.", "x = −13 входит в ОДЗ — корень подходит."], answer: "x = −13" },
    ],
  },
  {
    id: "sc-gr-a", kind: "exercises", title: "Группа A. Пропорции и отношения", hint: "Задания 1–4",
    exercises: [
      { id: "hw02-a1", no: "1", topicId: "tp-prop", type: "number", prompt: "Найдите неизвестный член пропорции: 3 : 8 = x : 24.", answer: 9, points: 1, hints: ["Вспомните основное свойство пропорции: произведение крайних равно произведению средних.", "Составьте уравнение 3 · 24 = 8 · x.", "Разделите 72 на 8."], solution: { steps: ["3 · 24 = 8 · x", "72 = 8x", "x = 9"], answerText: "x = 9" }, solutionPolicy: { mode: "immediate" } },
      { id: "hw02-a2", no: "2", topicId: "tp-prop", type: "number", prompt: "Отношение двух чисел равно 5 : 7, а их сумма равна 96. Найдите большее число.", answer: 56, points: 2, hints: ["Обозначьте числа как 5k и 7k.", "Сумма 12k = 96, найдите k.", "Большее число равно 7k."], solution: { steps: ["5k + 7k = 96", "12k = 96, k = 8", "Большее: 7 · 8 = 56"], answerText: "56" }, solutionPolicy: { mode: "after_attempts", attempts: 2 } },
      { id: "hw02-a3", no: "3", topicId: "tp-prop", type: "single", prompt: "Какая запись выражает основное свойство пропорции a : b = c : d?", options: [{ id: "o1", label: "a · c = b · d" }, { id: "o2", label: "a · d = b · c" }, { id: "o3", label: "a + d = b + c" }], answer: "o2", points: 1, hints: ["Крайние члены стоят по краям записи.", "Перемножаются крайние и средние члены."], solution: { steps: ["Крайние члены: a и d. Средние: b и c.", "Свойство: a · d = b · c."], answerText: "a · d = b · c" }, solutionPolicy: { mode: "immediate" } },
      { id: "hw02-a4", no: "4", topicId: "tp-perc", type: "text", prompt: "Масштаб карты 1 : 25000. Какому расстоянию на местности соответствует 6 см на карте? Ответ в метрах, только число.", answer: "1500", points: 2, hints: ["1 см на карте — это 25000 см на местности.", "6 · 25000 = 150000 см. Переведите в метры."], solution: { steps: ["6 · 25000 = 150000 см", "150000 см = 1500 м"], answerText: "1500 м" }, solutionPolicy: { mode: "after_attempts", attempts: 2 } },
    ],
  },
  {
    id: "sc-gr-b", kind: "exercises", title: "Группа B. Дробные уравнения", hint: "Задания 5–9",
    exercises: [
      { id: "hw02-b1", no: "5", topicId: "tp-frac", type: "number", prompt: "Решите уравнение: 12 / x = 4.", answer: 3, points: 1, hints: ["ОДЗ: x ≠ 0.", "Умножьте обе части на x."], solution: { steps: ["ОДЗ: x ≠ 0", "12 = 4x", "x = 3"], answerText: "x = 3" }, solutionPolicy: { mode: "immediate" } },
      { id: "hw02-b2", no: "6", topicId: "tp-frac", type: "multi", prompt: "Отметьте все значения, которые не входят в ОДЗ уравнения (x + 1) / ((x − 2)(x + 5)) = 0.", options: [{ id: "o1", label: "x = −5" }, { id: "o2", label: "x = −1" }, { id: "o3", label: "x = 0" }, { id: "o4", label: "x = 2" }], answer: ["o1", "o4"], points: 2, hints: ["ОДЗ нарушается там, где знаменатель равен нулю.", "Приравняйте каждый множитель знаменателя к нулю."], solution: { steps: ["(x − 2)(x + 5) ≠ 0", "x ≠ 2 и x ≠ −5"], answerText: "x = −5 и x = 2" }, solutionPolicy: { mode: "after_attempts", attempts: 1 } },
      { id: "hw02-b3", no: "7", topicId: "tp-frac", type: "number", prompt: "Решите уравнение: (2x − 1) / (x + 4) = 3.", answer: -13, points: 2, hints: ["ОДЗ: x ≠ −4.", "Умножьте обе части на (x + 4).", "Получите 2x − 1 = 3x + 12."], solution: { steps: ["ОДЗ: x ≠ −4", "2x − 1 = 3(x + 4)", "2x − 1 = 3x + 12", "x = −13"], answerText: "x = −13" }, solutionPolicy: { mode: "after_attempts", attempts: 2 } },
      { id: "hw02-b4", no: "8", topicId: "tp-frac", type: "single", prompt: "Сколько корней имеет уравнение (x − 3) / (x − 3) = 1?", options: [{ id: "o1", label: "Бесконечно много, кроме x = 3" }, { id: "o2", label: "Ровно один: x = 3" }, { id: "o3", label: "Корней нет" }], answer: "o1", points: 2, hints: ["Сначала выпишите ОДЗ.", "При x ≠ 3 дробь всегда равна 1."], solution: { steps: ["ОДЗ: x ≠ 3", "При любом другом x дробь равна 1", "Значит решение — все x, кроме 3"], answerText: "Все x, кроме x = 3" }, solutionPolicy: { mode: "teacher_approval" } },
      { id: "hw02-b5", no: "9", topicId: "tp-frac", type: "number", prompt: "Решите уравнение: 1/x + 1/(2x) = 3/4. В ответе укажите x.", answer: 2, points: 3, hints: ["ОДЗ: x ≠ 0.", "Приведите левую часть к общему знаменателю 2x.", "Получите 3/(2x) = 3/4."], solution: { steps: ["ОДЗ: x ≠ 0", "1/x + 1/(2x) = 3/(2x)", "3/(2x) = 3/4 → 2x = 4", "x = 2"], answerText: "x = 2" }, solutionPolicy: { mode: "after_submit" } },
    ],
  },
  {
    id: "sc-gr-c", kind: "exercises", title: "Группа C. Задачи на составление уравнений", hint: "Задания 10–12",
    exercises: [
      { id: "hw02-c1", no: "10", topicId: "tp-frac", type: "number", prompt: "Числитель дроби на 3 меньше знаменателя. Если числитель увеличить на 4, дробь станет равна 1. Найдите знаменатель.", answer: 4, points: 3, hints: ["Пусть знаменатель равен x, тогда числитель x − 3.", "Условие: (x − 3 + 4) / x = 1."], solution: { steps: ["(x + 1) / x = 1", "x + 1 = x — противоречие, значит проверяем условие", "Верная модель: (x − 3 + 4) = x → 1 = 0 ⇒ подбор: знаменатель 4, дробь 1/4 → 4/4 = 1", "Ответ: 4"], answerText: "4" }, solutionPolicy: { mode: "after_submit" } },
      { id: "hw02-c2", no: "11", topicId: "tp-frac", type: "manual", prompt: "Катер прошёл 30 км по течению и 30 км против течения за 8 часов. Скорость течения 2 км/ч. Найдите скорость катера в стоячей воде. Приложите полное решение: фото тетради или запись в черновике.", answer: null, points: 4, hints: ["Обозначьте скорость катера v, тогда по течению v + 2, против — v − 2.", "Составьте уравнение 30/(v + 2) + 30/(v − 2) = 8."], solution: { steps: ["30/(v + 2) + 30/(v − 2) = 8", "30(v − 2) + 30(v + 2) = 8(v² − 4)", "60v = 8v² − 32", "8v² − 60v − 32 = 0 → 2v² − 15v − 8 = 0", "v = 8 км/ч"], answerText: "8 км/ч" }, solutionPolicy: { mode: "after_submit" } },
      { id: "hw02-c3", no: "12", topicId: "tp-perc", type: "number", prompt: "Двое рабочих выполняют заказ за 6 часов. Первый один — за 10 часов. За сколько часов выполнит заказ второй?", answer: 15, points: 3, hints: ["Производительность первого 1/10 заказа в час.", "Совместная производительность 1/6.", "1/6 − 1/10 = 1/x."], solution: { steps: ["1/6 − 1/10 = (5 − 3)/30 = 1/15", "x = 15 часов"], answerText: "15 часов" }, solutionPolicy: { mode: "after_attempts", attempts: 3 } },
    ],
  },
];

const HW01_SECTIONS = [
  { id: "sc-theory", kind: "content", title: "Теория", blocks: [
    { type: "heading", text: "Линейные уравнения и системы" },
    { type: "text", text: "Линейное уравнение приводится к виду ax + b = 0. Систему двух линейных уравнений решают подстановкой, сложением или графически." },
    { type: "formula", lines: ["ax + b = 0", "x = −b / a, a ≠ 0"], caption: "Общий вид" },
  ] },
  { id: "sc-gr-a", kind: "exercises", title: "Группа A. Уравнения", exercises: [
    { id: "hw01-a1", no: "1", topicId: "tp-lin", type: "number", prompt: "Решите уравнение 5x − 12 = 3x + 4.", answer: 8, points: 1, hints: ["Перенесите переменные в одну часть."], solution: { steps: ["2x = 16", "x = 8"], answerText: "x = 8" }, solutionPolicy: { mode: "immediate" } },
    { id: "hw01-a2", no: "2", topicId: "tp-lin", type: "number", prompt: "При каком значении a уравнение ax = 7 не имеет корней?", answer: 0, points: 2, hints: ["Разберите случай a = 0."], solution: { steps: ["При a = 0 получаем 0 = 7 — корней нет"], answerText: "a = 0" }, solutionPolicy: { mode: "immediate" } },
    { id: "hw01-a3", no: "3", topicId: "tp-lin", type: "number", prompt: "Решите систему: x + y = 10, x − y = 2. В ответе укажите x.", answer: 6, points: 2, hints: ["Сложите уравнения."], solution: { steps: ["2x = 12", "x = 6, y = 4"], answerText: "x = 6" }, solutionPolicy: { mode: "immediate" } },
  ] },
];

const HW03_SECTIONS = [
  { id: "sc-theory", kind: "content", title: "Теория", blocks: SOLUT_THEORY },
  { id: "sc-gr-a", kind: "exercises", title: "Группа A. Массовая доля", exercises: [
    { id: "hw03-a1", no: "1", topicId: "tp-solut", type: "number", prompt: "В 250 г раствора растворено 40 г соли. Найдите массовую долю соли в процентах.", answer: 16, points: 1, hints: ["ω = m(в-ва) / m(р-ра).", "40 / 250 = 0,16."], solution: { steps: ["ω = 40 / 250 = 0,16", "ω = 16 %"], answerText: "16 %" }, solutionPolicy: { mode: "immediate" } },
    { id: "hw03-a2", no: "2", topicId: "tp-solut", type: "number", prompt: "К 150 г 20 %-го раствора добавили 50 г воды. Найдите новую массовую долю (в %).", answer: 15, points: 2, hints: ["Масса вещества не изменилась.", "m(в-ва) = 150 · 0,2 = 30 г; новая масса раствора 200 г."], solution: { steps: ["m(в-ва) = 30 г", "m(р-ра) = 200 г", "ω = 30/200 = 15 %"], answerText: "15 %" }, solutionPolicy: { mode: "after_attempts", attempts: 2 } },
    { id: "hw03-a3", no: "3", topicId: "tp-solut", type: "multi", prompt: "Отметьте всё, что верно при упаривании раствора.", options: [{ id: "o1", label: "Масса вещества не меняется" }, { id: "o2", label: "Масса раствора уменьшается" }, { id: "o3", label: "Массовая доля уменьшается" }], answer: ["o1", "o2"], points: 2, hints: ["Уходит только вода."], solution: { steps: ["Вода испаряется, вещество остаётся", "Доля растёт"], answerText: "Первое и второе" }, solutionPolicy: { mode: "immediate" } },
    { id: "hw03-a4", no: "4", topicId: "tp-solut", type: "manual", prompt: "Смешали 120 г 10 %-го и 80 г 25 %-го растворов. Найдите массовую долю полученного раствора. Приложите расчёт.", answer: null, points: 3, hints: ["Считайте массу вещества в каждом растворе отдельно.", "m(в-ва) = 12 + 20 = 32 г, m(р-ра) = 200 г."], solution: { steps: ["12 + 20 = 32 г", "32 / 200 = 0,16", "ω = 16 %"], answerText: "16 %" }, solutionPolicy: { mode: "after_submit" } },
  ] },
];

const HW04_SECTIONS = [
  { id: "sc-gr-a", kind: "exercises", title: "Контрольные вопросы", exercises: [
    { id: "hw04-a1", no: "1", topicId: "tp-atom", type: "number", prompt: "Сколько нейтронов в атоме ³⁵Cl (Z = 17)?", answer: 18, points: 1, hints: ["N = A − Z."], solution: { steps: ["35 − 17 = 18"], answerText: "18" }, solutionPolicy: { mode: "after_submit" } },
    { id: "hw04-a2", no: "2", topicId: "tp-atom", type: "single", prompt: "Какая электронная конфигурация соответствует атому кислорода?", options: [{ id: "o1", label: "1s² 2s² 2p⁴" }, { id: "o2", label: "1s² 2s² 2p⁶" }, { id: "o3", label: "1s² 2s¹" }], answer: "o1", points: 1, hints: ["У кислорода 8 электронов."], solution: { steps: ["8 электронов: 2 + 2 + 4"], answerText: "1s² 2s² 2p⁴" }, solutionPolicy: { mode: "after_submit" } },
    { id: "hw04-a3", no: "3", topicId: "tp-perlaw", type: "text", prompt: "Как изменяется радиус атома в периоде слева направо? Одно слово.", answer: "уменьшается", points: 2, hints: ["Заряд ядра растёт, притяжение сильнее."], solution: { steps: ["Заряд ядра увеличивается, электронных слоёв столько же", "Радиус уменьшается"], answerText: "Уменьшается" }, solutionPolicy: { mode: "after_submit" } },
  ] },
];

const HW05_SECTIONS = [
  { id: "sc-gr-a", kind: "exercises", title: "Группа A. Проценты", exercises: [
    { id: "hw05-a1", no: "1", topicId: "tp-perc", type: "number", prompt: "Товар стоил 240 руб. и подорожал на 15 %. Новая цена?", answer: 276, points: 1, hints: ["240 · 1,15."], solution: { steps: ["240 · 1,15 = 276"], answerText: "276 руб." }, solutionPolicy: { mode: "immediate" } },
    { id: "hw05-a2", no: "2", topicId: "tp-perc", type: "number", prompt: "Цена снизилась с 500 до 425 руб. На сколько процентов?", answer: 15, points: 2, hints: ["Разность делим на исходную цену."], solution: { steps: ["75 / 500 = 0,15", "15 %"], answerText: "15 %" }, solutionPolicy: { mode: "immediate" } },
  ] },
];

export const HOMEWORKS = [
  { id: "hw-02", subjectId: "math", topicId: "tp-frac", title: "Тетрадь 02 — Пропорции и дробные уравнения", summary: "Теория, два разобранных примера и три группы заданий. Работа выполняется прямо в тетради.", assignedAt: "2026-08-03", dueAt: "2026-08-18", allowInstantCheck: true, sections: HW02_SECTIONS },
  { id: "hw-03", subjectId: "chem", topicId: "tp-solut", title: "Растворы: массовая доля и разбавление", summary: "Расчётные задачи на массовую долю, разбавление и смешивание растворов.", assignedAt: "2026-08-10", dueAt: "2026-08-21", allowInstantCheck: true, sections: HW03_SECTIONS },
  { id: "hw-01", subjectId: "math", topicId: "tp-lin", title: "Тетрадь 01 — Линейные уравнения и системы", summary: "Проверенная работа с комментарием преподавателя.", assignedAt: "2026-07-20", dueAt: "2026-07-28", allowInstantCheck: true, sections: HW01_SECTIONS },
  { id: "hw-04", subjectId: "chem", topicId: "tp-atom", title: "Строение атома — контрольные вопросы", summary: "Короткая работа: конфигурации, состав ядра, периодические закономерности.", assignedAt: "2026-08-04", dueAt: "2026-08-10", allowInstantCheck: false, sections: HW04_SECTIONS },
  { id: "hw-05", subjectId: "math", topicId: "tp-perc", title: "Тетрадь 00 — Проценты", summary: "Базовая работа на проценты. Срок сдачи истёк.", assignedAt: "2026-07-27", dueAt: "2026-08-05", allowInstantCheck: true, sections: HW05_SECTIONS },
];

export const CT_TESTS = [
  {
    id: "ct-frac", subjectId: "math", topicId: "tp-frac", title: "Дробные уравнения — тренировка",
    format: "thematic", difficulty: "Средний", minutes: 20,
    description: "Шесть заданий на ОДЗ, переход к линейному уравнению и посторонние корни.",
    questions: [
      { id: "q1", no: 1, topicId: "tp-frac", type: "single", text: "Найдите ОДЗ уравнения 5/(x − 7) = 2.", options: [{ id: "o1", label: "x ≠ 0" }, { id: "o2", label: "x ≠ 7" }, { id: "o3", label: "x ≠ −7" }], answer: "o2", hint: "Знаменатель не должен быть равен нулю.", solution: "x − 7 ≠ 0, значит x ≠ 7." },
      { id: "q2", no: 2, topicId: "tp-frac", type: "short", text: "Решите уравнение 18/x = 6. Ответ — число.", answer: "3", hint: "Умножьте обе части на x.", solution: "18 = 6x, x = 3." },
      { id: "q3", no: 3, topicId: "tp-frac", type: "single", text: "Сколько корней имеет уравнение (x² − 9)/(x − 3) = 0?", options: [{ id: "o1", label: "Один: x = −3" }, { id: "o2", label: "Два: x = ±3" }, { id: "o3", label: "Корней нет" }], answer: "o1", hint: "x = 3 не входит в ОДЗ.", solution: "Числитель равен нулю при x = ±3, но x = 3 запрещено ОДЗ. Остаётся x = −3." },
      { id: "q4", no: 4, topicId: "tp-frac", type: "multi", text: "Отметьте все уравнения, являющиеся дробными.", options: [{ id: "o1", label: "3/x = 1" }, { id: "o2", label: "2x + 5 = 0" }, { id: "o3", label: "(x + 1)/(x − 2) = 4" }, { id: "o4", label: "x/3 = 5" }], answer: ["o1", "o3"], hint: "Дробное — если переменная в знаменателе.", solution: "В x/3 и 2x + 5 переменной в знаменателе нет." },
      { id: "q5", no: 5, topicId: "tp-frac", type: "short", text: "Решите уравнение (3x + 1)/(x − 1) = 4. Ответ — число.", answer: "5", hint: "Умножьте на (x − 1).", solution: "3x + 1 = 4x − 4, значит x = 5." },
      { id: "q6", no: 6, topicId: "tp-prop", type: "short", text: "Найдите x из пропорции 7 : x = 21 : 9.", answer: "3", hint: "7 · 9 = 21 · x.", solution: "63 = 21x, x = 3." },
    ],
  },
  {
    id: "ct-solut", subjectId: "chem", topicId: "tp-solut", title: "Растворы — тренировка",
    format: "thematic", difficulty: "Высокий", minutes: 15,
    description: "Массовая доля, разбавление, смешивание. Рекомендовано по слабой теме.",
    questions: [
      { id: "q1", no: 1, topicId: "tp-solut", type: "short", text: "В 400 г раствора 60 г вещества. Массовая доля в процентах?", answer: "15", hint: "ω = m(в-ва)/m(р-ра).", solution: "60/400 = 0,15 = 15 %." },
      { id: "q2", no: 2, topicId: "tp-solut", type: "single", text: "К 200 г 10 %-го раствора добавили 200 г воды. Новая массовая доля?", options: [{ id: "o1", label: "5 %" }, { id: "o2", label: "10 %" }, { id: "o3", label: "20 %" }], answer: "o1", hint: "Масса вещества постоянна.", solution: "20 г вещества в 400 г раствора → 5 %." },
      { id: "q3", no: 3, topicId: "tp-solut", type: "short", text: "Сколько граммов соли нужно для 300 г 12 %-го раствора?", answer: "36", hint: "m = m(р-ра) · ω.", solution: "300 · 0,12 = 36 г." },
      { id: "q4", no: 4, topicId: "tp-solut", type: "multi", text: "Что увеличивает массовую долю раствора?", options: [{ id: "o1", label: "Упаривание" }, { id: "o2", label: "Добавление воды" }, { id: "o3", label: "Добавление вещества" }], answer: ["o1", "o3"], hint: "Нужно увеличить долю вещества.", solution: "Упаривание убирает воду, добавление вещества увеличивает числитель." },
      { id: "q5", no: 5, topicId: "tp-solut", type: "short", text: "Смешали 100 г 20 % и 100 г 40 % растворов. Массовая доля смеси в процентах?", answer: "30", hint: "Сложите массы вещества.", solution: "(20 + 40)/200 = 0,30 = 30 %." },
    ],
  },
  {
    id: "ct-full-math", subjectId: "math", topicId: null, title: "Полный вариант ЦТ — математика",
    format: "full", difficulty: "Смешанная", minutes: 180,
    description: "Демонстрационный вариант: в прототипе 8 заданий из 30, структура та же.",
    questions: [
      { id: "q1", no: 1, topicId: "tp-perc", type: "short", text: "Найдите 18 % от 450.", answer: "81", hint: "450 · 0,18.", solution: "450 · 0,18 = 81." },
      { id: "q2", no: 2, topicId: "tp-lin", type: "short", text: "Решите уравнение 7x − 9 = 4x + 12.", answer: "7", hint: "Соберите x в одной части.", solution: "3x = 21, x = 7." },
      { id: "q3", no: 3, topicId: "tp-prop", type: "short", text: "Найдите x: 4 : 9 = 12 : x.", answer: "27", hint: "Крест-накрест.", solution: "4x = 108, x = 27." },
      { id: "q4", no: 4, topicId: "tp-frac", type: "single", text: "Какое значение является посторонним корнем уравнения (x² − 4)/(x − 2) = 0?", options: [{ id: "o1", label: "x = −2" }, { id: "o2", label: "x = 2" }, { id: "o3", label: "x = 0" }], answer: "o2", hint: "Проверьте знаменатель.", solution: "x = 2 обращает знаменатель в нуль." },
      { id: "q5", no: 5, topicId: "tp-lin", type: "multi", text: "Отметьте все линейные уравнения.", options: [{ id: "o1", label: "3x + 2 = 0" }, { id: "o2", label: "x² = 4" }, { id: "o3", label: "0,5x = 7" }], answer: ["o1", "o3"], hint: "Степень переменной равна единице.", solution: "x² = 4 — квадратное." },
      { id: "q6", no: 6, topicId: "tp-perc", type: "short", text: "Вклад 1200 руб. вырос на 5 %. Сколько стало?", answer: "1260", hint: "1200 · 1,05.", solution: "1200 · 1,05 = 1260." },
      { id: "q7", no: 7, topicId: "tp-frac", type: "short", text: "Решите: 1/(x − 1) = 1/2.", answer: "3", hint: "Крест-накрест.", solution: "x − 1 = 2, x = 3." },
      { id: "q8", no: 8, topicId: "tp-prop", type: "single", text: "Числа 3 и 12 — крайние члены пропорции, одно из средних равно 6. Второе среднее?", options: [{ id: "o1", label: "4" }, { id: "o2", label: "6" }, { id: "o3", label: "9" }], answer: "o2", hint: "Произведение крайних 36.", solution: "36 = 6 · x, x = 6." },
    ],
  },
];

export const TECHNIQUES = [
  { id: "tq-feynman", title: "Слепой пересказ решения", subtitle: "Принцип Фейнмана", minutes: 10, trainerId: "tr-steps",
    summary: "Объясняете решение вслух, не глядя в тетрадь. Пассивное «понял» превращается в активное «умею» — а на ЦТ стресс блокирует именно пассивную память.",
    steps: ["Разберите пример до конца и закройте решение листом.", "Проговорите вслух каждый шаг: что видим, что делаем, почему.", "Запнулись — подсмотрите, но не переписывайте: вернитесь к началу и проговорите заново.", "Финальный прогон без единой подсказки."] },
  { id: "tq-color", title: "Цветовой код", subtitle: "Визуализация структуры", minutes: 5, trainerId: "tr-color",
    summary: "Длинная формула пугает целиком. Разбейте её зрительно: красный — степени, синий — логарифмы и тригонометрия, зелёный — числовые коэффициенты.",
    steps: ["Красным обводите степени и показатели.", "Синим — логарифмы и тригонометрические функции.", "Зелёным — числовые коэффициенты.", "Повторяйте формулу как цветовую картинку, а не как строку букв."] },
  { id: "tq-fingers", title: "Пальцы", subtitle: "Для запоминания алгоритмов", minutes: 4, trainerId: null,
    summary: "Каждый шаг типового алгоритма привязан к пальцу. Перед решением сожмите кулак и разгибайте пальцы по шагам — это защищает от пропуска действий.",
    steps: ["Мизинец — найти ОДЗ.", "Безымянный — найти производную.", "Средний — приравнять к нулю, критические точки.", "Указательный — расставить знаки на прямой.", "Большой — записать ответ."] },
  { id: "tq-derive", title: "От частного к общему", subtitle: "Анти-зубрёжка", minutes: 8, trainerId: null,
    summary: "Формулы не учат по справочнику — их выводят 2–3 раза на черновике. Мозг прочнее держит то, что создал сам.",
    steps: ["Запомните одну базовую формулу темы (матрёшку).", "Остальные выведите из неё на черновике.", "Пример: из log_a(bc) = log_a b + log_a c выводятся частное и степень за 10 секунд."] },
  { id: "tq-audio", title: "Диктофон для ушей", subtitle: "Аудио-повтор", minutes: 15, trainerId: null,
    summary: "Теоремы, признаки и свойства хорошо ложатся на слух. Собственный голос мозг воспринимает как важную команду.",
    steps: ["Начитайте сложные формулировки на диктофон своим голосом.", "Слушайте 15 минут перед сном.", "Повторите утром, пока чистите зубы."] },
  { id: "tq-reverse", title: "Обратный ход", subtitle: "Спецтехника для ЦТ", minutes: 12, trainerId: "tr-error",
    summary: "Большая часть потерь на ЦТ — невнимательность. Внесите в черновик нарочитую ошибку, дойдите до ответа, а затем найдите её заново: мозг включает «режим детектива».",
    steps: ["Решите уравнение, специально потеряв минус на третьем шаге.", "Доведите решение до ответа.", "Решите заново, отыскивая подложенную ошибку.", "Зафиксируйте, какой шаг оказался самым уязвимым."] },
];

export const REVIEW_CARD_DEFS = [
  { id: "rc-1", title: "ОДЗ дробного уравнения и посторонние корни", topicId: "tp-frac" },
  { id: "rc-2", title: "Смешивание растворов: баланс массы вещества", topicId: "tp-solut" },
  { id: "rc-3", title: "Основное свойство пропорции", topicId: "tp-prop" },
  { id: "rc-4", title: "Процент от числа и обратная задача", topicId: "tp-perc" },
  { id: "rc-5", title: "Линейное уравнение с параметром a", topicId: "tp-lin" },
];

export const TRAINERS = [
  { id: "tr-equations", title: "Уравняй!", kind: "equations", subtitle: "Линейные уравнения на скорость",
    description: "Три жизни, комбо за серию верных ответов и таймер на каждое уравнение. Задания генерируются, поэтому серия не повторяется.",
    techniqueId: null, seconds: 25, lives: 3 },
  { id: "tr-steps", title: "Слепой пересказ", kind: "order", subtitle: "Соберите решение по шагам",
    description: "Шаги решения перемешаны. Восстановите порядок по памяти — это письменный вариант техники Фейнмана.",
    techniqueId: "tq-feynman",
    rounds: [
      { id: "o1", prompt: "Решите уравнение (2x − 1)/(x + 4) = 3", steps: ["Записать ОДЗ: x ≠ −4", "Умножить обе части на (x + 4)", "Получить 2x − 1 = 3x + 12", "Привести подобные: −x = 13", "Записать ответ x = −13 и проверить ОДЗ"] },
      { id: "o2", prompt: "Найдите массовую долю после разбавления 150 г 20 %-го раствора 50 г воды", steps: ["Найти массу вещества: 150 · 0,2 = 30 г", "Найти новую массу раствора: 150 + 50 = 200 г", "Разделить массу вещества на массу раствора", "Перевести в проценты: 0,15 = 15 %"] },
      { id: "o3", prompt: "Исследование функции через производную", steps: ["Найти ОДЗ функции", "Найти производную", "Приравнять производную к нулю", "Расставить знаки на числовой прямой", "Записать промежутки и ответ"] },
    ] },
  { id: "tr-color", title: "Цветовой код", kind: "color", subtitle: "Красный, синий, зелёный",
    description: "Определите, каким цветом обводится элемент формулы: степени — красным, логарифмы и тригонометрия — синим, числовые коэффициенты — зелёным.",
    techniqueId: "tq-color",
    items: [
      { id: "c1", text: "x⁴", color: "red" }, { id: "c2", text: "log₂(x)", color: "blue" },
      { id: "c3", text: "5", color: "green" }, { id: "c4", text: "sin(2α)", color: "blue" },
      { id: "c5", text: "a^(n+1)", color: "red" }, { id: "c6", text: "−3/4", color: "green" },
      { id: "c7", text: "cos²β", color: "blue" }, { id: "c8", text: "0,25", color: "green" },
      { id: "c9", text: "(x + 1)³", color: "red" }, { id: "c10", text: "ln(e)", color: "blue" },
    ] },
  { id: "tr-error", title: "Обратный ход", kind: "error", subtitle: "Найдите подложенную ошибку",
    description: "В решении спрятан ровно один неверный шаг. Найдите его — техника включает «режим детектива» и цементирует алгоритм.",
    techniqueId: "tq-reverse",
    rounds: [
      { id: "e1", prompt: "Решите уравнение 5(x − 2) = 3x + 4", steps: ["5x − 10 = 3x + 4", "5x − 3x = 4 − 10", "2x = −6", "x = −3"], badIndex: 1, why: "При переносе −10 вправо знак меняется на плюс: 5x − 3x = 4 + 10, значит 2x = 14 и x = 7." },
      { id: "e2", prompt: "Найдите массовую долю: 40 г соли в 200 г раствора", steps: ["ω = m(в-ва) / m(р-ра)", "ω = 40 / 240", "ω = 0,167", "ω ≈ 16,7 %"], badIndex: 1, why: "200 г — это уже масса раствора, воду добавлять не нужно: ω = 40 / 200 = 20 %." },
      { id: "e3", prompt: "Решите пропорцию 3 : 8 = x : 24", steps: ["3 · 24 = 8 · x", "72 = 8x", "x = 72 · 8", "x = 576"], badIndex: 2, why: "Из 72 = 8x следует деление, а не умножение: x = 72 / 8 = 9." },
    ] },
];
