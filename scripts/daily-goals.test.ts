import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DAILY_GOAL,
  getDailyGoalProgress,
  getDailyGoalSettings,
  setDailyGoal,
  type DailyGoalStorage,
} from "../src/learning/daily-goals.ts";

class FakeStorage {
  values: Record<string, unknown> = {};

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    Object.assign(this.values, values);
  }
}

const storageFor = (storage: FakeStorage) => storage as unknown as DailyGoalStorage;

test("daily goal defaults to ten and progress starts at zero", async () => {
  const storage = new FakeStorage();
  assert.deepEqual(await getDailyGoalSettings(storageFor(storage), new Date(2026, 9, 19, 12).getTime()), {
    goal: DEFAULT_DAILY_GOAL,
    completed: 0,
    date: "2026-10-19",
  });
});

test("daily progress is zero when it belongs to a previous local calendar day", async () => {
  const storage = new FakeStorage();
  storage.values.dailyGoalProgress = { date: "2026-10-18", completed: 7 };

  assert.deepEqual(await getDailyGoalProgress(storageFor(storage), new Date(2026, 9, 19, 0, 5).getTime()), {
    date: "2026-10-19",
    completed: 0,
  });
});

test("daily goal accepts values from one to fifty and rejects values outside the range", async () => {
  const storage = new FakeStorage();
  await setDailyGoal(1, storageFor(storage));
  assert.equal((await getDailyGoalSettings(storageFor(storage), 0)).goal, 1);
  await setDailyGoal(50, storageFor(storage));
  assert.equal((await getDailyGoalSettings(storageFor(storage), 0)).goal, 50);
  await assert.rejects(setDailyGoal(0, storageFor(storage)), /between 1 and 50/);
  await assert.rejects(setDailyGoal(51, storageFor(storage)), /between 1 and 50/);
  await assert.rejects(setDailyGoal(1.5, storageFor(storage)), /between 1 and 50/);
});
