import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { englishToFrenchPair } from "../src/data/language-pairs.ts";
import { initializeReviewCard } from "../src/learning/review-card.ts";
import type { ReviewStorage } from "../src/learning/reviews.ts";

class FakeStorage {
  values: Record<string, unknown> = {};

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    Object.assign(this.values, values);
  }
}

function createReviewPage() {
  const window = new Window();
  window.document.body.innerHTML = `
    <section aria-labelledby="review-title">
      <h2 id="review-title">Quick review</h2>
      <p id="review-prompt"></p>
      <p id="review-context" hidden></p>
      <button id="review-reveal" type="button" hidden>Reveal Spanish</button>
      <p id="review-answer" lang="es" hidden></p>
      <div id="review-actions" hidden>
        <button id="review-remembered" type="button">Remembered</button>
        <button id="review-practice" type="button">Need practice</button>
      </div>
      <p id="review-status" role="status" aria-live="polite"></p>
    </section>
  `;
  return window;
}

test("review card asks for recall before reveal and schedules only an explicit result", async () => {
  const window = createReviewPage();
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": {
      firstSeenAt: 100,
      lastSeenAt: 100,
      encounterCount: 1,
      contextSentence: "I picked an Apple from the tree.",
    },
  };
  const controller = await initializeReviewCard(
    window.document,
    storage as unknown as ReviewStorage,
    () => 1_000,
  );
  const reveal = window.document.querySelector<HTMLButtonElement>("#review-reveal")!;
  const answer = window.document.querySelector<HTMLElement>("#review-answer")!;
  const context = window.document.querySelector<HTMLElement>("#review-context")!;
  const actions = window.document.querySelector<HTMLElement>("#review-actions")!;

  assert.match(window.document.querySelector("#review-prompt")?.textContent ?? "", /apple/i);
  assert.equal(context.hidden, false);
  assert.equal(context.textContent, "I picked an Apple from the tree.");
  assert.equal(context.querySelector("mark")?.textContent, "Apple");
  assert.equal(answer.hidden, true);
  assert.equal(actions.hidden, true);
  assert.equal(storage.values.reviewSchedules, undefined);

  reveal.click();
  assert.equal(answer.textContent, "manzana");
  assert.equal(answer.hidden, false);
  assert.equal(actions.hidden, false);
  assert.equal(storage.values.reviewSchedules, undefined);

  window.document.querySelector<HTMLButtonElement>("#review-remembered")!.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    (storage.values.reviewSchedules as Record<string, { lastOutcome: string }>)["en-apple"]?.lastOutcome,
    "remembered",
  );
  assert.match(window.document.querySelector("#review-prompt")?.textContent ?? "", /no words are due/i);
  controller.dispose();
  window.close();
});

test("review card gives a first-review empty state when no words were encountered", async () => {
  const window = createReviewPage();
  const controller = await initializeReviewCard(
    window.document,
    new FakeStorage() as unknown as ReviewStorage,
  );

  assert.match(window.document.querySelector("#review-prompt")?.textContent ?? "", /browse to encounter/i);
  assert.equal(window.document.querySelector("#review-reveal")?.hidden, true);
  controller.dispose();
  window.close();
});

test("review card supports legacy encounters without a saved context sentence", async () => {
  const window = createReviewPage();
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const controller = await initializeReviewCard(
    window.document,
    storage as unknown as ReviewStorage,
    () => 1_000,
  );

  assert.match(window.document.querySelector("#review-prompt")?.textContent ?? "", /apple/i);
  assert.equal(window.document.querySelector("#review-context")?.hidden, true);
  assert.equal(window.document.querySelector("#review-answer")?.hidden, true);
  controller.dispose();
  window.close();
});

test("quick review announces when a remembered word graduates", async () => {
  const window = createReviewPage();
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  storage.values.reviewSchedules = {
    "en-apple": {
      lastReviewedAt: 100,
      lastOutcome: "remembered",
      intervalDays: 16,
      nextDueAt: 1_000,
    },
  };
  const controller = await initializeReviewCard(
    window.document,
    storage as unknown as ReviewStorage,
    () => 1_000,
  );

  window.document.querySelector<HTMLButtonElement>("#review-reveal")!.click();
  window.document.querySelector<HTMLButtonElement>("#review-remembered")!.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(storage.values.graduatedWords, { "en-apple": true });
  assert.match(window.document.querySelector("#review-status")?.textContent ?? "", /graduated/i);
  controller.dispose();
  window.close();
});

test("quick review uses French target text and language metadata", async () => {
  const window = createReviewPage();
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-fr-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const controller = await initializeReviewCard(
    window.document,
    storage as unknown as ReviewStorage,
    () => 1_000,
    englishToFrenchPair,
  );

  assert.match(window.document.querySelector("#review-prompt")?.textContent ?? "", /apple/i);
  window.document.querySelector<HTMLButtonElement>("#review-reveal")!.click();
  assert.equal(window.document.querySelector("#review-answer")?.textContent, "pomme");
  assert.equal(window.document.querySelector("#review-answer")?.getAttribute("lang"), "fr");
  controller.dispose();
  window.close();
});
