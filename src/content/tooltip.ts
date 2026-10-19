import { englishToSpanishPair, type LanguagePair } from "../data/language-pairs.ts";
import {
  getLearningStatuses,
  setLearningStatus,
  type LearningStatus,
  type LearningStatusStorage,
} from "../learning/statuses.ts";

const replacementSelector = '[data-linguapop-replacement="true"]';

export interface TranslationTooltipController {
  dispose(): void;
}

export interface TooltipSpeechOptions {
  speechSynthesis?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

export interface TooltipLearningOptions {
  storage?: LearningStatusStorage;
}

function getReplacement(target: EventTarget | null): HTMLElement | undefined {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return undefined;
  const element = target as Element;
  if (element.nodeType !== 1 || typeof element.closest !== "function") return undefined;
  return element.closest<HTMLElement>(replacementSelector) ?? undefined;
}

export function initializeTranslationTooltip(
  document: Document = window.document,
  pair: LanguagePair = englishToSpanishPair,
  speechOptions: TooltipSpeechOptions = {},
  learningOptions: TooltipLearningOptions = {},
): TranslationTooltipController {
  const speechSynthesis =
    speechOptions.speechSynthesis === undefined
      ? document.defaultView?.speechSynthesis
      : speechOptions.speechSynthesis ?? undefined;
  const createUtterance =
    speechOptions.createUtterance ?? ((text: string) => new SpeechSynthesisUtterance(text));
  let host: HTMLDivElement | undefined;
  let currentTrigger: HTMLElement | undefined;
  const learningStorage =
    learningOptions.storage ??
    (typeof chrome === "undefined" ? undefined : chrome.storage.local);

  const close = (restoreFocus = false): void => {
    if (host) {
      try {
        speechSynthesis?.cancel();
      } catch {
        // Speech synthesis may fail in a restricted browser context.
      }
    }
    const trigger = currentTrigger;
    host?.remove();
    host = undefined;
    currentTrigger = undefined;
    if (restoreFocus) trigger?.focus();
  };

  const open = (trigger: HTMLElement): void => {
    const entryId = trigger.getAttribute("data-linguapop-entry-id");
    const entry = pair.entries.find((candidate) => candidate.id === entryId);
    const original = trigger.getAttribute("data-linguapop-original");
    if (!entry || original === null) return;

    close();
    const tooltipHost = document.createElement("div");
    tooltipHost.setAttribute("data-linguapop-ui", "true");
    tooltipHost.setAttribute("data-linguapop-tooltip", "true");
    const shadow = tooltipHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const bounds = trigger.getBoundingClientRect();
    const view = document.defaultView;
    const left = Math.max(8, Math.min(bounds.left, (view?.innerWidth ?? 320) - 288));
    const top = Math.max(8, Math.min(bounds.bottom + 8, (view?.innerHeight ?? 240) - 140));
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        top: ${top}px;
        left: ${left}px;
        color: #17211b;
        font: 14px/1.4 system-ui, sans-serif;
      }
      .card {
        box-sizing: border-box;
        width: min(280px, calc(100vw - 16px));
        padding: 14px;
        border: 1px solid #c8d8cc;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 4px 18px #17211b33;
      }
      h2 { margin: 0 0 8px; color: #176b52; font-size: 16px; }
      p { margin: 6px 0; }
      .label { color: #536159; font-size: 12px; }
      .example { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e3ebe5; }
      .example p { overflow-wrap: anywhere; }
      button {
        margin-top: 10px;
        padding: 5px 9px;
        border: 1px solid #176b52;
        border-radius: 5px;
        background: #f8fbf8;
        color: #176b52;
        font: inherit;
        cursor: pointer;
      }
      button:focus-visible { outline: 3px solid #7eb69f; outline-offset: 2px; }
      .learning-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .learning-actions button { margin-top: 4px; }
      .learning-actions button[aria-pressed="true"] { background: #176b52; color: #fff; }
    `;
    const card = document.createElement("section");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `${pair.targetLanguage.name} translation for ${entry.targetText}`);

    const heading = document.createElement("h2");
    heading.lang = pair.targetLanguage.locale;
    heading.textContent = entry.targetText;
    const translation = document.createElement("p");
    const translationLabel = document.createElement("span");
    translationLabel.className = "label";
    translationLabel.textContent = `${pair.sourceLanguage.name} translation`;
    const translatedWord = document.createElement("span");
    translatedWord.textContent = original;
    translation.append(translationLabel, document.createElement("br"), translatedWord);
    card.append(heading, translation);

    if (entry.pronunciation) {
      const pronunciation = document.createElement("p");
      pronunciation.textContent = `Pronunciation: ${entry.pronunciation}`;
      card.append(pronunciation);
    }

    if ((entry.exampleTargetText && entry.exampleSourceText) || entry.grammarNote) {
      const example = document.createElement("section");
      example.className = "example";
      if (entry.exampleTargetText && entry.exampleSourceText) {
        const exampleHeading = document.createElement("p");
        exampleHeading.className = "label";
        exampleHeading.textContent = "Example";
        const exampleTarget = document.createElement("p");
        exampleTarget.lang = pair.targetLanguage.locale;
        exampleTarget.dataset.tooltipExample = "target";
        exampleTarget.textContent = entry.exampleTargetText;
        const exampleSource = document.createElement("p");
        exampleSource.dataset.tooltipExample = "source";
        exampleSource.textContent = entry.exampleSourceText;
        example.append(exampleHeading, exampleTarget, exampleSource);
      }

      if (entry.grammarNote) {
        const grammarNote = document.createElement("p");
        const grammarHeading = document.createElement("span");
        grammarHeading.className = "label";
        grammarHeading.textContent = "Grammar: ";
        grammarNote.dataset.tooltipExample = "grammar";
        grammarNote.append(grammarHeading, document.createTextNode(entry.grammarNote));
        example.append(grammarNote);
      }
      card.append(example);
    }

    const speechButton = document.createElement("button");
    speechButton.className = "speak";
    speechButton.type = "button";
    speechButton.textContent = `Speak ${pair.targetLanguage.name}`;
    const speechStatus = document.createElement("p");
    speechStatus.setAttribute("role", "status");
    speechStatus.setAttribute("aria-live", "polite");
    if (!speechSynthesis) {
      speechButton.disabled = true;
      speechStatus.textContent = "Speech synthesis is not available in this browser.";
    } else {
      speechButton.addEventListener("click", () => {
        try {
          const voices = speechSynthesis.getVoices();
          const targetLocale = pair.targetLanguage.speechLocale ?? pair.targetLanguage.locale;
          const voice =
            voices.find((candidate) => candidate.lang.toLowerCase() === targetLocale.toLowerCase()) ??
            voices.find((candidate) =>
              candidate.lang.toLowerCase().startsWith(`${pair.targetLanguage.locale.toLowerCase()}-`),
            );
          if (!voice) {
            speechStatus.textContent = `No ${pair.targetLanguage.name} voice is available in this browser.`;
            return;
          }

          speechSynthesis.cancel();
          const utterance = createUtterance(entry.targetText);
          utterance.lang = targetLocale;
          utterance.voice = voice;
          utterance.onerror = () => {
            speechStatus.textContent = `Could not play the ${pair.targetLanguage.name} pronunciation. Try again.`;
          };
          speechStatus.textContent = `Speaking ${entry.targetText}.`;
          speechSynthesis.speak(utterance);
        } catch {
          speechStatus.textContent = `Could not play the ${pair.targetLanguage.name} pronunciation. Try again.`;
        }
      });
    }
    card.append(speechButton, speechStatus);

    const learningHeading = document.createElement("p");
    learningHeading.className = "label";
    learningHeading.textContent = "Your learning status";
    const learningActions = document.createElement("div");
    learningActions.className = "learning-actions";
    const statusButtons = new Map<LearningStatus, HTMLButtonElement>();
    for (const [status, label] of [
      ["learned", "Learned"],
      ["practicing", "Practicing"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.learningStatus = status;
      button.setAttribute("aria-pressed", "false");
      button.disabled = !learningStorage;
      statusButtons.set(status, button);
      learningActions.append(button);
    }
    const learningStatusMessage = document.createElement("p");
    learningStatusMessage.setAttribute("role", "status");
    learningStatusMessage.setAttribute("aria-live", "polite");
    learningStatusMessage.dataset.learningStatusMessage = "true";
    if (!learningStorage) {
      learningStatusMessage.textContent = "Learning status is not available in this context.";
    }

    const updateStatusButtons = (status: LearningStatus | undefined): void => {
      for (const [buttonStatus, button] of statusButtons) {
        button.setAttribute("aria-pressed", String(buttonStatus === status));
      }
    };

    for (const [status, button] of statusButtons) {
      button.addEventListener("click", async () => {
        if (!learningStorage) return;
        for (const candidate of statusButtons.values()) candidate.disabled = true;
        learningStatusMessage.textContent = "Saving learning status…";
        try {
          await setLearningStatus(entry.id, status, learningStorage);
          updateStatusButtons(status);
          learningStatusMessage.textContent = `Marked as ${status}.`;
        } catch {
          learningStatusMessage.textContent = "Could not save learning status. Try again.";
        } finally {
          for (const candidate of statusButtons.values()) candidate.disabled = false;
        }
      });
    }
    card.append(learningHeading, learningActions, learningStatusMessage);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Close translation";
    closeButton.addEventListener("click", () => close(true));
    card.append(closeButton);
    shadow.append(style, card);

    document.body.append(tooltipHost);
    host = tooltipHost;
    currentTrigger = trigger;
    closeButton.focus();

    if (learningStorage) {
      void getLearningStatuses(learningStorage)
        .then((statuses) => {
          if (host !== tooltipHost) return;
          const status = statuses[entry.id];
          updateStatusButtons(status);
          learningStatusMessage.textContent = status ? `Currently ${status}.` : "Not marked yet.";
        })
        .catch(() => {
          if (host === tooltipHost) {
            learningStatusMessage.textContent = "Could not load learning status.";
          }
        });
    }
  };

  const onClick = (event: MouseEvent): void => {
    const replacement = getReplacement(event.target);
    if (replacement) {
      if (replacement !== currentTrigger) open(replacement);
      return;
    }

    if (
      host &&
      !host.contains(event.target as Node) &&
      !host.shadowRoot?.contains(event.target as Node)
    ) {
      close();
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && host) {
      event.preventDefault();
      close(true);
      return;
    }

    const replacement = getReplacement(event.target);
    if (replacement && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      open(replacement);
    }
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      close();
    },
  };
}
