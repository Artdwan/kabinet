// Component-level orchestration on top of mockApi — the single write path
// for (almost) everything the student/teacher/parent screens do.
import { useCallback } from "react";
import type { Attachment, Exercise, Homework, QuizAnswerState } from "../types";
import type { Store } from "../types/state";
import { checkAnswer, emptyAttempt } from "./mockApi";
import { useStore } from "./StoreContext";
import { useToast } from "./ToastContext";
import { ctTestById } from "../data/content";
import { scoreSession } from "./testScoring";

function ensureHomework(draft: Store, hwId: string) {
  if (!draft.homework[hwId]) {
    draft.homework[hwId] = { startedAt: new Date().toISOString(), submittedAt: null, attempts: {} };
  }
  return draft.homework[hwId];
}

function ensureAttempt(draft: Store, hwId: string, exId: string) {
  const hw = ensureHomework(draft, hwId);
  if (!hw.attempts[exId]) hw.attempts[exId] = emptyAttempt();
  return hw.attempts[exId];
}

export function useActions() {
  const { store, mutate } = useStore();
  const { show } = useToast();

  const setAnswer = useCallback(
    (hwId: string, exId: string, value: string | string[]) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.value = value;
        if (att.status === "correct" || att.status === "wrong") att.status = "saved";
        d.lastPlace = { kind: "homework", id: hwId, exerciseId: exId };
      });
    },
    [mutate],
  );

  const checkEx = useCallback(
    (hwId: string, exercise: Exercise) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exercise.id);
        att.attempts += 1;
        att.status = checkAnswer(exercise, att.value);
      });
      // TODO backend: POST /analytics/events
      console.debug("[analytics]", "exercise_check", { exerciseId: exercise.id });
    },
    [mutate],
  );

  const openHint = useCallback(
    (hwId: string, exercise: Exercise) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exercise.id);
        att.hintsOpened = Math.min(exercise.hints.length, att.hintsOpened + 1);
      });
    },
    [mutate],
  );

  const openSolution = useCallback(
    (hwId: string, exId: string) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.solutionOpened = true;
      });
    },
    [mutate],
  );

  const setDraft = useCallback(
    (hwId: string, exId: string, text: string) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.draftText = text;
      });
    },
    [mutate],
  );

  const saveDrawing = useCallback(
    (hwId: string, exId: string, dataUrl: string | null) => {
      // TODO backend: рисунок сейчас лежит в localStorage как dataURL. Позже — POST /files.
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.drawing = dataUrl;
      });
    },
    [mutate],
  );

  const addFiles = useCallback(
    (hwId: string, exId: string, files: Attachment[]) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.files = [...att.files, ...files];
      });
    },
    [mutate],
  );

  const removeFile = useCallback(
    (hwId: string, exId: string, fileId: string) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.files = att.files.filter((f) => f.id !== fileId);
      });
    },
    [mutate],
  );

  const submitHomework = useCallback(
    (hwId: string) => {
      // TODO backend: сейчас mock, позже POST /homeworks/:id/submit.
      mutate((d) => {
        const hw = ensureHomework(d, hwId);
        hw.submittedAt = new Date().toISOString();
      });
      show("Работа отправлена преподавателю", "ok");
    },
    [mutate, show],
  );

  const toggleFavoriteTheory = useCallback(
    (materialId: string) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        d.theory[materialId].favorite = !d.theory[materialId].favorite;
      });
    },
    [mutate],
  );

  const toggleStudiedTheory = useCallback(
    (materialId: string) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        const t = d.theory[materialId];
        t.read = !t.read;
        t.progress = t.read ? 100 : 60;
      });
    },
    [mutate],
  );

  const answerTheoryQuiz = useCallback(
    (materialId: string, qId: string, state: QuizAnswerState) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        d.theory[materialId].quiz[qId] = state;
      });
    },
    [mutate],
  );

  const startTest = useCallback(
    (testId: string, only: string[] | null = null) => {
      mutate((d) => {
        d.tests[testId] = {
          testId,
          startedAt: new Date().toISOString(),
          answers: {},
          flagged: {},
          current: 0,
          elapsed: 0,
          finishedAt: null,
          only,
        };
      });
      console.debug("[analytics]", "test_start", { testId });
    },
    [mutate],
  );

  const answerQuestion = useCallback(
    (testId: string, qId: string, value: string | string[] | undefined) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.answers[qId] = value;
      });
    },
    [mutate],
  );

  const toggleFlag = useCallback(
    (testId: string, qId: string) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.flagged[qId] = !t.flagged[qId];
      });
    },
    [mutate],
  );

  const setCurrent = useCallback(
    (testId: string, index: number) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.current = index;
      });
    },
    [mutate],
  );

  const tickElapsed = useCallback(
    (testId: string, seconds: number) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.elapsed = seconds;
      });
    },
    [mutate],
  );

  const finishTest = useCallback(
    (testId: string): { counted: boolean; score: number } => {
      const session = store.tests[testId];
      const test = ctTestById(testId);
      const hasAnswers = Boolean(
        session &&
          Object.values(session.answers).some(
            (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length),
          ),
      );
      const result = session && test && hasAnswers ? scoreSession(test, session) : null;

      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.finishedAt = new Date().toISOString();
        if (!result || !test) return;
        // TODO backend: позже POST /ct-sessions/:id/finish, балл считает сервер.
        d.results.push({
          id: `res-${Date.now()}`,
          testId,
          title: test.title,
          subjectId: test.subjectId,
          date: new Date().toISOString().slice(0, 10),
          score: result.score,
          minutes: Math.round(t.elapsed / 60),
        });
      });

      const counted = Boolean(result);
      show(
        counted ? `Тест завершён — результат ${result!.score} баллов` : "Тест закрыт без ответов — результат не засчитан",
        counted ? "ok" : "bad",
      );
      return { counted, score: result?.score ?? 0 };
    },
    [store, mutate, show],
  );

  const toggleTechniqueStep = useCallback(
    (techniqueId: string, stepIndex: number) => {
      mutate((d) => {
        if (!d.techniques[techniqueId]) d.techniques[techniqueId] = { practiced: 0, done: [] };
        const done = d.techniques[techniqueId].done;
        d.techniques[techniqueId].done = done.includes(stepIndex) ? done.filter((i) => i !== stepIndex) : [...done, stepIndex];
      });
    },
    [mutate],
  );

  const recordTechniquePractice = useCallback(
    (techniqueId: string) => {
      mutate((d) => {
        if (!d.techniques[techniqueId]) d.techniques[techniqueId] = { practiced: 0, done: [] };
        d.techniques[techniqueId].practiced += 1;
        d.techniques[techniqueId].lastAt = new Date().toISOString();
      });
      show("Практика засчитана", "ok");
    },
    [mutate, show],
  );

  const advanceReviewCard = useCallback(
    (cardId: string, remembered: boolean, maxStage: number) => {
      mutate((d) => {
        const prev = d.reviewCards[cardId];
        const box = prev ? prev.box : 1;
        const nextBox = remembered ? Math.min(maxStage, box + 1) : 1;
        d.reviewCards[cardId] = { box: nextBox, due: new Date().toISOString().slice(0, 10) };
      });
    },
    [mutate],
  );

  const saveGameRecord = useCallback(
    (trainerId: string, score: number) => {
      mutate((d) => {
        const prev = d.games[trainerId] || { best: 0, played: 0, lastScore: 0 };
        d.games[trainerId] = {
          best: Math.max(prev.best, score),
          played: prev.played + 1,
          lastScore: score,
        };
      });
      console.debug("[analytics]", "trainer_start", { trainerId });
    },
    [mutate],
  );

  const updateSettings = useCallback(
    (patch: Partial<Store["settings"]>) => {
      mutate((d) => {
        d.settings = { ...d.settings, ...patch };
      });
    },
    [mutate],
  );

  const markNotificationsRead = useCallback(
    (ids: string[]) => {
      mutate((d) => {
        const set = new Set([...d.readNotifications, ...ids]);
        d.readNotifications = Array.from(set);
      });
    },
    [mutate],
  );

  const teacherSendReview = useCallback(
    (queueId: string, grade: string, comment: string) => {
      // TODO backend: позже POST /homeworks/:id/review — оценка, комментарий, отмеченные задания.
      mutate((d) => {
        d.teacher.reviewed[queueId] = { grade, comment, at: new Date().toISOString() };
      });
      show("Проверка отправлена ученику", "ok");
    },
    [mutate, show],
  );

  return {
    setAnswer,
    checkEx,
    openHint,
    openSolution,
    setDraft,
    saveDrawing,
    addFiles,
    removeFile,
    submitHomework,
    toggleFavoriteTheory,
    toggleStudiedTheory,
    answerTheoryQuiz,
    startTest,
    answerQuestion,
    toggleFlag,
    setCurrent,
    tickElapsed,
    finishTest,
    toggleTechniqueStep,
    recordTechniquePractice,
    advanceReviewCard,
    saveGameRecord,
    updateSettings,
    markNotificationsRead,
    teacherSendReview,
  };
}

export function getHomeworkAttempt(store: Store, hwId: string, exId: string) {
  return store.homework[hwId]?.attempts[exId] || emptyAttempt();
}

export function isHomeworkSubmitted(store: Store, hwId: string): boolean {
  return Boolean(store.homework[hwId]?.submittedAt);
}

export function homeworkById(homeworks: Homework[], id: string): Homework | undefined {
  return homeworks.find((h) => h.id === id);
}
