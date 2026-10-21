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

test("dictionary has 1,000 valid offline entries including common question and auxiliary words", async () => {
  const entries = JSON.parse(await readFile(dictionaryPath, "utf8"));

  assert.equal(entries.length, 1000);
  assert.deepEqual(validateDictionary(entries), []);
  assert.ok(entries.filter((entry) => entry.exampleSpanish && entry.exampleEnglish).length >= 10);
  assert.deepEqual(
    entries
      .filter((entry) => ["I", "you", "he", "she", "we", "they"].includes(entry.english))
      .map(({ english, spanish }) => [english, spanish]),
    [["I", "yo"], ["you", "tú"], ["he", "él"], ["she", "ella"], ["we", "nosotros"], ["they", "ellos"]],
  );
});

test("phrase dictionary stays separate and contains valid, unique phrase entries", async () => {
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));

  assert.equal(phrases.length, 43);
  assert.deepEqual(validatePhraseDictionary(phrases), []);
});

test("the common-word expansion covers all 50 selected terms", async () => {
  const entries = JSON.parse(await readFile(dictionaryPath, "utf8"));
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));
  const targets = `what had have that going who when where why which this these those do does did be is are was were has will would can could should must know think make get go come see say give take because but and or if with from before after about more most`.split(" ");
  const wordEntries = new Set(entries.map(({ english }) => english.toLocaleLowerCase("en")));

  assert.equal(targets.length, 50);
  for (const target of targets) {
    const hasWordEntry = wordEntries.has(target);
    const hasPhraseCoverage = phrases.some(({ english }) =>
      new RegExp(`\\b${target}\\b`, "i").test(english),
    );
    assert.ok(hasWordEntry || hasPhraseCoverage, `Expected coverage for ${target}`);
  }

  for (const phraseOnlyWord of ["had", "have", "that", "going", "will"]) {
    assert.ok(!wordEntries.has(phraseOnlyWord), `Expected ${phraseOnlyWord} to use phrase context`);
    assert.ok(
      phrases.some(({ english }) => new RegExp(`\\b${phraseOnlyWord}\\b`, "i").test(english)),
      `Expected a fixed phrase for ${phraseOnlyWord}`,
    );
  }
});

test("context phrases give fixed translations for the five example words", async () => {
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));
  const expected = new Map([
    ["what do you want?", "¿Qué quieres?"],
    ["I had a good day", "tuve un buen día"],
    ["I have a question", "tengo una pregunta"],
    ["that is good", "eso está bien"],
    ["where are you going?", "¿Adónde vas?"],
    ["I will go", "iré"],
  ]);
  const matching = phrases.filter(({ english }) => expected.has(english));

  assert.equal(matching.length, expected.size);
  for (const phrase of matching) assert.equal(phrase.spanish, expected.get(phrase.english));
});

test("everyday phrase entries include fixed context and each apostrophe style", async () => {
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));
  const expected = new Map([
    ["I am happy", "estoy feliz"], ["I'm happy", "estoy feliz"], ["I’m happy", "estoy feliz"],
    ["I am sad", "estoy triste"], ["I'm sad", "estoy triste"], ["I’m sad", "estoy triste"],
    ["I am here", "estoy aquí"], ["I'm here", "estoy aquí"], ["I’m here", "estoy aquí"],
    ["I am at home", "estoy en casa"], ["I'm at home", "estoy en casa"], ["I’m at home", "estoy en casa"],
    ["I am a student", "soy estudiante"], ["I'm a student", "soy estudiante"], ["I’m a student", "soy estudiante"],
    ["I am hungry", "tengo hambre"], ["I'm hungry", "tengo hambre"], ["I’m hungry", "tengo hambre"],
    ["I am cold", "tengo frío"], ["I'm cold", "tengo frío"], ["I’m cold", "tengo frío"],
    ["you will be happy", "estarás feliz"],
    ["he will be happy", "estará feliz"],
    ["you have got a book", "tienes un libro"],
    ["you all", "ustedes"],
  ]);
  const matching = phrases.filter(({ english }) => expected.has(english));

  assert.equal(matching.length, expected.size);
  for (const phrase of matching) assert.equal(phrase.spanish, expected.get(phrase.english));
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

test("accepts precise function-word categories", () => {
  const entries = ["auxiliary", "conjunction", "determiner", "preposition"].map((partOfSpeech) => ({
    ...validEntry,
    id: `en-${partOfSpeech}`,
    english: partOfSpeech,
    partOfSpeech,
  }));

  assert.deepEqual(validateDictionary(entries), []);
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
