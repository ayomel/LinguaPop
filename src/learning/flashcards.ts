import { renderHighlightedContextSentence } from "./context-sentence.ts";
import { DEFAULT_DAILY_GOAL, getDailyGoalSettings, setDailyGoal } from "./daily-goals.ts";
import { getEncounteredWords } from "./encounters.ts";
import { getDueReviews, recordRecall, type RecallOutcome, type ReviewStorage } from "./reviews.ts";
import {
  englishToSpanishPair,
  type LanguagePair,
} from "../data/language-pairs.ts";

export interface FlashcardsController {
  dispose(): void;
}

export async function initializeFlashcards(
  root: Document = document,
  storage: ReviewStorage = chrome.storage.local,
  now: () => number = Date.now,
  pair: LanguagePair = englishToSpanishPair,
): Promise<FlashcardsController> {
  const prompt = root.querySelector<HTMLElement>("#flashcard-prompt");
  const context = root.querySelector<HTMLElement>("#flashcard-context");
  const reveal = root.querySelector<HTMLButtonElement>("#flashcard-reveal");
  const answer = root.querySelector<HTMLElement>("#flashcard-answer");
  const actions = root.querySelector<HTMLElement>("#flashcard-actions");
  const remembered = root.querySelector<HTMLButtonElement>("#flashcard-remembered");
  const needPractice = root.querySelector<HTMLButtonElement>("#flashcard-practice");
  const status = root.querySelector<HTMLElement>("#flashcard-status");
  const goalInput = root.querySelector<HTMLInputElement>("#daily-goal");
  const progress = root.querySelector<HTMLElement>("#daily-goal-progress");
  const goalStatus = root.querySelector<HTMLElement>("#daily-goal-status");

  if (
    !prompt || !context || !reveal || !answer || !actions || !remembered || !needPractice || !status ||
    !goalInput || !progress || !goalStatus
  ) {
    throw new Error("LinguaPop flashcard controls are missing.");
  }

  let currentEntryId: string | undefined;
  let completedToday = 0;
  let dailyGoal = DEFAULT_DAILY_GOAL;
  let disposed = false;
  let rendering = false;

  const disableActions = (disabled: boolean): void => {
    remembered.disabled = disabled;
    needPractice.disabled = disabled;
  };

  const updateGoalProgress = (): void => {
    progress.textContent = `${completedToday} of ${dailyGoal} reviews completed today.`;
    goalStatus.textContent =
      completedToday >= dailyGoal
        ? "Daily goal complete. You can keep reviewing or come back tomorrow."
        : `${dailyGoal - completedToday} ${dailyGoal - completedToday === 1 ? "review" : "reviews"} left to reach today's goal.`;
  };

  const renderNext = async (savedMessage?: string): Promise<void> => {
    if (rendering || disposed) return;
    rendering = true;
    reveal.hidden = true;
    answer.hidden = true;
    actions.hidden = true;
    answer.textContent = "";
    disableActions(false);
    status.textContent = "Loading your flashcards…";
    context.hidden = true;
    context.replaceChildren();

    try {
      const timestamp = now();
      const [settings, dueReviews] = await Promise.all([
        getDailyGoalSettings(storage, timestamp),
        getDueReviews(storage, timestamp, pair),
      ]);
      if (disposed) return;
      completedToday = settings.completed;
      dailyGoal = settings.goal;
      goalInput.value = String(dailyGoal);
      updateGoalProgress();

      const dueReview = dueReviews[0];
      if (!dueReview) {
        currentEntryId = undefined;
        const hasEncounters = Object.keys(await getEncounteredWords(storage)).length > 0;
        if (disposed) return;
        prompt.textContent = hasEncounters
          ? "No words are due right now. Check back later for another flashcard."
          : "Browse to encounter a few words. New words will appear here for your first flashcard.";
        status.textContent = savedMessage ?? "";
        return;
      }

      currentEntryId = dueReview.entry.id;
      prompt.textContent = `Try to recall the ${pair.targetLanguage.name} for “${dueReview.entry.sourceText}”.`;
      if (dueReview.contextSentence) {
        renderHighlightedContextSentence(
          context,
          dueReview.contextSentence,
          dueReview.entry.sourceText,
          pair.sourceLanguage.locale,
        );
      }
      reveal.textContent = `Reveal ${pair.targetLanguage.name}`;
      answer.lang = pair.targetLanguage.locale;
      answer.textContent = dueReview.entry.targetText;
      reveal.hidden = false;
      status.textContent = savedMessage ?? "Think of the answer, reveal it, then choose how well you remembered.";
    } catch {
      currentEntryId = undefined;
      prompt.textContent = "Your flashcards could not be loaded.";
      status.textContent = "Check extension storage and try again.";
    } finally {
      rendering = false;
    }
  };

  const onReveal = (): void => {
    if (!currentEntryId) return;
    reveal.hidden = true;
    answer.hidden = false;
    actions.hidden = false;
    status.textContent = "Choose Remembered or Need practice based on your recall.";
  };

  const onRecall = async (outcome: RecallOutcome): Promise<void> => {
    if (!currentEntryId) return;
    const entryId = currentEntryId;
    disableActions(true);
    status.textContent = "Saving your review…";
    try {
      await recordRecall(entryId, outcome, storage, now());
      currentEntryId = undefined;
      await renderNext("Review saved. Your next review time is scheduled.");
    } catch {
      disableActions(false);
      status.textContent = "Your review could not be saved. Try again.";
    }
  };

  const onRemembered = (): void => void onRecall("remembered");
  const onNeedPractice = (): void => void onRecall("need-practice");
  const onGoalChange = async (): Promise<void> => {
    const nextGoal = Number(goalInput.value);
    goalInput.setAttribute("aria-invalid", "false");
    try {
      await setDailyGoal(nextGoal, storage);
      dailyGoal = nextGoal;
      updateGoalProgress();
      goalStatus.textContent = `Daily goal set to ${dailyGoal} ${dailyGoal === 1 ? "review" : "reviews"}.`;
    } catch (error) {
      goalInput.setAttribute("aria-invalid", "true");
      goalStatus.textContent =
        error instanceof RangeError
          ? "Choose a whole number from 1 to 50."
          : "Your daily goal could not be saved. Try again.";
    }
  };

  reveal.addEventListener("click", onReveal);
  remembered.addEventListener("click", onRemembered);
  needPractice.addEventListener("click", onNeedPractice);
  goalInput.addEventListener("change", onGoalChange);
  await renderNext();

  return {
    dispose() {
      disposed = true;
      reveal.removeEventListener("click", onReveal);
      remembered.removeEventListener("click", onRemembered);
      needPractice.removeEventListener("click", onNeedPractice);
      goalInput.removeEventListener("change", onGoalChange);
    },
  };
}
