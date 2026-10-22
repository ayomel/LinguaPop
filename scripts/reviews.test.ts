import assert from "node:assert/strict";
import test from "node:test";
import {
  getDueReviews,
  getNextDueReview,
  getReviewSchedules,
  MAX_REVIEW_INTERVAL_DAYS,
  recordRecall,
  type ReviewStorage,
} from "../src/learning/reviews.ts";

class FakeStorage {
  values: Record<string, unknown> = {};
  writes: Array<Record<string, unknown>> = [];

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    this.writes.push(values);
    Object.assign(this.values, values);
  }
}

const storageFor = (storage: FakeStorage) => storage as unknown as ReviewStorage;

test("encountered words without a review schedule are due for their first recall", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-book": { firstSeenAt: 200, lastSeenAt: 200, encounterCount: 1 },
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };

  const due = await getNextDueReview(storageFor(storage), 1_000);

  assert.equal(due?.entry.id, "en-apple");
  assert.equal(storage.writes.length, 0, "viewing due words must not create a recall result");
});

test("due reviews include the latest saved encounter sentence when available", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": {
      firstSeenAt: 100,
      lastSeenAt: 100,
      encounterCount: 1,
      contextSentence: "I picked an apple.",
    },
  };

  const due = await getNextDueReview(storageFor(storage), 1_000);

  assert.equal(due?.contextSentence, "I picked an apple.");
});

test("remembered answers lengthen the interval and a miss schedules sooner", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const reviewStorage = storageFor(storage);
  const first = await recordRecall("en-apple", "remembered", reviewStorage, 1_000);
  assert.deepEqual(first, {
    lastReviewedAt: 1_000,
    lastOutcome: "remembered",
    intervalDays: 1,
    nextDueAt: 86_401_000,
  });

  const second = await recordRecall("en-apple", "remembered", reviewStorage, first.nextDueAt);
  assert.equal(second.intervalDays, 2);
  assert.equal(second.nextDueAt, first.nextDueAt + 2 * 86_400_000);

  const missed = await recordRecall("en-apple", "need-practice", reviewStorage, second.nextDueAt);
  assert.equal(missed.intervalDays, 1);
  assert.equal(missed.nextDueAt, second.nextDueAt + 60 * 60 * 1_000);
  assert.equal(missed.lastOutcome, "need-practice");
  const recovered = await recordRecall("en-apple", "remembered", reviewStorage, missed.nextDueAt);
  assert.equal(recovered.intervalDays, 1, "a miss resets the next success interval");
  assert.deepEqual(Object.keys(storage.values).sort(), [
    "dailyGoalProgress",
    "encounteredWords",
    "reviewSchedules",
  ]);
  assert.equal((storage.values.dailyGoalProgress as { completed: number }).completed, 2);
});

test("recall responses reset the daily count at the next local calendar day", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  storage.values.dailyGoalProgress = { date: "2026-10-18", completed: 5 };
  const now = new Date(2026, 9, 19, 0, 5).getTime();

  await recordRecall("en-apple", "need-practice", storageFor(storage), now);

  assert.deepEqual(storage.values.dailyGoalProgress, { date: "2026-10-19", completed: 1 });
});

test("success intervals stop growing at 30 days", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  const reviewStorage = storageFor(storage);
  let currentTime = 1_000;
  let schedule = await recordRecall("en-apple", "remembered", reviewStorage, currentTime);

  for (let review = 0; review < 7; review += 1) {
    currentTime = schedule.nextDueAt;
    schedule = await recordRecall("en-apple", "remembered", reviewStorage, currentTime);
  }

  assert.equal(schedule.intervalDays, 30);
});

test("graduates a word after consecutive remembered reviews reach the maximum interval", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  };
  let reviewAt = 1_000;
  let schedule: Awaited<ReturnType<typeof recordRecall>> | undefined;

  for (let review = 0; review < 6; review += 1) {
    schedule = await recordRecall("en-apple", "remembered", storageFor(storage), reviewAt);
    reviewAt = schedule.nextDueAt;
  }

  assert.equal(schedule?.intervalDays, MAX_REVIEW_INTERVAL_DAYS);
  assert.deepEqual(storage.values.graduatedWords, { "en-apple": true });
  assert.equal((storage.values.learningStatuses as Record<string, string>)["en-apple"], "learned");
  assert.deepEqual(await getDueReviews(storageFor(storage), schedule!.nextDueAt), []);
});

test("only due or unscheduled encountered entries appear in the review queue", async () => {
  const storage = new FakeStorage();
  storage.values.encounteredWords = {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
    "en-book": { firstSeenAt: 200, lastSeenAt: 200, encounterCount: 1 },
  };
  storage.values.reviewSchedules = {
    "en-apple": {
      lastReviewedAt: 300,
      lastOutcome: "remembered",
      intervalDays: 1,
      nextDueAt: 5_000,
    },
  };

  const due = await getNextDueReview(storageFor(storage), 1_000);
  assert.equal(due?.entry.id, "en-book");

  await recordRecall("en-book", "remembered", storageFor(storage), 1_000);
  assert.equal(await getNextDueReview(storageFor(storage), 1_000), undefined);
  assert.equal((await getNextDueReview(storageFor(storage), 5_000))?.entry.id, "en-apple");
});

test("invalid schedule records and entry IDs are ignored", async () => {
  const storage = new FakeStorage();
  storage.values.reviewSchedules = {
    "en-apple": {
      lastReviewedAt: 300,
      lastOutcome: "unknown",
      intervalDays: 1,
      nextDueAt: 500,
    },
    "bad id": {
      lastReviewedAt: 300,
      lastOutcome: "remembered",
      intervalDays: 1,
      nextDueAt: 500,
    },
  };

  assert.deepEqual(await getReviewSchedules(storageFor(storage)), {});
  await assert.rejects(recordRecall("__proto__", "remembered", storageFor(storage), 1_000), /Invalid/);
});
