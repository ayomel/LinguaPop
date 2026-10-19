import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { applyWordReplacements, restoreWordReplacements } from "../src/content/replacements.ts";
import { phraseEntries } from "../src/data/phrases.ts";

test("matches common phrases as single reversible replacements with stable selection", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "thank you");
  assert.ok(phrase);
  const words = [
    { id: "en-thank", english: "thank", spanish: "agradecer", partOfSpeech: "verb" as const, difficulty: "beginner" as const },
    { id: "en-you", english: "you", spanish: "tú", partOfSpeech: "noun" as const, difficulty: "beginner" as const },
  ];
  const sentence = Array.from({ length: 10 }, (_, index) =>
    index % 3 === 0 ? "THANK YOU," : index % 3 === 1 ? "Thank you." : "thank you!",
  ).join(" ");
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${sentence}</p>`;
  const originalMarkup = window.document.body.innerHTML;

  assert.equal(
    applyWordReplacements(window.document.body, {
      percentage: 30,
      entries: words,
      phraseEntries: [phrase],
    }),
    3,
  );
  const replacements = Array.from(
    window.document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"),
  );
  assert.equal(replacements.length, 3);
  assert.ok(replacements.every((replacement) => replacement.dataset.linguapopEntryId === phrase.id));
  assert.ok(replacements.some((replacement) => replacement.textContent === "GRACIAS"));
  assert.equal(applyWordReplacements(window.document.body, { percentage: 30, entries: words, phraseEntries: [phrase] }), 0);

  assert.equal(restoreWordReplacements(window.document.body), 3);
  assert.equal(window.document.body.innerHTML, originalMarkup);
  window.close();
});

test("does not match a phrase across sibling text nodes", () => {
  const phrase = phraseEntries.find((entry) => entry.english === "thank you");
  assert.ok(phrase);
  const window = new Window();
  window.document.body.innerHTML = `<p>Thank <em>you</em>!</p>`;

  applyWordReplacements(window.document.body, {
    percentage: 30,
    entries: [],
    phraseEntries: [phrase],
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
