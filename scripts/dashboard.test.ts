import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { initializeVocabularyDashboard } from "../src/learning/dashboard-page.ts";
import { getVocabularyDashboardSnapshot } from "../src/learning/dashboard.ts";
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

function createDashboardPage() {
  const window = new Window({ url: "chrome-extension://extension-id/dashboard.html" });
  window.document.body.innerHTML = `
    <main>
      <strong id="count-encountered"></strong>
      <strong id="count-practicing"></strong>
      <strong id="count-learned"></strong>
      <strong id="count-due"></strong>
      <p id="dashboard-status" role="status"></p>
      <p id="dashboard-empty" hidden></p>
      <ul id="vocabulary-list" hidden></ul>
      <p id="dashboard-error" role="alert" hidden></p>
    </main>
  `;
  return window;
}

function createProgressStorage() {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 2 },
    "en-book": { firstSeenAt: 200, lastSeenAt: 200, encounterCount: 4 },
    "en-city": { firstSeenAt: 300, lastSeenAt: 300, encounterCount: 1 },
    "en-removed": { firstSeenAt: 400, lastSeenAt: 400, encounterCount: 1 },
  };
  storage.values.learningStatuses = {
    "en-apple": "learned",
    "en-book": "practicing",
    "en-removed": "learned",
  };
  storage.values.reviewSchedules = {
    "en-apple": {
      lastReviewedAt: 100,
      lastOutcome: "remembered",
      intervalDays: 1,
      nextDueAt: 10_000,
    },
    "en-city": {
      lastReviewedAt: 300,
      lastOutcome: "need-practice",
      intervalDays: 1,
      nextDueAt: 500,
    },
  };
  return storage;
}

const reviewStorageFor = (storage: FakeStorage) => storage as unknown as ReviewStorage;

test("dashboard counts match valid encountered words and local learning schedules", async () => {
  const snapshot = await getVocabularyDashboardSnapshot(reviewStorageFor(createProgressStorage()), 1_000);

  assert.equal(snapshot.encounteredCount, 3);
  assert.equal(snapshot.practicingCount, 1);
  assert.equal(snapshot.learnedCount, 1);
  assert.equal(snapshot.dueCount, 2);
  assert.deepEqual(
    snapshot.words.map((word) => [word.entry.id, word.status, word.due]),
    [
      ["en-city", "new", true],
      ["en-book", "practicing", true],
      ["en-apple", "learned", false],
    ],
  );
});

test("dashboard lists encountered words, labels their state, and opens translation details", async () => {
  const window = createDashboardPage();
  const storage = createProgressStorage();
  const controller = await initializeVocabularyDashboard(
    window.document,
    reviewStorageFor(storage),
    () => 1_000,
  );

  assert.equal(window.document.querySelector("#count-encountered")?.textContent, "3");
  assert.equal(window.document.querySelector("#count-practicing")?.textContent, "1");
  assert.equal(window.document.querySelector("#count-learned")?.textContent, "1");
  assert.equal(window.document.querySelector("#count-due")?.textContent, "2");
  assert.equal(window.document.querySelector("#dashboard-empty")?.hidden, true);
  const book = window.document.querySelector<HTMLButtonElement>('[data-linguapop-entry-id="en-book"]');
  assert.ok(book);
  assert.match(book.parentElement?.parentElement?.textContent ?? "", /Practicing/);
  assert.match(book.parentElement?.parentElement?.textContent ?? "", /Due/);

  book.click();
  const tooltip = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot;
  assert.ok(tooltip);
  assert.match(tooltip.textContent ?? "", /libro/);
  assert.match(tooltip.textContent ?? "", /book/);

  controller.dispose();
  window.close();
});

test("dashboard shows a first-use empty state when there is no vocabulary history", async () => {
  const window = createDashboardPage();
  const controller = await initializeVocabularyDashboard(
    window.document,
    reviewStorageFor(new FakeStorage()),
  );

  assert.equal(window.document.querySelector("#count-encountered")?.textContent, "0");
  assert.equal(window.document.querySelector("#dashboard-empty")?.hidden, false);
  assert.equal(window.document.querySelector("#vocabulary-list")?.hidden, true);
  controller.dispose();
  window.close();
});

test("dashboard reports storage read failures without showing false zero counts", async () => {
  const window = createDashboardPage();
  const storage = new FakeStorage();
  storage.get = async () => {
    throw new Error("storage unavailable");
  };
  const controller = await initializeVocabularyDashboard(
    window.document,
    reviewStorageFor(storage),
  );

  assert.equal(window.document.querySelector("#count-encountered")?.textContent, "—");
  assert.equal(window.document.querySelector("#dashboard-empty")?.hidden, true);
  assert.match(window.document.querySelector("#dashboard-status")?.textContent ?? "", /could not be loaded/i);
  assert.equal(window.document.querySelector("#dashboard-error")?.hidden, false);
  controller.dispose();
  window.close();
});
