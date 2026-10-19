import { dictionaryEntries } from "../data/dictionary.ts";
import { initializeTranslationTooltip } from "../content/tooltip.ts";
import { getVocabularyDashboardSnapshot } from "./dashboard.ts";
import type { ReviewStorage } from "./reviews.ts";

export interface VocabularyDashboardController {
  dispose(): void;
}

export async function initializeVocabularyDashboard(
  root: Document = document,
  storage: ReviewStorage = chrome.storage.local,
  now: () => number = Date.now,
): Promise<VocabularyDashboardController> {
  const summary = {
    encountered: root.querySelector<HTMLElement>("#count-encountered"),
    practicing: root.querySelector<HTMLElement>("#count-practicing"),
    learned: root.querySelector<HTMLElement>("#count-learned"),
    due: root.querySelector<HTMLElement>("#count-due"),
  };
  const list = root.querySelector<HTMLUListElement>("#vocabulary-list");
  const empty = root.querySelector<HTMLElement>("#dashboard-empty");
  const status = root.querySelector<HTMLElement>("#dashboard-status");
  const error = root.querySelector<HTMLElement>("#dashboard-error");

  if (
    !summary.encountered ||
    !summary.practicing ||
    !summary.learned ||
    !summary.due ||
    !list ||
    !empty ||
    !status ||
    !error
  ) {
    throw new Error("LinguaPop dashboard controls are missing.");
  }

  const tooltip = initializeTranslationTooltip(root, dictionaryEntries, {}, { storage });
  status.textContent = "Loading vocabulary progress…";
  error.hidden = true;

  try {
    const snapshot = await getVocabularyDashboardSnapshot(storage, now());
    summary.encountered.textContent = String(snapshot.encounteredCount);
    summary.practicing.textContent = String(snapshot.practicingCount);
    summary.learned.textContent = String(snapshot.learnedCount);
    summary.due.textContent = String(snapshot.dueCount);
    list.replaceChildren();

    if (snapshot.words.length === 0) {
      empty.hidden = false;
      list.hidden = true;
      status.textContent = "";
    } else {
      empty.hidden = true;
      list.hidden = false;
      for (const word of snapshot.words) {
        const item = root.createElement("li");
        item.className = "vocabulary-row";
        const main = root.createElement("div");
        main.className = "vocabulary-word-main";
        const wordButton = root.createElement("button");
        wordButton.type = "button";
        wordButton.className = "word-link";
        wordButton.textContent = word.entry.english;
        wordButton.setAttribute("aria-label", `Open translation for ${word.entry.english}`);
        wordButton.setAttribute("data-linguapop-replacement", "true");
        wordButton.setAttribute("data-linguapop-entry-id", word.entry.id);
        wordButton.setAttribute("data-linguapop-original", word.entry.english);
        const metadata = root.createElement("p");
        const lastSeen = new Date(word.encounter.lastSeenAt);
        const lastSeenLabel = Number.isNaN(lastSeen.getTime()) ? "Unknown" : lastSeen.toLocaleDateString();
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
  } catch {
    summary.encountered.textContent = "—";
    summary.practicing.textContent = "—";
    summary.learned.textContent = "—";
    summary.due.textContent = "—";
    list.replaceChildren();
    list.hidden = true;
    empty.hidden = true;
    status.textContent = "Vocabulary progress could not be loaded.";
    error.textContent = "Check extension storage and try again.";
    error.hidden = false;
  }

  return {
    dispose() {
      tooltip.dispose();
    },
  };
}

if (typeof chrome !== "undefined" && chrome.storage) {
  void initializeVocabularyDashboard(document, chrome.storage.local);
}
