import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { initializeFlashcards } from "../src/learning/flashcards.ts";
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

function createFlashcardPage() {
  const window = new Window();
  window.document.body.innerHTML = `
    <input id="daily-goal" type="number" />
    <p id="daily-goal-progress"></p>
    <p id="daily-goal-status"></p>
    <p id="flashcard-prompt"></p>
    <button id="flashcard-reveal" type="button" hidden>Reveal Spanish</button>
    <p id="flashcard-answer" hidden></p>
    <div id="flashcard-actions" hidden>
      <button id="flashcard-remembered" type="button">Remembered</button>
      <button id="flashcard-practice" type="button">Need practice</button>
    </div>
    <p id="flashcard-status"></p>
  `;
  return window;
}

test("flashcard reveals on request and records explicit recall toward the daily goal", async () => {
  const window = createFlashcardPage();
  const storage = new FakeStorage();
  storage.values.dailyGoal = 1;
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const controller = await initializeFlashcards(
    window.document,
    storage as unknown as ReviewStorage,
    () => new Date(2026, 9, 19, 12).getTime(),
  );

  const reveal = window.document.querySelector<HTMLButtonElement>("#flashcard-reveal")!;
  const answer = window.document.querySelector<HTMLElement>("#flashcard-answer")!;
  assert.match(window.document.querySelector("#flashcard-prompt")?.textContent ?? "", /apple/i);
  assert.equal(answer.hidden, true);
  assert.equal(storage.values.reviewSchedules, undefined);

  reveal.click();
  assert.equal(answer.textContent, "manzana");
  assert.equal(answer.hidden, false);

  window.document.querySelector<HTMLButtonElement>("#flashcard-remembered")!.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(storage.values.dailyGoalProgress, { date: "2026-10-19", completed: 1 });
  assert.equal(
    (storage.values.reviewSchedules as Record<string, { lastOutcome: string }>)?.["en-apple"]?.lastOutcome,
    "remembered",
  );
  assert.match(window.document.querySelector("#daily-goal-status")?.textContent ?? "", /daily goal complete/i);
  assert.match(window.document.querySelector("#flashcard-prompt")?.textContent ?? "", /no words are due/i);

  controller.dispose();
  window.close();
});

test("flashcards show a first-use state and let the user change the goal", async () => {
  const window = createFlashcardPage();
  const storage = new FakeStorage();
  const controller = await initializeFlashcards(
    window.document,
    storage as unknown as ReviewStorage,
    () => new Date(2026, 9, 19, 12).getTime(),
  );

  const goal = window.document.querySelector<HTMLInputElement>("#daily-goal")!;
  assert.equal(goal.value, "10");
  assert.match(window.document.querySelector("#flashcard-prompt")?.textContent ?? "", /browse to encounter/i);
  assert.match(window.document.querySelector("#daily-goal-progress")?.textContent ?? "", /0 of 10/);

  goal.value = "3";
  goal.dispatchEvent(new window.Event("change"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.values.dailyGoal, 3);
  assert.match(window.document.querySelector("#daily-goal-status")?.textContent ?? "", /set to 3/);

  controller.dispose();
  window.close();
});
