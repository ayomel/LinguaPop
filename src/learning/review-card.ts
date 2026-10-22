import {
  getNextDueReview,
  MAX_REVIEW_INTERVAL_DAYS,
  recordRecall,
  type RecallOutcome,
  type ReviewStorage,
} from "./reviews.ts";
import { getEncounteredWords } from "./encounters.ts";
import { englishToSpanishPair, type LanguagePair } from "../data/language-pairs.ts";
import { renderHighlightedContextSentence } from "./context-sentence.ts";

export interface ReviewCardController {
  dispose(): void;
}

export async function initializeReviewCard(
  root: Document = document,
  storage: ReviewStorage = chrome.storage.local,
  now: () => number = Date.now,
  pair: LanguagePair = englishToSpanishPair,
): Promise<ReviewCardController> {
  const prompt = root.querySelector<HTMLElement>("#review-prompt");
  const context = root.querySelector<HTMLElement>("#review-context");
  const reveal = root.querySelector<HTMLButtonElement>("#review-reveal");
  const answer = root.querySelector<HTMLElement>("#review-answer");
  const actions = root.querySelector<HTMLElement>("#review-actions");
  const remembered = root.querySelector<HTMLButtonElement>("#review-remembered");
  const needPractice = root.querySelector<HTMLButtonElement>("#review-practice");
  const status = root.querySelector<HTMLElement>("#review-status");

  if (!prompt || !context || !reveal || !answer || !actions || !remembered || !needPractice || !status) {
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
    context.hidden = true;
    context.replaceChildren();
    setActionDisabled(false);
    status.textContent = savedMessage ?? "Loading your review words…";

    try {
      const dueReview = await getNextDueReview(storage, now(), pair);
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
      const entryId = currentEntryId;
      const schedule = await recordRecall(entryId, outcome, storage, now());
      const graduatedEntry = pair.entries.find((entry) => entry.id === entryId);
      const savedMessage =
        outcome === "remembered" && schedule.intervalDays >= MAX_REVIEW_INTERVAL_DAYS
          ? `${graduatedEntry?.targetText ?? "This word"} has graduated and will no longer appear in reading practice. Return it to practice from the dashboard if you need it again.`
          : "Review saved. Your next review time is scheduled.";
      await renderNext(savedMessage);
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
