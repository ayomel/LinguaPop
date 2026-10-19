import {
  getNextDueReview,
  recordRecall,
  type RecallOutcome,
  type ReviewStorage,
} from "./reviews.ts";
import { getEncounteredWords } from "./encounters.ts";

export interface ReviewCardController {
  dispose(): void;
}

export async function initializeReviewCard(
  root: Document = document,
  storage: ReviewStorage = chrome.storage.local,
  now: () => number = Date.now,
): Promise<ReviewCardController> {
  const prompt = root.querySelector<HTMLElement>("#review-prompt");
  const reveal = root.querySelector<HTMLButtonElement>("#review-reveal");
  const answer = root.querySelector<HTMLElement>("#review-answer");
  const actions = root.querySelector<HTMLElement>("#review-actions");
  const remembered = root.querySelector<HTMLButtonElement>("#review-remembered");
  const needPractice = root.querySelector<HTMLButtonElement>("#review-practice");
  const status = root.querySelector<HTMLElement>("#review-status");

  if (!prompt || !reveal || !answer || !actions || !remembered || !needPractice || !status) {
    throw new Error("LinguaPop review controls are missing.");
  }

  let currentEntryId: string | undefined;
  let disposed = false;

  const setActionDisabled = (disabled: boolean): void => {
    remembered.disabled = disabled;
    needPractice.disabled = disabled;
  };

  const renderNext = async (savedMessage?: string): Promise<void> => {
    reveal.hidden = true;
    answer.hidden = true;
    actions.hidden = true;
    answer.textContent = "";
    setActionDisabled(false);
    status.textContent = savedMessage ?? "Loading your review words…";

    try {
      const dueReview = await getNextDueReview(storage, now());
      if (disposed) return;

      if (!dueReview) {
        currentEntryId = undefined;
        const hasEncounters = Object.keys(await getEncounteredWords(storage)).length > 0;
        if (disposed) return;
        prompt.textContent = hasEncounters
          ? "No words are due right now. Check back later for another review."
          : "Browse to encounter a few words. New words will appear here for your first review.";
        status.textContent = savedMessage ?? "";
        return;
      }

      currentEntryId = dueReview.entry.id;
      prompt.textContent = `Try to recall the Spanish for “${dueReview.entry.english}”.`;
      answer.lang = "es";
      answer.textContent = dueReview.entry.spanish;
      reveal.hidden = false;
      status.textContent = savedMessage ?? "Think of the answer, then reveal it and choose how well you remembered.";
    } catch {
      currentEntryId = undefined;
      prompt.textContent = "Your review words could not be loaded.";
      status.textContent = "Check the extension storage and try again.";
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
    setActionDisabled(true);
    status.textContent = "Saving your review…";
    try {
      await recordRecall(currentEntryId, outcome, storage, now());
      await renderNext("Review saved. Your next review time is scheduled.");
    } catch {
      setActionDisabled(false);
      status.textContent = "Your review could not be saved. Try again.";
    }
  };

  const onRemembered = (): void => void onRecall("remembered");
  const onNeedPractice = (): void => void onRecall("need-practice");
  reveal.addEventListener("click", onReveal);
  remembered.addEventListener("click", onRemembered);
  needPractice.addEventListener("click", onNeedPractice);
  await renderNext();

  return {
    dispose() {
      disposed = true;
      reveal.removeEventListener("click", onReveal);
      remembered.removeEventListener("click", onRemembered);
      needPractice.removeEventListener("click", onNeedPractice);
    },
  };
}
