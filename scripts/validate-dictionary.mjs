import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dictionaryPath = new URL("../src/data/dictionary.json", import.meta.url);
const phraseDictionaryPath = new URL("../src/data/phrase-dictionary.json", import.meta.url);
const frenchDictionaryPath = new URL("../src/data/french-dictionary.json", import.meta.url);
const frenchPhraseDictionaryPath = new URL("../src/data/french-phrase-dictionary.json", import.meta.url);
const allowedPartsOfSpeech = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "auxiliary",
  "conjunction",
  "determiner",
  "preposition",
]);
const allowedDifficulties = new Set(["beginner", "intermediate", "advanced"]);
const maxOptionalTextLength = 180;

export function validateDictionary(entries, sourceField = "english", targetField = "spanish", exampleTargetField = `example${targetField[0].toUpperCase()}${targetField.slice(1)}`) {
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

    for (const field of ["id", sourceField, targetField]) {
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

    for (const field of [exampleTargetField, "exampleEnglish", "grammarNote"]) {
      if (
        Object.hasOwn(entry, field) &&
        (typeof entry[field] !== "string" ||
          entry[field].trim() === "" ||
          entry[field].length > maxOptionalTextLength)
      ) {
        errors.push(`${label} ${field} must be a non-empty string of at most ${maxOptionalTextLength} characters.`);
      }
    }
    if (Object.hasOwn(entry, exampleTargetField) !== Object.hasOwn(entry, "exampleEnglish")) {
      errors.push(`${label} ${exampleTargetField} and exampleEnglish must be provided together.`);
    }

    if (typeof entry.id === "string" && entry.id.trim() !== "") {
      if (ids.has(entry.id)) errors.push(`${label} has a duplicate ID: ${entry.id}.`);
      ids.add(entry.id);
    }

    if (typeof entry[sourceField] === "string" && entry[sourceField].trim() !== "") {
      const normalizedSource = entry[sourceField].trim().toLocaleLowerCase("en");
      if (englishTerms.has(normalizedSource)) {
        errors.push(`${label} has a duplicate ${sourceField === "english" ? "English" : "source"} term: ${entry[sourceField]}.`);
      }
      englishTerms.add(normalizedSource);
    }
  });

  return errors;
}

export function validatePhraseDictionary(entries, sourceField = "english", targetField = "spanish") {
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

    for (const field of [sourceField, targetField]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${label} must include a non-empty ${field}.`);
      }
    }

    if (typeof entry[sourceField] === "string" && entry[sourceField].trim() !== "") {
      const normalizedSource = entry[sourceField].trim().toLocaleLowerCase("en");
      if (englishPhrases.has(normalizedSource)) {
        errors.push(`${label} has a duplicate ${sourceField === "english" ? "English" : "source"} phrase: ${entry[sourceField]}.`);
      }
      englishPhrases.add(normalizedSource);
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
  const frenchEntries = JSON.parse(await readFile(frenchDictionaryPath, "utf8"));
  errors.push(...validateDictionary(frenchEntries, "english", "french", "exampleFrench"));
  const frenchPhrases = JSON.parse(await readFile(frenchPhraseDictionaryPath, "utf8"));
  errors.push(...validatePhraseDictionary(frenchPhrases, "english", "french"));

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${entries.length} Spanish words, ${phrases.length} Spanish phrases, ${frenchEntries.length} French words, and ${frenchPhrases.length} French phrases.`);
  }
}
