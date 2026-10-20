import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { applyWordReplacements, restoreWordReplacements } from "../src/content/replacements.ts";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { createEnglishToSpanishPair } from "../src/data/language-pairs.ts";
import { phraseEntries } from "../src/data/phrases.ts";

test("matches common phrases as single reversible replacements with stable selection", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "thank you");
  assert.ok(phrase);
  const words = [
    { id: "en-thank", english: "thank", spanish: "agradecer", partOfSpeech: "verb" as const, difficulty: "beginner" as const },
    { id: "en-you", english: "you", spanish: "tú", partOfSpeech: "noun" as const, difficulty: "beginner" as const },
  ];
  const pair = createEnglishToSpanishPair(words, [phrase]);
  const sentence = Array.from({ length: 10 }, (_, index) =>
    index % 3 === 0 ? "THANK YOU," : index % 3 === 1 ? "Thank you." : "thank you!",
  ).join(" ");
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${sentence}</p>`;
  const originalMarkup = window.document.body.innerHTML;

  assert.equal(
    applyWordReplacements(window.document.body, {
      percentage: 30,
      pair,
    }),
    3,
  );
  const replacements = Array.from(
    window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"),
  );
  assert.equal(replacements.length, 3);
  assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
  assert.ok(replacements.some((replacement) => replacement.textContent === "GRACIAS"));
  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 0);

  assert.equal(restoreWordReplacements(window.document.body), 3);
  assert.equal(window.document.body.innerHTML, originalMarkup);
  window.close();
});

test("does not match a phrase across sibling text nodes", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "thank you");
  assert.ok(phrase);
  const pair = createEnglishToSpanishPair([], [phrase]);
  const window = new Window();
  window.document.body.innerHTML = `<p>Thank <em>you</em>!</p>`;

  applyWordReplacements(window.document.body, {
    percentage: 30,
    pair,
  });

  assert.equal(
    window.document.querySelector(`[data-linguapop-entry-id='${phrase.id}']`),
    null,
  );
  assert.equal(window.document.body.textContent, "Thank you!");
  window.close();
});

test("phrase data has stable phrase IDs and supported difficulty levels", () => {
  assert.ok(phraseEntries.length >= 8);
  assert.ok(phraseEntries.every((entry) => /^phrase-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)));
  assert.equal(new Set(phraseEntries.map((entry) => entry.id)).size, phraseEntries.length);
  assert.ok(phraseEntries.every((entry) => ["beginner", "intermediate", "advanced"].includes(entry.difficulty)));
});

test("context phrases match straight and curly contractions before standalone pronouns", () => {
  const phraseTexts = ["I am happy", "I'm happy", "I’m happy"];
  const window = new Window();
  const sentence = Array.from({ length: 10 }, (_, index) => phraseTexts[index % phraseTexts.length]).join("! ");
  window.document.body.innerHTML = `<p>${sentence}</p>`;
  const originalMarkup = window.document.body.innerHTML;
  const words = [
    { id: "en-i", english: "I", spanish: "yo", partOfSpeech: "pronoun" as const, difficulty: "beginner" as const },
  ];
  const phrases = phraseEntries.filter((entry) => phraseTexts.includes(entry.english));
  const pair = createEnglishToSpanishPair(words, phrases);

  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
  const replacements = Array.from(window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"));
  assert.ok(replacements.every((replacement) => phrases.some((phrase) => phrase.id === replacement.dataset.linguapopEntryId)));
  assert.ok(replacements.every((replacement) => replacement.textContent?.toLocaleLowerCase() === "estoy feliz"));
  assert.equal(restoreWordReplacements(window.document.body), replacements.length);
  assert.equal(window.document.body.innerHTML, originalMarkup);
  window.close();
});

test("contractions match their expanded contextual phrase and preserve source casing", () => {
  for (const [english, source, expected] of [
    ["you will be happy", "you'll be happy", "estarás feliz"],
    ["you will be happy", "you’ll be happy", "estarás feliz"],
    ["you will be happy", "You will be happy", "Estarás feliz"],
    ["you will be happy", "YOU'LL BE HAPPY", "ESTARÁS FELIZ"],
    ["he will be happy", "he'll be happy", "estará feliz"],
    ["he will be happy", "he’ll be happy", "estará feliz"],
  ]) {
    const phrase = phraseEntries.find((entry) => entry.english === english);
    assert.ok(phrase);
    const pair = createEnglishToSpanishPair([], [phrase]);
    const window = new Window();
    window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => source).join("! ")}</p>`;

    assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
    const replacements = Array.from(window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"));
    assert.ok(replacements.every((replacement) => replacement.textContent === expected));
    assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
    window.close();
  }
});

test("have contractions resolve through their expanded contextual phrase", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "you have got a book");
  assert.ok(phrase);
  const pair = createEnglishToSpanishPair([], [phrase]);

  for (const source of ["you've got a book", "you’ve got a book"]) {
    const window = new Window();
    window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => source).join("! ")}</p>`;

    assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
    const replacements = Array.from(window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"));
    assert.ok(replacements.every((replacement) => replacement.textContent === "tienes un libro"));
    assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
    window.close();
  }
});

test("does not replace pronouns inside contractions without a matching phrase", () => {
  const words = [
    { id: "en-you", english: "you", spanish: "tú", partOfSpeech: "pronoun" as const, difficulty: "beginner" as const },
    { id: "en-he", english: "he", spanish: "él", partOfSpeech: "pronoun" as const, difficulty: "beginner" as const },
  ];
  const pair = createEnglishToSpanishPair(words, []);
  const window = new Window();
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "you'll he'll you've you’ll he’ll you’ve").join("! ")}</p>`;

  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 0);
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement='true']").length, 0);
  assert.match(window.document.body.textContent ?? "", /you'll he'll you've you’ll he’ll you’ve/);
  window.close();
});

test("the plural you-all phrase takes priority over standalone you", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "you all");
  assert.ok(phrase);
  const words = [
    { id: "en-you", english: "you", spanish: "tú", partOfSpeech: "pronoun" as const, difficulty: "beginner" as const },
  ];
  const pair = createEnglishToSpanishPair(words, [phrase]);
  const window = new Window();
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "you all").join("! ")}</p>`;

  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
  const replacements = Array.from(window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"));
  assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
  assert.ok(replacements.every((replacement) => replacement.textContent === "ustedes"));
  window.close();
});

test("a fixed have phrase takes priority over its individual word entries", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "I have a question");
  assert.ok(phrase);
  const pair = createEnglishToSpanishPair(dictionaryEntries, [phrase]);
  const window = new Window();
  window.document.body.innerHTML = `<p>${Array.from({ length: 10 }, () => "I have a question").join("! ")}</p>`;

  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, pair }), 3);
  const replacements = Array.from(window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"));
  assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
  assert.ok(replacements.every((replacement) => replacement.textContent === "Tengo una pregunta"));
  window.close();
});
