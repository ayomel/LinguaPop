import assert from "node:assert/strict";
import test from "node:test";
import { readSettings } from "../src/settings.ts";

test("a fresh install defaults to enabled with a five percent replacement rate", async () => {
  let requestedDefaults: Record<string, unknown> | undefined;
  const storage = {
    async get(defaults: Record<string, unknown>) {
      requestedDefaults = defaults;
      return defaults;
    },
  };

  assert.deepEqual(await readSettings(storage), {
    enabled: true,
    replacementPercentage: 5,
  });
  assert.deepEqual(requestedDefaults, {
    enabled: true,
    replacementPercentage: 5,
  });
});

test("settings use safe defaults when stored values have invalid types", async () => {
  const storage = {
    async get() {
      return { enabled: "off", replacementPercentage: "30" };
    },
  };

  assert.deepEqual(await readSettings(storage), {
    enabled: true,
    replacementPercentage: 5,
  });
});
