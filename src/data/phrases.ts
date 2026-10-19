import phraseData from "./phrase-dictionary.json";
import type { Difficulty } from "./dictionary.ts";

export interface PhraseEntry {
  id: string;
  english: string;
  spanish: string;
  pronunciation?: string;
  exampleSpanish?: string;
  exampleEnglish?: string;
  grammarNote?: string;
  difficulty: Difficulty;
}

export const phraseEntries = phraseData as PhraseEntry[];
