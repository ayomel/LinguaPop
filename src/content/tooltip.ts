import { dictionaryEntries, type DictionaryEntry } from "../data/dictionary.ts";

const replacementSelector = '[data-linguapop-replacement="true"]';

export interface TranslationTooltipController {
  dispose(): void;
}

export interface TooltipSpeechOptions {
  speechSynthesis?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

function getReplacement(target: EventTarget | null): HTMLElement | undefined {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return undefined;
  const element = target as Element;
  if (element.nodeType !== 1 || typeof element.closest !== "function") return undefined;
  return element.closest<HTMLElement>(replacementSelector) ?? undefined;
}

export function initializeTranslationTooltip(
  document: Document = window.document,
  entries: readonly DictionaryEntry[] = dictionaryEntries,
  speechOptions: TooltipSpeechOptions = {},
): TranslationTooltipController {
  const speechSynthesis =
    speechOptions.speechSynthesis === undefined
      ? document.defaultView?.speechSynthesis
      : speechOptions.speechSynthesis ?? undefined;
  const createUtterance =
    speechOptions.createUtterance ?? ((text: string) => new SpeechSynthesisUtterance(text));
  let host: HTMLDivElement | undefined;
  let currentTrigger: HTMLElement | undefined;

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
    const entry = entries.find((candidate) => candidate.id === entryId);
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
    `;
    const card = document.createElement("section");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `Translation for ${entry.spanish}`);

    const heading = document.createElement("h2");
    heading.lang = "es";
    heading.textContent = entry.spanish;
    const translation = document.createElement("p");
    const translationLabel = document.createElement("span");
    translationLabel.className = "label";
    translationLabel.textContent = "English translation";
    const translatedWord = document.createElement("span");
    translatedWord.textContent = original;
    translation.append(translationLabel, document.createElement("br"), translatedWord);
    card.append(heading, translation);

    if (entry.pronunciation) {
      const pronunciation = document.createElement("p");
      pronunciation.textContent = `Pronunciation: ${entry.pronunciation}`;
      card.append(pronunciation);
    }

    const speechButton = document.createElement("button");
    speechButton.className = "speak";
    speechButton.type = "button";
    speechButton.textContent = "Speak Spanish";
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
          const voice =
            voices.find((candidate) => candidate.lang.toLowerCase() === "es-es") ??
            voices.find((candidate) => /^es[-_]/i.test(candidate.lang));
          if (!voice) {
            speechStatus.textContent = "No Spanish voice is available in this browser.";
            return;
          }

          speechSynthesis.cancel();
          const utterance = createUtterance(entry.spanish);
          utterance.lang = "es-ES";
          utterance.voice = voice;
          utterance.onerror = () => {
            speechStatus.textContent = "Could not play the Spanish pronunciation. Try again.";
          };
          speechStatus.textContent = `Speaking ${entry.spanish}.`;
          speechSynthesis.speak(utterance);
        } catch {
          speechStatus.textContent = "Could not play the Spanish pronunciation. Try again.";
        }
      });
    }
    card.append(speechButton, speechStatus);

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
