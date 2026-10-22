import {
  englishToSpanishPair,
  type LanguagePair,
  type LanguagePairEntry,
} from "../data/language-pairs.ts";
import { getEncounteredWords } from "./encounters.ts";
import { DAILY_GOAL_PROGRESS_KEY, getProgressAfterReview } from "./daily-goals.ts";

export const REVIEW_SCHEDULES_KEY = "reviewSchedules";
export const REMEMBERED_INTERVAL_MULTIPLIER = 2;
export const MAX_REVIEW_INTERVAL_DAYS = 30;
export const NEED_PRACTICE_DELAY_MS = 60 * 60 * 1_000;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export type RecallOutcome = "remembered" | "need-practice";

export interface ReviewSchedule {
  lastReviewedAt: number;
  lastOutcome: RecallOutcome;
  intervalDays: number;
  nextDueAt: number;
}

export type ReviewScheduleMap = Record<string, ReviewSchedule>;
export type ReviewStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

export interface DueReview {
  entry: LanguagePairEntry;
  nextDueAt: number;
  contextSentence?: string;
}

interface StoredReviewSchedules {
  [REVIEW_SCHEDULES_KEY]?: unknown;
}

function isEntryId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecallOutcome(value: unknown): value is RecallOutcome {
  return value === "remembered" || value === "need-practice";
}

function readReviewSchedules(rawSchedules: unknown): ReviewScheduleMap {
  if (typeof rawSchedules !== "object" || rawSchedules === null || Array.isArray(rawSchedules)) {
    return {};
  }

  const schedules: ReviewScheduleMap = {};
  for (const [entryId, rawSchedule] of Object.entries(rawSchedules)) {
    if (!isEntryId(entryId) || typeof rawSchedule !== "object" || rawSchedule === null) continue;

    const schedule = rawSchedule as Partial<ReviewSchedule>;
    if (
      !isTimestamp(schedule.lastReviewedAt) ||
      !isRecallOutcome(schedule.lastOutcome) ||
      typeof schedule.intervalDays !== "number" ||
      !Number.isSafeInteger(schedule.intervalDays) ||
      schedule.intervalDays < 1 ||
      schedule.intervalDays > MAX_REVIEW_INTERVAL_DAYS ||
      !isTimestamp(schedule.nextDueAt) ||
      schedule.nextDueAt <= schedule.lastReviewedAt
    ) {
      continue;
    }

    schedules[entryId] = {
      lastReviewedAt: schedule.lastReviewedAt,
      lastOutcome: schedule.lastOutcome,
      intervalDays: schedule.intervalDays,
      nextDueAt: schedule.nextDueAt,
    };
  }
  return schedules;
}

export async function getReviewSchedules(
  storage: ReviewStorage = chrome.storage.local,
): Promise<ReviewScheduleMap> {
  const stored = await storage.get<StoredReviewSchedules>({ [REVIEW_SCHEDULES_KEY]: {} });
  return readReviewSchedules(stored[REVIEW_SCHEDULES_KEY]);
}

export async function getDueReviews(
  storage: ReviewStorage = chrome.storage.local,
  now = Date.now(),
  pair: LanguagePair = englishToSpanishPair,
): Promise<DueReview[]> {
  const [encounters, schedules] = await Promise.all([
    getEncounteredWords(storage),
    getReviewSchedules(storage),
  ]);
  const entriesById = new Map(pair.entries.map((entry) => [entry.id, entry]));
  const dueReviews: DueReview[] = [];

  for (const [entryId, encounter] of Object.entries(encounters)) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;
    const schedule = schedules[entryId];
    const nextDueAt = schedule?.nextDueAt ?? encounter.firstSeenAt;
    if (!schedule || schedule.nextDueAt <= now) {
      dueReviews.push({ entry, nextDueAt, contextSentence: encounter.contextSentence });
    }
  }

  dueReviews.sort((left, right) => left.nextDueAt - right.nextDueAt || left.entry.id.localeCompare(right.entry.id));
  return dueReviews;
}

export async function getNextDueReview(
  storage: ReviewStorage = chrome.storage.local,
  now = Date.now(),
  pair: LanguagePair = englishToSpanishPair,
): Promise<DueReview | undefined> {
  return (await getDueReviews(storage, now, pair))[0];
}

const pendingWrites = new WeakMap<object, Promise<void>>();

/**
 * Uses a small deterministic schedule: first success is due in one day, later
 * successes double the interval up to 30 days, and a miss is due in one hour.
 */
export function recordRecall(
  entryId: string,
  outcome: RecallOutcome,
  storage: ReviewStorage = chrome.storage.local,
  now = Date.now(),
): Promise<ReviewSchedule> {
  if (!isEntryId(entryId)) return Promise.reject(new TypeError("Invalid dictionary entry ID."));
  if (!isRecallOutcome(outcome)) return Promise.reject(new TypeError("Invalid recall outcome."));

  let savedSchedule: ReviewSchedule | undefined;
  const nextWrite = (pendingWrites.get(storage) ?? Promise.resolve()).then(async () => {
    const encounters = await getEncounteredWords(storage);
    if (!Object.hasOwn(encounters, entryId)) {
      throw new TypeError("Cannot review a word that has not been encountered.");
    }

    const schedules = await getReviewSchedules(storage);
    const previous = schedules[entryId];
    const intervalDays =
      outcome === "remembered"
        ? previous?.lastOutcome === "remembered"
          ? Math.min(MAX_REVIEW_INTERVAL_DAYS, previous.intervalDays * REMEMBERED_INTERVAL_MULTIPLIER)
          : 1
        : 1;
    const delay =
      outcome === "remembered" ? intervalDays * millisecondsPerDay : NEED_PRACTICE_DELAY_MS;
    savedSchedule = {
      lastReviewedAt: now,
      lastOutcome: outcome,
      intervalDays,
      nextDueAt: now + delay,
    };
    const dailyProgress = await getProgressAfterReview(storage, now);
    await storage.set({
      [REVIEW_SCHEDULES_KEY]: { ...schedules, [entryId]: savedSchedule },
      [DAILY_GOAL_PROGRESS_KEY]: dailyProgress,
    });
  });

  pendingWrites.set(storage, nextWrite.then(() => undefined, () => undefined));
  return nextWrite.then(() => savedSchedule!);
}
