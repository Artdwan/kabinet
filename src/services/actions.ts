// Component-level orchestration — the single write path for student screens.
// Every action optimistically updates local state (so the UI feels instant)
// and persists the change through the real API; low-frequency actions await
// the server response since it's authoritative (attempts count, scoring,
// unlock rules), high-frequency ones (typing) fire debounced in the background.
import { useCallback, useRef } from "react";
import type { QuizAnswerState } from "../types";
import type { Store } from "../types/state";
import { checkAnswer, emptyAttempt } from "./mockApi";
import { useStore } from "./StoreContext";
import { useToast } from "./ToastContext";
import { api } from "./apiClient";

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

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debounced(key: string, fn: () => void, delay = 600) {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(key, setTimeout(fn, delay));
}

export function useActions() {
  const { store, mutate } = useStore();
  const { show } = useToast();
  const storeRef = useRef(store);
  storeRef.current = store;

  const reportError = useCallback(
    (e: unknown) => {
      show(e instanceof Error ? e.message : "Не удалось сохранить изменения", "bad");
    },
    [show],
  );

  const setAnswer = useCallback(
    (hwId: string, exId: string, value: string | string[]) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.value = value;
        if (att.status === "correct" || att.status === "wrong") att.status = "saved";
      });
      debounced(`answer:${hwId}:${exId}`, () => {
        api.post(`/student/homework/${hwId}/exercises/${exId}/answer`, { value }).catch(reportError);
      });
    },
    [mutate, reportError],
  );

  const checkEx = useCallback(
    (hwId: string, exercise: { id: string; type: string; answer: unknown; hints?: unknown[] }) => {
      const attemptBefore = storeRef.current.homework[hwId]?.attempts[exercise.id];
      const optimisticValue = attemptBefore?.value ?? "";
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exercise.id);
        att.attempts += 1;
        att.status = checkAnswer(exercise as Parameters<typeof checkAnswer>[0], att.value);
      });
      api
        .post<{ status: string; attempts: number }>(`/student/homework/${hwId}/exercises/${exercise.id}/check`, { value: optimisticValue })
        .then((res) => {
          mutate((d) => {
            const att = ensureAttempt(d, hwId, exercise.id);
            att.status = res.status as typeof att.status;
            att.attempts = res.attempts;
          });
        })
        .catch(reportError);
    },
    [mutate, reportError],
  );

  const openHint = useCallback(
    (hwId: string, exercise: { id: string; hints: unknown[] }) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exercise.id);
        att.hintsOpened = Math.min(exercise.hints.length, att.hintsOpened + 1);
      });
      api.post(`/student/homework/${hwId}/exercises/${exercise.id}/hint`, {}).catch(reportError);
    },
    [mutate, reportError],
  );

  const openSolution = useCallback(
    async (hwId: string, exId: string) => {
      try {
        await api.post(`/student/homework/${hwId}/exercises/${exId}/solution`, {});
        mutate((d) => {
          const att = ensureAttempt(d, hwId, exId);
          att.solutionOpened = true;
        });
      } catch (e) {
        reportError(e);
      }
    },
    [mutate, reportError],
  );

  const setDraft = useCallback(
    (hwId: string, exId: string, text: string) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.draftText = text;
      });
      debounced(`draft:${hwId}:${exId}`, () => {
        api.post(`/student/homework/${hwId}/exercises/${exId}/draft`, { text }).catch(reportError);
      });
    },
    [mutate, reportError],
  );

  const saveDrawing = useCallback(
    (hwId: string, exId: string, dataUrl: string | null) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.drawing = dataUrl;
      });
      api.post(`/student/homework/${hwId}/exercises/${exId}/drawing`, { dataUrl }).catch(reportError);
    },
    [mutate, reportError],
  );

  const addFiles = useCallback(
    async (hwId: string, exId: string, files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      try {
        const res = await api.upload<{ files: { id: string; name: string; size: number; type: string; kind: "PDF" | "ФОТО" }[] }>(
          `/student/homework/${hwId}/exercises/${exId}/attachments`,
          formData,
        );
        mutate((d) => {
          const att = ensureAttempt(d, hwId, exId);
          att.files = [...att.files, ...res.files];
        });
      } catch (e) {
        reportError(e);
      }
    },
    [mutate, reportError],
  );

  const removeFile = useCallback(
    (hwId: string, exId: string, fileId: string) => {
      mutate((d) => {
        const att = ensureAttempt(d, hwId, exId);
        att.files = att.files.filter((f) => f.id !== fileId);
      });
      api.del(`/student/homework/${hwId}/exercises/${exId}/attachments/${fileId}`).catch(reportError);
    },
    [mutate, reportError],
  );

  const submitHomework = useCallback(
    async (hwId: string) => {
      try {
        await api.post(`/student/homework/${hwId}/submit`, {});
        mutate((d) => {
          const hw = ensureHomework(d, hwId);
          hw.submittedAt = new Date().toISOString();
        });
        show("Работа отправлена преподавателю", "ok");
      } catch (e) {
        reportError(e);
      }
    },
    [mutate, show, reportError],
  );

  const toggleFavoriteTheory = useCallback(
    (materialId: string) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        d.theory[materialId].favorite = !d.theory[materialId].favorite;
      });
      api.post(`/student/theory/${materialId}/favorite`, {}).catch(reportError);
    },
    [mutate, reportError],
  );

  const toggleStudiedTheory = useCallback(
    (materialId: string) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        const t = d.theory[materialId];
        t.read = !t.read;
        t.progress = t.read ? 100 : 60;
      });
      api.post(`/student/theory/${materialId}/studied`, {}).catch(reportError);
    },
    [mutate, reportError],
  );

  const answerTheoryQuiz = useCallback(
    (materialId: string, qId: string, state: QuizAnswerState) => {
      mutate((d) => {
        if (!d.theory[materialId]) d.theory[materialId] = { progress: 0, favorite: false, read: false, lastBlock: 0, quiz: {} };
        d.theory[materialId].quiz[qId] = state;
      });
      api.post(`/student/theory/${materialId}/quiz`, { questionId: qId, value: state.value, status: state.status }).catch(reportError);
    },
    [mutate, reportError],
  );

  const startTest = useCallback(
    (testId: string, only: string[] | null = null) => {
      mutate((d) => {
        d.tests[testId] = { testId, startedAt: new Date().toISOString(), answers: {}, flagged: {}, current: 0, elapsed: 0, finishedAt: null, only };
      });
      api.post(`/student/tests/${testId}/start`, { only }).catch(reportError);
    },
    [mutate, reportError],
  );

  const answerQuestion = useCallback(
    (testId: string, qId: string, value: string | string[] | undefined) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.answers[qId] = value;
      });
      debounced(`ctanswer:${testId}:${qId}`, () => {
        api.post(`/student/tests/${testId}/answer`, { questionId: qId, value }).catch(reportError);
      }, 400);
    },
    [mutate, reportError],
  );

  const toggleFlag = useCallback(
    (testId: string, qId: string) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.flagged[qId] = !t.flagged[qId];
      });
      api.post(`/student/tests/${testId}/flag`, { questionId: qId }).catch(reportError);
    },
    [mutate, reportError],
  );

  const setCurrent = useCallback(
    (testId: string, index: number) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.current = index;
      });
      api.post(`/student/tests/${testId}/current`, { index }).catch(reportError);
    },
    [mutate, reportError],
  );

  const tickElapsed = useCallback(
    (testId: string, seconds: number) => {
      mutate((d) => {
        const t = d.tests[testId];
        if (!t) return;
        t.elapsed = seconds;
      });
      api.post(`/student/tests/${testId}/tick`, { elapsed: seconds }).catch(() => {});
    },
    [mutate],
  );

  const finishTest = useCallback(
    async (testId: string): Promise<{ counted: boolean; score: number }> => {
      mutate((d) => {
        const t = d.tests[testId];
        if (t) t.finishedAt = new Date().toISOString();
      });
      try {
        const res = await api.post<{ counted: boolean; score?: number; result?: { score: number; topicAccuracy: Record<string, number> } }>(
          `/student/tests/${testId}/finish`,
          {},
        );
        if (res.counted && res.result) {
          const test = storeRef.current.tests[testId];
          mutate((d) => {
            d.results.push({
              id: `res-${Date.now()}`,
              testId,
              title: "",
              subjectId: "",
              date: new Date().toISOString().slice(0, 10),
              score: res.result!.score,
              minutes: test ? Math.round(test.elapsed / 60) : 0,
            });
          });
        }
        show(res.counted ? `Тест завершён — результат ${res.score ?? res.result?.score} баллов` : "Тест закрыт без ответов — результат не засчитан", res.counted ? "ok" : "bad");
        return { counted: res.counted, score: res.score ?? res.result?.score ?? 0 };
      } catch (e) {
        reportError(e);
        return { counted: false, score: 0 };
      }
    },
    [mutate, show, reportError],
  );

  const toggleTechniqueStep = useCallback(
    (techniqueId: string, stepIndex: number) => {
      mutate((d) => {
        if (!d.techniques[techniqueId]) d.techniques[techniqueId] = { practiced: 0, done: [] };
        const done = d.techniques[techniqueId].done;
        d.techniques[techniqueId].done = done.includes(stepIndex) ? done.filter((i) => i !== stepIndex) : [...done, stepIndex];
      });
      api.post(`/student/techniques/${techniqueId}/step`, { stepIndex }).catch(reportError);
    },
    [mutate, reportError],
  );

  const recordTechniquePractice = useCallback(
    (techniqueId: string) => {
      mutate((d) => {
        if (!d.techniques[techniqueId]) d.techniques[techniqueId] = { practiced: 0, done: [] };
        d.techniques[techniqueId].practiced += 1;
        d.techniques[techniqueId].lastAt = new Date().toISOString();
      });
      api
        .post(`/student/techniques/${techniqueId}/practice`, {})
        .then(() => show("Практика засчитана", "ok"))
        .catch(reportError);
    },
    [mutate, show, reportError],
  );

  const advanceReviewCard = useCallback(
    (cardId: string, remembered: boolean, maxStage: number) => {
      mutate((d) => {
        const prev = d.reviewCards[cardId];
        const box = prev ? prev.box : 1;
        const nextBox = remembered ? Math.min(maxStage, box + 1) : 1;
        d.reviewCards[cardId] = { box: nextBox, due: new Date().toISOString().slice(0, 10) };
      });
      api.post(`/student/review-cards/${cardId}/advance`, { remembered, maxStage }).catch(reportError);
    },
    [mutate, reportError],
  );

  const saveGameRecord = useCallback(
    (trainerId: string, score: number) => {
      mutate((d) => {
        const prev = d.games[trainerId] || { best: 0, played: 0, lastScore: 0 };
        d.games[trainerId] = { best: Math.max(prev.best, score), played: prev.played + 1, lastScore: score };
      });
      api.post(`/student/games/${trainerId}/record`, { score }).catch(reportError);
    },
    [mutate, reportError],
  );

  const updateSettings = useCallback(
    (patch: Partial<Store["settings"]>) => {
      mutate((d) => {
        d.settings = { ...d.settings, ...patch };
      });
      api.post(`/student/settings`, { ...storeRef.current.settings, ...patch }).catch(reportError);
    },
    [mutate, reportError],
  );

  const markNotificationsRead = useCallback(
    (ids: string[]) => {
      mutate((d) => {
        d.notifications = d.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
      });
      api.post(`/student/notifications/read`, { ids }).catch(reportError);
    },
    [mutate, reportError],
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
  };
}

export function getHomeworkAttempt(store: Store, hwId: string, exId: string) {
  return store.homework[hwId]?.attempts[exId] || emptyAttempt();
}

export function isHomeworkSubmitted(store: Store, hwId: string): boolean {
  return Boolean(store.homework[hwId]?.submittedAt);
}
