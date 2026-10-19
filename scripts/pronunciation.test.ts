import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";
import { initializeTranslationTooltip } from "../src/content/tooltip.ts";

class FakeSpeechSynthesis {
  voices: SpeechSynthesisVoice[] = [];
  utterances: SpeechSynthesisUtterance[] = [];
  cancelCalls = 0;

  getVoices() {
    return this.voices;
  }

  speak(utterance: SpeechSynthesisUtterance) {
    this.utterances.push(utterance);
  }

  cancel() {
    this.cancelCalls += 1;
  }
}

function createPage() {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 20 }, () => "Apple water").join(" ")}</p>`;
  applyWordReplacements(window.document.body, { percentage: 100 });
  return window;
}

function click(window: Window, target: Element) {
  target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
}

function createUtterance(text: string) {
  return { text, lang: "", voice: null, onerror: null } as SpeechSynthesisUtterance;
}

function spanishVoice(lang: string, name = "Spanish voice") {
  return { lang, name } as SpeechSynthesisVoice;
}

function getTooltip(document: Document) {
  return document.querySelector("[data-linguapop-tooltip]")?.shadowRoot;
}

test("speaks the Spanish word only after the user presses Speak Spanish", () => {
  const window = createPage();
  const synthesis = new FakeSpeechSynthesis();
  synthesis.voices = [spanishVoice("es-ES"), spanishVoice("en-US", "English")];
  const controller = initializeTranslationTooltip(window.document, dictionaryEntries, {
    speechSynthesis: synthesis,
    createUtterance,
  });
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-apple']")!;

  click(window, replacement);
  assert.equal(synthesis.utterances.length, 0, "opening the tooltip must not autoplay speech");
  const speakButton = getTooltip(window.document)?.querySelector("button.speak");
  assert.ok(speakButton);
  speakButton.click();

  assert.equal(synthesis.utterances.length, 1);
  assert.equal(synthesis.utterances[0]?.text, "manzana");
  assert.equal(synthesis.utterances[0]?.lang, "es-ES");
  assert.equal(synthesis.utterances[0]?.voice?.lang, "es-ES");
  controller.dispose();
  window.close();
});

test("uses a Spanish voice when an es-ES voice is not installed", () => {
  const window = createPage();
  const synthesis = new FakeSpeechSynthesis();
  synthesis.voices = [spanishVoice("en-US", "English"), spanishVoice("es-MX", "Mexican Spanish")];
  const controller = initializeTranslationTooltip(window.document, dictionaryEntries, {
    speechSynthesis: synthesis,
    createUtterance,
  });

  click(window, window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-apple']")!);
  getTooltip(window.document)?.querySelector("button.speak")?.click();
  assert.equal(synthesis.utterances[0]?.voice?.lang, "es-MX");
  assert.equal(synthesis.utterances[0]?.lang, "es-ES");

  controller.dispose();
  window.close();
});

test("shows a helpful state when speech or a Spanish voice is unavailable", () => {
  const unsupported = createPage();
  const unsupportedController = initializeTranslationTooltip(unsupported.document, dictionaryEntries, {
    speechSynthesis: null,
    createUtterance,
  });
  click(unsupported, unsupported.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-apple']")!);
  const disabledButton = getTooltip(unsupported.document)?.querySelector<HTMLButtonElement>("button.speak");
  assert.ok(disabledButton?.disabled);
  assert.match(getTooltip(unsupported.document)?.textContent ?? "", /not available/i);
  unsupportedController.dispose();
  unsupported.close();

  const noVoice = createPage();
  const synthesis = new FakeSpeechSynthesis();
  synthesis.voices = [spanishVoice("en-US", "English")];
  const noVoiceController = initializeTranslationTooltip(noVoice.document, dictionaryEntries, {
    speechSynthesis: synthesis,
    createUtterance,
  });
  click(noVoice, noVoice.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-apple']")!);
  getTooltip(noVoice.document)?.querySelector("button.speak")?.click();
  assert.match(getTooltip(noVoice.document)?.textContent ?? "", /no Spanish voice/i);
  assert.equal(synthesis.utterances.length, 0);
  noVoiceController.dispose();
  noVoice.close();
});

test("stops current speech when the user opens another replaced word", () => {
  const window = createPage();
  const synthesis = new FakeSpeechSynthesis();
  synthesis.voices = [spanishVoice("es-ES")];
  const controller = initializeTranslationTooltip(window.document, dictionaryEntries, {
    speechSynthesis: synthesis,
    createUtterance,
  });
  const apple = window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-apple']")!;
  const water = window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-water']")!;

  click(window, apple);
  getTooltip(window.document)?.querySelector("button.speak")?.click();
  click(window, water);

  assert.equal(synthesis.utterances.length, 1);
  assert.ok(synthesis.cancelCalls > 0);
  assert.match(getTooltip(window.document)?.textContent ?? "", /water/i);
  controller.dispose();
  window.close();
});
