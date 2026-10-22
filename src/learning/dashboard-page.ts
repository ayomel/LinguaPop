import { englishToSpanishPair, type LanguagePair } from "../data/language-pairs.ts";
import { initializeTranslationTooltip } from "../content/tooltip.ts";
import {
  getVocabularyDashboardSnapshot,
  returnGraduatedWordToPractice,
} from "./dashboard.ts";
import { serializeAnkiExport, type AnkiExportRow } from "./ankiExport.ts";
import { initializeFlashcards } from "./flashcards.ts";
import type { ReviewStorage } from "./reviews.ts";

export interface VocabularyDashboardController {
  dispose(): void;
}

export async function initializeVocabularyDashboard(
  root: Document = document,
  storage: ReviewStorage = chrome.storage.local,
  now: () => number = Date.now,
  pair: LanguagePair = englishToSpanishPair,
): Promise<VocabularyDashboardController> {
  const summary = {
    encountered: root.querySelector<HTMLElement>("#count-encountered"),
    practicing: root.querySelector<HTMLElement>("#count-practicing"),
    learned: root.querySelector<HTMLElement>("#count-learned"),
    due: root.querySelector<HTMLElement>("#count-due"),
    graduated: root.querySelector<HTMLElement>("#count-graduated"),
  };
  const encounteredCount = summary.encountered;
  const practicingCount = summary.practicing;
  const learnedCount = summary.learned;
  const dueCount = summary.due;
  const graduatedCount = summary.graduated;
  const list = root.querySelector<HTMLUListElement>("#vocabulary-list");
  const graduatedList = root.querySelector<HTMLUListElement>("#graduated-list");
  const exportButton = root.querySelector<HTMLButtonElement>("#export-vocabulary");
  const exportStatus = root.querySelector<HTMLElement>("#export-status");
  const graduatedStatus = root.querySelector<HTMLElement>("#graduated-status");
  const empty = root.querySelector<HTMLElement>("#dashboard-empty");
  const graduatedEmpty = root.querySelector<HTMLElement>("#graduated-empty");
  const status = root.querySelector<HTMLElement>("#dashboard-status");
  const error = root.querySelector<HTMLElement>("#dashboard-error");

  if (
    !encounteredCount ||
    !practicingCount ||
    !learnedCount ||
    !dueCount ||
    !graduatedCount ||
    !list ||
    !graduatedList ||
    !exportButton ||
    !exportStatus ||
    !graduatedStatus ||
    !empty ||
    !graduatedEmpty ||
    !status ||
    !error
  ) {
    throw new Error("LinguaPop dashboard controls are missing.");
  }

  const tooltip = initializeTranslationTooltip(root, pair, {}, { storage });
  let exportRows: AnkiExportRow[] = [];
  const onExport = (): void => {
    if (exportRows.length === 0) return;

    try {
      const view = root.defaultView;
      if (!view || typeof view.URL.createObjectURL !== "function") {
        throw new Error("Local file downloads are not available.");
      }

      const file = new Blob([serializeAnkiExport(exportRows)], {
        type: "text/tab-separated-values;charset=utf-8",
      });
      const fileUrl = view.URL.createObjectURL(file);
      const link = root.createElement("a");
      link.href = fileUrl;
      link.download = "linguapop-vocabulary.tsv";
      link.hidden = true;
      root.body.append(link);
      link.click();
      link.remove();
      view.setTimeout(() => view.URL.revokeObjectURL(fileUrl), 1_000);
      exportStatus.textContent = `Exported ${exportRows.length} vocabulary items to ${link.download}.`;
    } catch {
      exportStatus.textContent = "Your vocabulary could not be exported. Try again.";
    }
  };

  const renderWordButton = (entryId: string, sourceText: string): HTMLButtonElement => {
    const wordButton = root.createElement("button");
    wordButton.type = "button";
    wordButton.className = "word-link";
    wordButton.textContent = sourceText;
    wordButton.setAttribute("aria-label", `Open translation for ${sourceText}`);
    wordButton.setAttribute("data-linguapop-replacement", "true");
    wordButton.setAttribute("data-linguapop-entry-id", entryId);
    wordButton.setAttribute("data-linguapop-original", sourceText);
    return wordButton;
  };

  const renderDashboard = async (): Promise<void> => {
    status.textContent = "Loading vocabulary progress…";
    error.hidden = true;

    try {
      const snapshot = await getVocabularyDashboardSnapshot(storage, now(), pair);
      exportRows = snapshot.words.map(({ entry, status: learningStatus }) => ({
        spanish: entry.targetText,
        english: entry.sourceText,
        partOfSpeech: entry.partOfSpeech ?? "",
        exampleSpanish: entry.exampleTargetText ?? "",
        exampleEnglish: entry.exampleSourceText ?? "",
        difficulty: entry.difficulty,
        learningStatus,
      }));
      exportButton.disabled = exportRows.length === 0;
      encounteredCount.textContent = String(snapshot.encounteredCount);
      practicingCount.textContent = String(snapshot.practicingCount);
      learnedCount.textContent = String(snapshot.learnedCount);
      dueCount.textContent = String(snapshot.dueCount);
      graduatedCount.textContent = String(snapshot.graduatedCount);
      list.replaceChildren();
      graduatedList.replaceChildren();

      const wordsInProgress = snapshot.words.filter((word) => !word.graduated);
      if (wordsInProgress.length === 0) {
        empty.hidden = false;
        list.hidden = true;
        status.textContent = "";
      } else {
        empty.hidden = true;
        list.hidden = false;
        for (const word of wordsInProgress) {
          const item = root.createElement("li");
          item.className = "vocabulary-row";
          const main = root.createElement("div");
          main.className = "vocabulary-word-main";
          const wordButton = renderWordButton(word.entry.id, word.entry.sourceText);
          const metadata = root.createElement("p");
          const lastSeen = new Date(word.encounter.lastSeenAt);
          const lastSeenLabel = Number.isNaN(lastSeen.getTime())
            ? "Unknown"
            : lastSeen.toLocaleDateString();
          metadata.className = "word-metadata";
          metadata.textContent = `Encountered ${word.encounter.encounterCount} ${word.encounter.encounterCount === 1 ? "time" : "times"} · Last seen ${lastSeenLabel}`;
          main.append(wordButton, metadata);

          const labels = root.createElement("div");
          labels.className = "word-labels";
          const learningStatus = root.createElement("span");
          learningStatus.className = `word-status status-${word.status}`;
          learningStatus.textContent =
            word.status === "new" ? "Not marked" : word.status === "learned" ? "Learned" : "Practicing";
          labels.append(learningStatus);
          if (word.due) {
            const dueLabel = root.createElement("span");
            dueLabel.className = "word-status status-due";
            dueLabel.textContent = "Due";
            labels.append(dueLabel);
          }

          item.append(main, labels);
          list.append(item);
        }
        status.textContent = "Select a word to open its translation details.";
      }

      graduatedEmpty.hidden = snapshot.graduatedWords.length > 0;
      graduatedList.hidden = snapshot.graduatedWords.length === 0;
      for (const word of snapshot.graduatedWords) {
        const item = root.createElement("li");
        item.className = "vocabulary-row graduated-row";
        const main = root.createElement("div");
        main.className = "vocabulary-word-main";
        main.append(renderWordButton(word.entry.id, word.entry.sourceText));
        const translation = root.createElement("span");
        translation.className = "graduated-translation";
        translation.textContent = word.entry.targetText;
        main.append(translation);

        const restoreButton = root.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "ungraduate-button";
        restoreButton.textContent = "Return to practice";
        restoreButton.setAttribute("data-ungraduate-entry", word.entry.id);
        item.append(main, restoreButton);
        graduatedList.append(item);
      }
    } catch {
      encounteredCount.textContent = "—";
      practicingCount.textContent = "—";
      learnedCount.textContent = "—";
      dueCount.textContent = "—";
      graduatedCount.textContent = "—";
      list.replaceChildren();
      graduatedList.replaceChildren();
      list.hidden = true;
      graduatedList.hidden = true;
      empty.hidden = true;
      graduatedEmpty.hidden = true;
      status.textContent = "Vocabulary progress could not be loaded.";
      error.textContent = "Check extension storage and try again.";
      error.hidden = false;
    }
  };

  const onUngraduate = async (event: Event): Promise<void> => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>("[data-ungraduate-entry]");
    const entryId = button?.getAttribute("data-ungraduate-entry");
    if (!button || !entryId) return;

    button.disabled = true;
    graduatedStatus.textContent = "Returning the word to practice…";
    try {
      const restored = await returnGraduatedWordToPractice(entryId, storage);
      if (!restored) {
        graduatedStatus.textContent = "This word is no longer graduated.";
        return;
      }
      await renderDashboard();
      graduatedStatus.textContent = "The word is back in practice and due for review.";
    } catch {
      button.disabled = false;
      graduatedStatus.textContent = "The word could not be returned to practice. Try again.";
    }
  };

  exportButton.addEventListener("click", onExport);
  graduatedList.addEventListener("click", onUngraduate);
  await renderDashboard();

  return {
    dispose() {
      exportButton.removeEventListener("click", onExport);
      graduatedList.removeEventListener("click", onUngraduate);
      tooltip.dispose();
    },
  };
}

if (typeof chrome !== "undefined" && chrome.storage) {
  void initializeVocabularyDashboard(document, chrome.storage.local);
  void initializeFlashcards(document, chrome.storage.local);
}
