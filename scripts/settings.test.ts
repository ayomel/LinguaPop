import assert from "node:assert/strict";
import test from "node:test";
import { isSiteEnabled, normalizeHostname, readSettings } from "../src/settings.ts";

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
    difficulty: "beginner",
    siteOverrides: {},
  });
  assert.deepEqual(requestedDefaults, {
    enabled: true,
    replacementPercentage: 5,
    difficulty: "beginner",
    siteOverrides: {},
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
    difficulty: "beginner",
    siteOverrides: {},
  });
});

test("site overrides are normalized and invalid values are ignored", async () => {
  const storage = {
    async get() {
      return {
        enabled: true,
        replacementPercentage: 5,
        siteOverrides: {
          " Example.COM. ": false,
          "other.example": true,
          "bad.example": "off",
          "": false,
        },
      };
    },
  };

  assert.deepEqual((await readSettings(storage)).siteOverrides, {
    "example.com": false,
    "other.example": true,
  });
  assert.equal(normalizeHostname(" Example.COM. "), "example.com");
});

test("the global toggle takes precedence over a site override", () => {
  assert.equal(isSiteEnabled({ enabled: false, replacementPercentage: 5, siteOverrides: { "example.com": true } }, "example.com"), false);
  assert.equal(isSiteEnabled({ enabled: true, replacementPercentage: 5, siteOverrides: { "example.com": false } }, "example.com"), false);
  assert.equal(isSiteEnabled({ enabled: true, replacementPercentage: 5, siteOverrides: {} }, "example.com"), true);
});

test("difficulty settings accept supported levels and default invalid values to beginner", async () => {
  const supported = await readSettings({
    async get() {
      return { difficulty: "advanced" };
    },
  });
  const invalid = await readSettings({
    async get() {
      return { difficulty: "expert" };
    },
  });

  assert.equal(supported.difficulty, "advanced");
  assert.equal(invalid.difficulty, "beginner");
});
