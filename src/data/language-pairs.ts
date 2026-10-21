import {
  dictionaryEntries,
  type DictionaryEntry,
  type Difficulty,
  type PartOfSpeech,
} from "./dictionary.ts";
import { phraseEntries, type PhraseEntry } from "./phrases.ts";

export interface LanguageMetadata {
  name: string;
  locale: string;
  speechLocale?: string;
}

export interface LanguagePairEntry {
  readonly id: string;
  readonly kind: "word" | "phrase";
  readonly sourceText: string;
  readonly targetText: string;
  readonly pronunciation?: string;
  readonly exampleSourceText?: string;
  readonly exampleTargetText?: string;
  readonly grammarNote?: string;
  readonly partOfSpeech?: PartOfSpeech;
  readonly difficulty: Difficulty;
}

export interface LanguagePair {
  id: string;
  sourceLanguage: LanguageMetadata;
  targetLanguage: LanguageMetadata;
  entries: readonly LanguagePairEntry[];
}

/** Adapts the shipped English/Spanish source files to the language-neutral runtime model. */
export function createEnglishToSpanishPair(
  words: readonly DictionaryEntry[] = dictionaryEntries,
  phrases: readonly PhraseEntry[] = phraseEntries,
): LanguagePair {
  const wordEntries: LanguagePairEntry[] = words.map((entry) => ({
    id: entry.id,
    kind: "word",
    sourceText: entry.english,
    targetText: entry.spanish,
    pronunciation: entry.pronunciation,
    exampleSourceText: entry.exampleEnglish,
    exampleTargetText: entry.exampleSpanish,
    grammarNote: entry.grammarNote,
    partOfSpeech: entry.partOfSpeech,
    difficulty: entry.difficulty,
  }));
  const phraseLanguageEntries: LanguagePairEntry[] = phrases.map((entry) => ({
    id: entry.id,
    kind: "phrase",
    sourceText: entry.english,
    targetText: entry.spanish,
    pronunciation: entry.pronunciation,
    exampleSourceText: entry.exampleEnglish,
    exampleTargetText: entry.exampleSpanish,
    grammarNote: entry.grammarNote,
    difficulty: entry.difficulty,
  }));

  return {
    id: "en-es",
    sourceLanguage: { name: "English", locale: "en" },
    targetLanguage: { name: "Spanish", locale: "es", speechLocale: "es-ES" },
    entries: [...wordEntries, ...phraseLanguageEntries],
  };
}

export const englishToSpanishPair = createEnglishToSpanishPair();
