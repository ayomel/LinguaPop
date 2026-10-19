import dictionaryData from "./dictionary.json";

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface TranslationEntry {
  id: string;
  english: string;
  spanish: string;
  pronunciation?: string;
  exampleSpanish?: string;
  exampleEnglish?: string;
  grammarNote?: string;
  partOfSpeech?: PartOfSpeech;
  difficulty?: Difficulty;
}

export interface DictionaryEntry extends TranslationEntry {
  partOfSpeech: PartOfSpeech;
  difficulty: Difficulty;
}

// pnpm dictionary:check validates the JSON data against these runtime fields.
export const dictionaryEntries = dictionaryData as DictionaryEntry[];
