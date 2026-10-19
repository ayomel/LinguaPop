import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dictionaryPath = new URL("../src/data/dictionary.json", import.meta.url);
const phraseDictionaryPath = new URL("../src/data/phrase-dictionary.json", import.meta.url);
const allowedPartsOfSpeech = new Set(["noun", "verb", "adjective", "adverb"]);
const allowedDifficulties = new Set(["beginner", "intermediate", "advanced"]);
const optionalTextFields = ["exampleSpanish", "exampleEnglish", "grammarNote"];
const maxOptionalTextLength = 180;

export function validateDictionary(entries) {
  const errors = [];
  const ids = new Set();
  const englishTerms = new Set();

  if (!Array.isArray(entries)) {
    return ["Dictionary must be a JSON array."];
  }

  entries.forEach((entry, index) => {
    const label = `Entry ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    for (const field of ["id", "english", "spanish"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${label} must include a non-empty ${field}.`);
      }
    }

    if (typeof entry.partOfSpeech !== "string" || !allowedPartsOfSpeech.has(entry.partOfSpeech)) {
      errors.push(`${label} has an unsupported partOfSpeech.`);
    }

    if (typeof entry.difficulty !== "string" || !allowedDifficulties.has(entry.difficulty)) {
      errors.push(`${label} has an unsupported difficulty.`);
    }

    for (const field of optionalTextFields) {
      if (
        Object.hasOwn(entry, field) &&
        (typeof entry[field] !== "string" ||
          entry[field].trim() === "" ||
          entry[field].length > maxOptionalTextLength)
      ) {
        errors.push(`${label} ${field} must be a non-empty string of at most ${maxOptionalTextLength} characters.`);
      }
    }
    if (Object.hasOwn(entry, "exampleSpanish") !== Object.hasOwn(entry, "exampleEnglish")) {
      errors.push(`${label} exampleSpanish and exampleEnglish must be provided together.`);
    }

    if (typeof entry.id === "string" && entry.id.trim() !== "") {
      if (ids.has(entry.id)) errors.push(`${label} has a duplicate ID: ${entry.id}.`);
      ids.add(entry.id);
    }

    if (typeof entry.english === "string" && entry.english.trim() !== "") {
      const normalizedEnglish = entry.english.trim().toLocaleLowerCase("en");
      if (englishTerms.has(normalizedEnglish)) {
        errors.push(`${label} has a duplicate English term: ${entry.english}.`);
      }
      englishTerms.add(normalizedEnglish);
    }
  });

  return errors;
}

export function validatePhraseDictionary(entries) {
  const errors = [];
  const ids = new Set();
  const englishPhrases = new Set();

  if (!Array.isArray(entries)) return ["Phrase dictionary must be a JSON array."];

  entries.forEach((entry, index) => {
    const label = `Phrase ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    if (typeof entry.id !== "string" || !/^phrase-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      errors.push(`${label} must have a stable phrase-prefixed ID.`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label} has a duplicate ID: ${entry.id}.`);
    } else {
      ids.add(entry.id);
    }

    for (const field of ["english", "spanish"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${label} must include a non-empty ${field}.`);
      }
    }

    if (typeof entry.english === "string" && entry.english.trim() !== "") {
      const normalizedEnglish = entry.english.trim().toLocaleLowerCase("en");
      if (englishPhrases.has(normalizedEnglish)) {
        errors.push(`${label} has a duplicate English phrase: ${entry.english}.`);
      }
      englishPhrases.add(normalizedEnglish);
    }

    if (typeof entry.difficulty !== "string" || !allowedDifficulties.has(entry.difficulty)) {
      errors.push(`${label} has an unsupported difficulty.`);
    }
  });

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = JSON.parse(await readFile(dictionaryPath, "utf8"));
  const errors = validateDictionary(entries);
  const phrases = JSON.parse(await readFile(phraseDictionaryPath, "utf8"));
  errors.push(...validatePhraseDictionary(phrases));

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${entries.length} dictionary entries and ${phrases.length} phrase entries.`);
  }
}
