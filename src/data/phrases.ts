import phraseData from "./phrase-dictionary.json";
import type { Difficulty, TranslationEntry } from "./dictionary.ts";

export interface PhraseEntry extends TranslationEntry {
  difficulty: Difficulty;
}

export const phraseEntries = phraseData as PhraseEntry[];
