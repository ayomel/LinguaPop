import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateDictionary, validatePhraseDictionary } from "./validate-dictionary.mjs";

const dictionaryPath = new URL("../src/data/dictionary.json", import.meta.url);
const phraseDictionaryPath = new URL("../src/data/phrase-dictionary.json", import.meta.url);
const validEntry = {
  id: "en-book",
  english: "book",
  spanish: "libro",
  partOfSpeech: "noun",
  difficulty: "beginner",
};

test("dictionary has 500 valid offline entries", async () => {
  const entries = JSON.parse(await readFile(dictionaryPath, "utf8"));

  assert.equal(entries.length, 500);
  assert.deepEqual(validateDictionary(entries), []);
  assert.ok(entries.filter((entry) => entry.exampleSpanish && entry.exampleEnglish).length >= 10);
});

test("phrase dictionary stays separate and contains valid, unique phrase entries", async () => {
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));

  assert.ok(phrases.length >= 8);
  assert.deepEqual(validatePhraseDictionary(phrases), []);
});

test("phrase validation rejects duplicate IDs, duplicate English, and unsupported difficulty", () => {
  const phrases = [
    { id: "phrase-thank-you", english: "thank you", spanish: "gracias", difficulty: "beginner" },
    { id: "phrase-thank-you", english: "Thanks", spanish: "gracias", difficulty: "beginner" },
    { id: "phrase-thanks", english: " THANK YOU ", spanish: "gracias", difficulty: "expert" },
  ];
  const errors = validatePhraseDictionary(phrases);

  assert.ok(errors.some((error) => error.includes("duplicate ID")));
  assert.ok(errors.some((error) => error.includes("duplicate English phrase")));
  assert.ok(errors.some((error) => error.includes("unsupported difficulty")));
});

test("accepts dictionary entries with the required fields", () => {
  assert.deepEqual(validateDictionary([validEntry]), []);
});

test("accepts complete optional example and grammar fields", () => {
  assert.deepEqual(
    validateDictionary([
      {
        ...validEntry,
        exampleSpanish: "Leo un libro.",
        exampleEnglish: "I read a book.",
        grammarNote: "Use the masculine article un with libro.",
      },
    ]),
    [],
  );
});

test("rejects incomplete or invalid optional example and grammar fields", () => {
  const errors = validateDictionary([
    { ...validEntry, exampleSpanish: "Leo un libro." },
    { ...validEntry, id: "en-pen", english: "pen", exampleEnglish: "I have a pen." },
    { ...validEntry, id: "en-note", english: "note", grammarNote: " " },
    { ...validEntry, id: "en-bad", english: "bad", exampleSpanish: 42, exampleEnglish: "A book." },
    {
      ...validEntry,
      id: "en-long",
      english: "long",
      exampleSpanish: "a".repeat(181),
      exampleEnglish: "A long example.",
    },
  ]);

  assert.ok(errors.some((error) => error.includes("exampleSpanish and exampleEnglish must be provided together")));
  assert.ok(errors.some((error) => error.includes("grammarNote must be a non-empty string")));
  assert.ok(errors.some((error) => error.includes("exampleSpanish must be a non-empty string")));
  assert.ok(errors.some((error) => error.includes("at most 180 characters")));
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
