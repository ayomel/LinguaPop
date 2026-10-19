import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  applyWordReplacements,
  restoreWordReplacements,
} from "../src/content/replacements.ts";
import { createEnglishToSpanishPair } from "../src/data/language-pairs.ts";

function createPage(markup: string) {
  const window = new Window({ url: "https://example.test/article?section=1" });
  window.document.body.innerHTML = markup;
  return window;
}

function matchingWords(): string {
  return Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? "Apple" : "APPLE")).join(", ");
}

function replacementKeys(document: Document): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']"),
    (element) => element.dataset.linguapopKey ?? "",
  );
}

test("replaces a deterministic percentage of whole dictionary matches", () => {
  const originalMarkup = `<p>${matchingWords()}! pineapple, unApple, and unknown.</p>
    <button>Apple</button><textarea>Apple</textarea><pre>Apple</pre>
    <div contenteditable="true">Apple</div>`;
  const window = createPage(originalMarkup);
  const { document } = window;
  const serializedOriginal = document.body.innerHTML;

  const replaced = applyWordReplacements(document.body, { percentage: 30 });
  const wrappers = document.querySelectorAll("[data-linguapop-replacement='true']");

  assert.equal(replaced, 6);
  assert.equal(wrappers.length, 6);
  assert.match(document.body.textContent ?? "", /pineapple, unApple, and unknown\./);
  assert.equal(document.querySelector("button")?.textContent, "Apple");
  assert.equal(document.querySelector("textarea")?.textContent, "Apple");
  assert.equal(document.querySelector("pre")?.textContent, "Apple");
  assert.equal(document.querySelector("[contenteditable]")?.textContent, "Apple");
  assert.ok(Array.from(wrappers).every((wrapper) => ["Manzana", "MANZANA"].includes(wrapper.textContent ?? "")));

  assert.equal(restoreWordReplacements(document.body), 6);
  assert.equal(document.body.innerHTML, serializedOriginal);
  window.close();
});

test("reprocessing the same page is idempotent and changing the percentage restores first", () => {
  const window = createPage(`<p>${matchingWords()}</p>`);
  const { document } = window;

  assert.equal(applyWordReplacements(document.body, { percentage: 30 }), 6);
  const firstHtml = document.body.innerHTML;
  assert.equal(applyWordReplacements(document.body, { percentage: 30 }), 0);
  assert.equal(document.body.innerHTML, firstHtml);

  assert.equal(applyWordReplacements(document.body, { percentage: 10 }), 2);
  assert.equal(replacementKeys(document).length, 2);
  window.close();
});

test("selects the same words after a page reload and clamps the percentage to 30", () => {
  const markup = `<p>${matchingWords()}</p>`;
  const first = createPage(markup);
  const second = createPage(markup);

  assert.equal(applyWordReplacements(first.document.body, { percentage: 100 }), 6);
  assert.equal(applyWordReplacements(second.document.body, { percentage: 30 }), 6);
  assert.deepEqual(replacementKeys(first.document), replacementKeys(second.document));
  first.close();
  second.close();
});

test("zero percent makes no replacements and an explicit restore returns exact text", () => {
  const markup = `<p>Apple, book! (${matchingWords()})</p>`;
  const window = createPage(markup);
  const { document } = window;

  assert.equal(applyWordReplacements(document.body, { percentage: 0 }), 0);
  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(applyWordReplacements(document.body, { percentage: -5 }), 0);
  assert.equal(document.body.innerHTML, markup);
  window.close();
});

test("replacement and restoration preserve nested markup, punctuation, and protected controls", () => {
  const originalMarkup = `
    <p>Read <em>${Array.from({ length: 20 }, () => "apple").join(", ")}</em>, then open a book.</p>
    <button>water</button>
    <div role="switch"><span>water</span></div>
    <div tabindex="0"><span>apple</span></div>
    <div contenteditable="plaintext-only"><span>apple</span></div>
    <pre><code>book</code></pre>
  `;
  const window = createPage(originalMarkup);
  const { document } = window;
  const originalBody = document.body.innerHTML;

  applyWordReplacements(document.body, { percentage: 30 });
  const wrappers = document.querySelectorAll<HTMLElement>("[data-linguapop-replacement='true']");
  assert.ok(wrappers.length > 0);
  assert.ok(
    Array.from(wrappers).every(
      (wrapper) =>
        wrapper.parentElement?.closest("button, [role='switch'], [tabindex], [contenteditable], pre") === null,
    ),
  );
  assert.equal(document.querySelector("button")?.textContent, "water");
  assert.equal(document.querySelector("[role='switch']")?.textContent, "water");
  assert.equal(document.querySelector("[contenteditable]")?.textContent, "apple");
  assert.equal(document.querySelector("pre")?.textContent, "book");
  assert.ok(document.querySelector("p em"));

  const firstPass = document.body.innerHTML;
  assert.equal(applyWordReplacements(document.body, { percentage: 30 }), 0);
  assert.equal(document.body.innerHTML, firstPass);
  assert.equal(restoreWordReplacements(document.body), wrappers.length);
  assert.equal(document.body.innerHTML, originalBody);
  window.close();
});

test("only the selected vocabulary difficulty is eligible and changing levels restores old matches", () => {
  const entries = [
    { id: "en-apple", english: "apple", spanish: "manzana", partOfSpeech: "noun" as const, difficulty: "beginner" as const },
    { id: "en-language", english: "language", spanish: "idioma", partOfSpeech: "noun" as const, difficulty: "intermediate" as const },
    { id: "en-discover", english: "discover", spanish: "descubrir", partOfSpeech: "verb" as const, difficulty: "advanced" as const },
  ];
  const window = createPage(
    `<p>${Array.from({ length: 20 }, () => "Apple, language, discover.").join(" ")}</p>`,
  );
  const { document } = window;
  const pair = createEnglishToSpanishPair(entries, []);

  assert.equal(applyWordReplacements(document.body, { percentage: 30, difficulty: "beginner", pair }), 6);
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-apple']")?.textContent, "Manzana");
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-language']"), null);
  assert.equal(document.querySelectorAll("[data-linguapop-entry-id='en-apple']").length, 6);

  assert.equal(applyWordReplacements(document.body, { percentage: 30, difficulty: "intermediate", pair }), 6);
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-apple']"), null);
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-language']")?.textContent, "idioma");
  assert.equal(document.querySelectorAll("[data-linguapop-entry-id='en-language']").length, 6);

  assert.equal(applyWordReplacements(document.body, { percentage: 30, difficulty: "advanced", pair }), 6);
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-language']"), null);
  assert.equal(document.querySelector("[data-linguapop-entry-id='en-discover']")?.textContent, "descubrir");
  window.close();
});
