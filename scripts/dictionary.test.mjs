import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateDictionary } from "./validate-dictionary.mjs";

const dictionaryPath = new URL("../src/data/dictionary.json", import.meta.url);
const validEntry = {
  id: "en-book",
  english: "book",
  spanish: "libro",
  partOfSpeech: "noun",
  difficulty: "beginner",
};

test("starter dictionary has 120 valid offline entries", async () => {
  const entries = JSON.parse(await readFile(dictionaryPath, "utf8"));

  assert.equal(entries.length, 120);
  assert.deepEqual(validateDictionary(entries), []);
});

test("accepts dictionary entries with the required fields", () => {
  assert.deepEqual(validateDictionary([validEntry]), []);
});

test("reports missing fields and unsupported vocabulary metadata", () => {
  const errors = validateDictionary([
    { ...validEntry, spanish: " ", partOfSpeech: "thing", difficulty: "expert" },
  ]);

  assert.ok(errors.some((error) => error.includes("spanish")));
  assert.ok(errors.some((error) => error.includes("partOfSpeech")));
  assert.ok(errors.some((error) => error.includes("difficulty")));
});

test("reports duplicate IDs and English source terms", () => {
  const errors = validateDictionary([
    validEntry,
    { ...validEntry, english: "BOOK" },
  ]);

  assert.ok(errors.some((error) => error.includes("duplicate ID")));
  assert.ok(errors.some((error) => error.includes("duplicate English term")));
});
