import { dictionaryEntries, type DictionaryEntry } from "../data/dictionary.ts";
import { getEncounteredWords, type WordEncounter } from "./encounters.ts";
import { getLearningStatuses, type LearningStatus } from "./statuses.ts";
import { getDueReviews, type ReviewStorage } from "./reviews.ts";

export type DashboardWordStatus = LearningStatus | "new";

export interface DashboardWord {
  entry: DictionaryEntry;
  encounter: WordEncounter;
  status: DashboardWordStatus;
  due: boolean;
}

export interface VocabularyDashboardSnapshot {
  encounteredCount: number;
  practicingCount: number;
  learnedCount: number;
  dueCount: number;
  words: DashboardWord[];
}

export async function getVocabularyDashboardSnapshot(
  storage: ReviewStorage = chrome.storage.local,
  now = Date.now(),
): Promise<VocabularyDashboardSnapshot> {
  const [encounters, statuses, dueReviews] = await Promise.all([
    getEncounteredWords(storage),
    getLearningStatuses(storage),
    getDueReviews(storage, now),
  ]);
  const entriesById = new Map(dictionaryEntries.map((entry) => [entry.id, entry]));
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
    });
  }

  words.sort(
    (left, right) =>
      right.encounter.lastSeenAt - left.encounter.lastSeenAt ||
      left.entry.english.localeCompare(right.entry.english),
  );

  return {
    encounteredCount: words.length,
    practicingCount: words.filter((word) => word.status === "practicing").length,
    learnedCount: words.filter((word) => word.status === "learned").length,
    dueCount: words.filter((word) => word.due).length,
    words,
  };
}
