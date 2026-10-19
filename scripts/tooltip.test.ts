import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { phraseEntries } from "../src/data/phrases.ts";
import { createEnglishToSpanishPair, englishToSpanishPair } from "../src/data/language-pairs.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";
import { initializeTranslationTooltip } from "../src/content/tooltip.ts";

function createPage() {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 20 }, () => "Apple").join(", ")}</p><p>Nothing to translate here.</p>`;
  applyWordReplacements(window.document.body, { percentage: 100 });
  return window;
}

function click(window: Window, target: Element) {
  target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
}

class FakeStorage {
  values: Record<string, unknown> = {};

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    Object.assign(this.values, values);
  }
}

test("clicking a replacement opens a translation inside an isolated shadow root", () => {
  const window = createPage();
  const entries = dictionaryEntries.map((entry) =>
    entry.id === "en-apple" ? { ...entry, pronunciation: "mahn-SAH-nah" } : entry,
  );
  const controller = initializeTranslationTooltip(window.document, createEnglishToSpanishPair(entries));
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);

  const host = window.document.querySelector<HTMLElement>("[data-linguapop-tooltip]");
  assert.ok(host);
  assert.ok(host.shadowRoot);
  assert.equal(host.getAttribute("data-linguapop-ui"), "true");
  const entry = entries.find((candidate) => candidate.id === replacement.dataset.linguapopEntryId)!;
  assert.match(host.shadowRoot.textContent ?? "", new RegExp(replacement.dataset.linguapopOriginal!, "i"));
  assert.match(host.shadowRoot.textContent ?? "", new RegExp(entry.spanish, "i"));
  assert.match(host.shadowRoot.textContent ?? "", /mahn-SAH-nah/);
  assert.ok(host.shadowRoot.querySelector("style"));
  assert.equal(replacement.getAttribute("role"), "button");
  assert.equal(replacement.getAttribute("tabindex"), "0");
  controller.dispose();
  window.close();
});

test("phrase replacements open the shared translation tooltip without autoplaying speech", () => {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "Thank you.").join(" ")}</p>`;
  const phrase = phraseEntries.find((entry) => entry.english === "thank you")!;
  const pair = createEnglishToSpanishPair([], [phrase]);
  applyWordReplacements(window.document.body, { percentage: 30, pair });
  let spoken = 0;
  const speech = {
    cancel() {},
    getVoices: () => [],
    speak() { spoken += 1; },
  } as unknown as SpeechSynthesis;
  const controller = initializeTranslationTooltip(window.document, pair, { speechSynthesis: speech });
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector("h2")?.textContent, "gracias");
  assert.match(shadow.textContent ?? "", /Thank you/);
  assert.equal(spoken, 0);

  controller.dispose();
  window.close();
});

test("tooltip displays available static example and grammar details", () => {
  const window = createPage();
  const entries = dictionaryEntries.map((entry) =>
    entry.id === "en-apple"
      ? {
          ...entry,
          exampleSpanish: "Como una manzana.",
          exampleEnglish: "I eat an apple.",
          grammarNote: "Manzana is feminine; use una.",
        }
      : entry,
  );
  const controller = initializeTranslationTooltip(window.document, createEnglishToSpanishPair(entries));
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector('[data-tooltip-example="target"]')?.textContent, "Como una manzana.");
  assert.equal(shadow.querySelector('[data-tooltip-example="source"]')?.textContent, "I eat an apple.");
  assert.match(shadow.querySelector('[data-tooltip-example="grammar"]')?.textContent ?? "", /feminine/i);
  controller.dispose();
  window.close();
});

test("tooltip omits example details when an entry has none", () => {
  const window = createPage();
  const entries = dictionaryEntries.map((entry) =>
    entry.id === "en-apple"
      ? { ...entry, exampleSpanish: undefined, exampleEnglish: undefined, grammarNote: undefined }
      : entry,
  );
  const controller = initializeTranslationTooltip(window.document, createEnglishToSpanishPair(entries));
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector('[data-tooltip-example="target"]'), null);
  assert.equal(shadow.querySelector('[data-tooltip-example="source"]'), null);
  assert.equal(shadow.querySelector('[data-tooltip-example="grammar"]'), null);
  controller.dispose();
  window.close();
});

test("tooltip displays a grammar note even when an example is not supplied", () => {
  const window = createPage();
  const entries = dictionaryEntries.map((entry) =>
    entry.id === "en-apple"
      ? {
          ...entry,
          exampleSpanish: undefined,
          exampleEnglish: undefined,
          grammarNote: "Manzana is feminine.",
        }
      : entry,
  );
  const controller = initializeTranslationTooltip(window.document, createEnglishToSpanishPair(entries));
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector('[data-tooltip-example="target"]'), null);
  assert.match(shadow.querySelector('[data-tooltip-example="grammar"]')?.textContent ?? "", /feminine/i);
  controller.dispose();
  window.close();
});

test("Escape dismisses the tooltip and restores focus", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  assert.ok(window.document.querySelector("[data-linguapop-tooltip]"));
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);
  assert.equal(window.document.activeElement, replacement);
  controller.dispose();
  window.close();
});

test("close button dismisses the tooltip and restores focus", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const closeButton = [...(window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot?.querySelectorAll("button") ?? [])]
    .find((button) => button.textContent === "Close translation");
  assert.ok(closeButton);
  closeButton.click();
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);
  assert.equal(window.document.activeElement, replacement);
  controller.dispose();
  window.close();
});

test("outside clicks dismiss the tooltip", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;
  const outside = window.document.querySelector("p:last-child")!;

  click(window, replacement);
  click(window, outside);
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);
  controller.dispose();
  window.close();
});

test("replacement words open the tooltip with Enter and Space", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  for (const key of ["Enter", " "]) {
    replacement.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    assert.ok(window.document.querySelector("[data-linguapop-tooltip]"));
    window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  controller.dispose();
  window.close();
});

test("tooltip loads and persists learned or practicing status by dictionary ID", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const controller = initializeTranslationTooltip(window.document, englishToSpanishPair, {}, {
    storage: storage as never,
  });
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const root = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  const learned = root.querySelector<HTMLButtonElement>('[data-learning-status="learned"]')!;
  const practicing = root.querySelector<HTMLButtonElement>('[data-learning-status="practicing"]')!;
  assert.equal(learned.getAttribute("aria-pressed"), "false");
  practicing.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(practicing.getAttribute("aria-pressed"), "true");
  assert.equal((storage.values.learningStatuses as Record<string, string>)["en-apple"], "practicing");

  [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent === "Close translation")!
    .click();
  click(window, replacement);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const reopened = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(reopened.querySelector('[data-learning-status="practicing"]')?.getAttribute("aria-pressed"), "true");
  const learnedAfterReopen = reopened.querySelector<HTMLButtonElement>('[data-learning-status="learned"]')!;
  assert.equal(learnedAfterReopen.disabled, false);
  learnedAfterReopen.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(reopened.querySelector('[data-learning-status-message="true"]')?.textContent ?? "", /marked as learned/i);
  assert.equal((storage.values.learningStatuses as Record<string, string>)["en-apple"], "learned");

  controller.dispose();
  window.close();
});

test("tooltip reports status storage errors without marking the word", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.set = async () => {
    throw new Error("storage unavailable");
  };
  const controller = initializeTranslationTooltip(window.document, englishToSpanishPair, {}, {
    storage: storage as never,
  });
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);
  const root = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  root.querySelector<HTMLButtonElement>('[data-learning-status="learned"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(root.querySelector('[data-learning-status="learned"]')?.getAttribute("aria-pressed"), "false");
  assert.match(root.querySelector('[data-learning-status-message="true"]')?.textContent ?? "", /could not save/i);

  controller.dispose();
  window.close();
});
