import {
  englishToSpanishPair,
  type LanguagePair,
  type LanguagePairEntry,
} from "../data/language-pairs.ts";
import { getEncounteredWords, type WordEncounter } from "./encounters.ts";
import { getGraduatedWords, GRADUATED_WORDS_KEY } from "./graduated-words.ts";
import { getLearningStatuses, LEARNING_STATUSES_KEY, type LearningStatus } from "./statuses.ts";
import { getDueReviews, getReviewSchedules, REVIEW_SCHEDULES_KEY, type ReviewStorage } from "./reviews.ts";

export type DashboardWordStatus = LearningStatus | "new";

export interface DashboardWord {
  entry: LanguagePairEntry;
  encounter: WordEncounter;
  status: DashboardWordStatus;
  due: boolean;
  graduated: boolean;
}

export interface VocabularyDashboardSnapshot {
  encounteredCount: number;
  practicingCount: number;
  learnedCount: number;
  dueCount: number;
  graduatedCount: number;
  words: DashboardWord[];
  graduatedWords: DashboardWord[];
}

export async function getVocabularyDashboardSnapshot(
  storage: ReviewStorage = chrome.storage.local,
  now = Date.now(),
  pair: LanguagePair = englishToSpanishPair,
): Promise<VocabularyDashboardSnapshot> {
  const [encounters, statuses, dueReviews, graduatedWordsById] = await Promise.all([
    getEncounteredWords(storage),
    getLearningStatuses(storage),
    getDueReviews(storage, now, pair),
    getGraduatedWords(storage),
  ]);
  const entriesById = new Map(pair.entries.map((entry) => [entry.id, entry]));
  const dueIds = new Set(dueReviews.map(({ entry }) => entry.id));
  const words: DashboardWord[] = [];

  for (const [entryId, encounter] of Object.entries(encounters)) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;
    words.push({
      entry,
      encounter,
      status: statuses[entryId] ?? "new",
      due: dueIds.has(entryId),
      graduated: Object.hasOwn(graduatedWordsById, entryId),
    });
  }

  words.sort(
    (left, right) =>
      right.encounter.lastSeenAt - left.encounter.lastSeenAt ||
      left.entry.sourceText.localeCompare(right.entry.sourceText),
  );

  const graduatedWords = words.filter((word) => word.graduated);
  const wordsInProgress = words.filter((word) => !word.graduated);

  return {
    encounteredCount: words.length,
    practicingCount: wordsInProgress.filter((word) => word.status === "practicing").length,
    learnedCount: wordsInProgress.filter((word) => word.status === "learned").length,
    dueCount: words.filter((word) => word.due).length,
    graduatedCount: graduatedWords.length,
    words,
    graduatedWords,
  };
}

export async function returnGraduatedWordToPractice(
  entryId: string,
  storage: ReviewStorage = chrome.storage.local,
): Promise<boolean> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(entryId)) return false;

  const [graduatedWords, reviewSchedules, learningStatuses] = await Promise.all([
    getGraduatedWords(storage),
    getReviewSchedules(storage),
    getLearningStatuses(storage),
  ]);
  if (!Object.hasOwn(graduatedWords, entryId)) return false;

  delete graduatedWords[entryId];
  delete reviewSchedules[entryId];
  learningStatuses[entryId] = "practicing";
  await storage.set({
    [GRADUATED_WORDS_KEY]: graduatedWords,
    [REVIEW_SCHEDULES_KEY]: reviewSchedules,
    [LEARNING_STATUSES_KEY]: learningStatuses,
  });
  return true;
}
