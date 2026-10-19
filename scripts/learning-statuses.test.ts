import assert from "node:assert/strict";
import test from "node:test";
import {
  getLearningStatuses,
  setLearningStatus,
  type LearningStatusStorage,
} from "../src/learning/statuses.ts";

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

test("missing statuses are empty and explicit status is stored separately", async () => {
  const storage = new FakeStorage();
  const learningStorage = storage as unknown as LearningStatusStorage;
  assert.deepEqual(await getLearningStatuses(learningStorage), {});

  await setLearningStatus("en-apple", "learned", learningStorage);

  assert.deepEqual(await getLearningStatuses(learningStorage), { "en-apple": "learned" });
  assert.deepEqual(Object.keys(storage.writes[0]!), ["learningStatuses"]);
});

test("malformed learning states and unsafe IDs are ignored", async () => {
  const storage = new FakeStorage();
  storage.values.learningStatuses = {
    "en-apple": "practicing",
    "en-book": "reviewing",
    "__proto__": "learned",
    "bad id": "learned",
  };
  const learningStorage = storage as unknown as LearningStatusStorage;

  assert.deepEqual(await getLearningStatuses(learningStorage), { "en-apple": "practicing" });
  await assert.rejects(setLearningStatus("__proto__", "learned", learningStorage), /Invalid/);
});

test("a save failure rejects so the tooltip can report it", async () => {
  const storage = new FakeStorage();
  storage.set = async () => {
    throw new Error("storage unavailable");
  };

  await assert.rejects(
    setLearningStatus("en-apple", "practicing", storage as unknown as LearningStatusStorage),
    /storage unavailable/,
  );
});
