import assert from "node:assert/strict";
import test from "node:test";
import {
  getEncounteredWords,
  recordWordEncounters,
  type EncounterStorage,
} from "../src/learning/encounters.ts";

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

test("missing progress is an empty record set", async () => {
  assert.deepEqual(await getEncounteredWords(new FakeStorage() as unknown as EncounterStorage), {});
});

test("encounters create stable-ID records and increment counts without changing first-seen time", async () => {
  const storage = new FakeStorage();
  const encounterStorage = storage as unknown as EncounterStorage;

  await recordWordEncounters(["en-apple", "en-apple", "en-book"], encounterStorage, () => 100);
  await recordWordEncounters(["en-apple"], encounterStorage, () => 250);

  assert.deepEqual(await getEncounteredWords(encounterStorage), {
    "en-apple": { firstSeenAt: 100, lastSeenAt: 250, encounterCount: 3 },
    "en-book": { firstSeenAt: 100, lastSeenAt: 100, encounterCount: 1 },
  });
  assert.equal(storage.writes.length, 2);
});

test("malformed and older progress records are ignored safely", async () => {
  const storage = new FakeStorage();
  storage.values = {
    encounteredWords: {
      "en-apple": { firstSeenAt: 20, lastSeenAt: 10, encounterCount: 3 },
      "en-bad": { firstSeenAt: "yesterday", lastSeenAt: 10, encounterCount: 1 },
    },
  };
  (storage.values.encounteredWords as Record<string, unknown>)["__proto__"] = {
    firstSeenAt: 1,
    lastSeenAt: 1,
    encounterCount: 1,
  };

  const encounterStorage = storage as unknown as EncounterStorage;
  assert.deepEqual(await getEncounteredWords(encounterStorage), {});
  await recordWordEncounters(["en-apple", "", "__proto__"], encounterStorage, () => 300);
  assert.deepEqual(await getEncounteredWords(encounterStorage), {
    "en-apple": { firstSeenAt: 300, lastSeenAt: 300, encounterCount: 1 },
  });
});
