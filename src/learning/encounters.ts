export const ENCOUNTERED_WORDS_KEY = "encounteredWords";

export interface WordEncounter {
  firstSeenAt: number;
  lastSeenAt: number;
  encounterCount: number;
}

export type WordEncounterMap = Record<string, WordEncounter>;
export type EncounterStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

interface StoredEncounters {
  [ENCOUNTERED_WORDS_KEY]?: unknown;
}

function isEntryId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function readEncounterMap(rawRecords: unknown): WordEncounterMap {
  if (typeof rawRecords !== "object" || rawRecords === null || Array.isArray(rawRecords)) return {};

  const records: WordEncounterMap = {};
  for (const [entryId, rawRecord] of Object.entries(rawRecords)) {
    if (!isEntryId(entryId) || typeof rawRecord !== "object" || rawRecord === null) continue;

    const record = rawRecord as Partial<WordEncounter>;
    if (
      !isTimestamp(record.firstSeenAt) ||
      !isTimestamp(record.lastSeenAt) ||
      record.firstSeenAt > record.lastSeenAt ||
      typeof record.encounterCount !== "number" ||
      !Number.isSafeInteger(record.encounterCount) ||
      record.encounterCount < 1
    ) {
      continue;
    }

    records[entryId] = {
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      encounterCount: record.encounterCount,
    };
  }
  return records;
}

export async function getEncounteredWords(
  storage: EncounterStorage = chrome.storage.local,
): Promise<WordEncounterMap> {
  const stored = await storage.get<StoredEncounters>({ [ENCOUNTERED_WORDS_KEY]: {} });
  return readEncounterMap(stored[ENCOUNTERED_WORDS_KEY]);
}

let pendingWrite: Promise<void> = Promise.resolve();

/** Records each actually displayed replacement in local extension storage. */
export function recordWordEncounters(
  entryIds: readonly string[],
  storage: EncounterStorage = chrome.storage.local,
  now: () => number = Date.now,
): Promise<void> {
  const nextWrite = pendingWrite.then(async () => {
    const validIds = entryIds.filter(isEntryId);
    if (validIds.length === 0) return;

    const records = await getEncounteredWords(storage);
    const timestamp = now();
    for (const entryId of validIds) {
      const previous = Object.hasOwn(records, entryId) ? records[entryId] : undefined;
      records[entryId] = {
        firstSeenAt: previous?.firstSeenAt ?? timestamp,
        lastSeenAt: timestamp,
        encounterCount: (previous?.encounterCount ?? 0) + 1,
      };
    }
    await storage.set({ [ENCOUNTERED_WORDS_KEY]: records });
  });

  pendingWrite = nextWrite.then(() => undefined, () => undefined);
  return nextWrite;
}
