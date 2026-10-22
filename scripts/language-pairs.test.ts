import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { phraseEntries } from "../src/data/phrases.ts";
import {
  createEnglishToSpanishPair,
  englishToFrenchPair,
  getLanguagePair,
  type LanguagePair,
} from "../src/data/language-pairs.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";
import { initializeTranslationTooltip } from "../src/content/tooltip.ts";
import { getVocabularyDashboardSnapshot } from "../src/learning/dashboard.ts";
import { getNextDueReview, type ReviewStorage } from "../src/learning/reviews.ts";

class FakeStorage {
  values: Record<string, unknown> = {};

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    Object.assign(this.values, values);
  }
}

test("the shipped English to Spanish pair maps existing word and phrase data to generic fields", () => {
  const pair = createEnglishToSpanishPair();
  const apple = pair.entries.find((entry) => entry.id === "en-apple");
  const phrase = pair.entries.find((entry) => entry.id === "phrase-thank-you");

  assert.deepEqual(pair.sourceLanguage, { name: "English", locale: "en" });
  assert.deepEqual(pair.targetLanguage, {
    name: "Spanish",
    locale: "es",
    speechLocale: "es-ES",
  });
  assert.equal(pair.entries.length, dictionaryEntries.length + phraseEntries.length);
  assert.deepEqual(apple && [apple.kind, apple.sourceText, apple.targetText], ["word", "apple", "manzana"]);
  assert.deepEqual(phrase && [phrase.kind, phrase.sourceText, phrase.targetText], ["phrase", "thank you", "gracias"]);
  assert.equal(apple?.exampleSourceText, dictionaryEntries.find((entry) => entry.id === apple?.id)?.exampleEnglish);
});

test("the shipped English to French pair maps its curated words and phrases to generic fields", () => {
  const apple = englishToFrenchPair.entries.find((entry) => entry.id === "en-fr-apple");
  const phrase = englishToFrenchPair.entries.find((entry) => entry.id === "phrase-fr-thank-you");

  assert.equal(getLanguagePair("en-fr"), englishToFrenchPair);
  assert.deepEqual(englishToFrenchPair.sourceLanguage, { name: "English", locale: "en" });
  assert.deepEqual(englishToFrenchPair.targetLanguage, {
    name: "French",
    locale: "fr",
    speechLocale: "fr-FR",
  });
  assert.deepEqual(apple && [apple.kind, apple.sourceText, apple.targetText], ["word", "apple", "pomme"]);
  assert.deepEqual(phrase && [phrase.kind, phrase.sourceText, phrase.targetText], ["phrase", "thank you", "merci"]);
  assert.ok(englishToFrenchPair.entries.length >= 180);
});

test("the English-to-French pair drives replacement tooltip labels and French speech", () => {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "apple").join(" ")}</p>`;
  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair: englishToFrenchPair }), 3);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='en-fr-apple']")!;
  const utterances: Array<{ text: string; lang: string }> = [];
  const controller = initializeTranslationTooltip(window.document, englishToFrenchPair, {
    speechSynthesis: {
      cancel() {},
      getVoices: () => [{ lang: "fr-FR" }],
      speak(utterance: { text: string; lang: string }) { utterances.push(utterance); },
    } as unknown as SpeechSynthesis,
    createUtterance: (text) => ({ text, lang: "", voice: null, onerror: null }) as SpeechSynthesisUtterance,
  });

  replacement.click();
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector("h2")?.lang, "fr");
  assert.match(shadow.textContent ?? "", /Speak French/);
  shadow.querySelector<HTMLButtonElement>("button.speak")!.click();
  assert.equal(utterances[0]?.text, "pomme");
  assert.equal(utterances[0]?.lang, "fr-FR");

  controller.dispose();
  window.close();
});

test("replacement and pronunciation rendering use the configured pair metadata", () => {
  const pair: LanguagePair = {
    id: "fr-ja",
    sourceLanguage: { name: "French", locale: "fr" },
    targetLanguage: { name: "Japanese", locale: "ja", speechLocale: "ja-JP" },
    entries: [
      {
        id: "phrase-bonjour",
        kind: "phrase",
        sourceText: "bonjour",
        targetText: "こんにちは",
        difficulty: "beginner",
      },
    ],
  };
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "bonjour!").join(" ")}</p>`;

  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-entry-id='phrase-bonjour']")!;
  assert.equal(replacement.textContent, "こんにちは");
  assert.match(replacement.getAttribute("aria-label") ?? "", /Japanese phrase.*French translation/);

  const utterances: Array<{ text: string; lang: string }> = [];
  const synthesis = {
    cancel() {},
    getVoices: () => [{ lang: "ja-JP" }],
    speak(utterance: { text: string; lang: string }) { utterances.push(utterance); },
  } as unknown as SpeechSynthesis;
  const controller = initializeTranslationTooltip(window.document, pair, {
    speechSynthesis: synthesis,
    createUtterance: (text) => ({ text, lang: "", voice: null, onerror: null }) as SpeechSynthesisUtterance,
  });

  replacement.click();
  const shadow = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot!;
  assert.equal(shadow.querySelector("h2")?.lang, "ja");
  assert.match(shadow.textContent ?? "", /French translation/);
  assert.equal(utterances.length, 0, "opening a translation must not autoplay speech");
  shadow.querySelector<HTMLButtonElement>("button.speak")!.click();
  assert.equal(utterances[0]?.text, "こんにちは");
  assert.equal(utterances[0]?.lang, "ja-JP");

  controller.dispose();
  window.close();
});

test("review and dashboard lookups resolve entries from the selected pair", async () => {
  const pair: LanguagePair = {
    id: "fr-ja",
    sourceLanguage: { name: "French", locale: "fr" },
    targetLanguage: { name: "Japanese", locale: "ja", speechLocale: "ja-JP" },
    entries: [
      {
        id: "fr-bonjour",
        kind: "word",
        sourceText: "bonjour",
        targetText: "こんにちは",
        difficulty: "beginner",
      },
    ],
  };
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "fr-bonjour": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const reviewStorage = storage as unknown as ReviewStorage;

  const due = await getNextDueReview(reviewStorage, 1_000, pair);
  const dashboard = await getVocabularyDashboardSnapshot(reviewStorage, 1_000, pair);

  assert.equal(due?.entry.sourceText, "bonjour");
  assert.equal(due?.entry.targetText, "こんにちは");
  assert.equal(dashboard.encounteredCount, 1);
  assert.equal(dashboard.words[0]?.entry.sourceText, "bonjour");
});
