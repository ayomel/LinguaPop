export const LEARNING_STATUSES_KEY = "learningStatuses";

export type LearningStatus = "learned" | "practicing";
export type LearningStatusMap = Record<string, LearningStatus>;
export type LearningStatusStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

interface StoredLearningStatuses {
  [LEARNING_STATUSES_KEY]?: unknown;
}

function isEntryId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

function isLearningStatus(value: unknown): value is LearningStatus {
  return value === "learned" || value === "practicing";
}

function readLearningStatusMap(rawStatuses: unknown): LearningStatusMap {
  if (typeof rawStatuses !== "object" || rawStatuses === null || Array.isArray(rawStatuses)) {
    return {};
  }

  const statuses: LearningStatusMap = {};
  for (const [entryId, status] of Object.entries(rawStatuses)) {
    if (isEntryId(entryId) && isLearningStatus(status)) statuses[entryId] = status;
  }
  return statuses;
}

export async function getLearningStatuses(
  storage: LearningStatusStorage = chrome.storage.local,
): Promise<LearningStatusMap> {
  const stored = await storage.get<StoredLearningStatuses>({ [LEARNING_STATUSES_KEY]: {} });
  return readLearningStatusMap(stored[LEARNING_STATUSES_KEY]);
}

const pendingWrites = new WeakMap<object, Promise<void>>();

/** Saves explicit learning state separately from the static dictionary and encounter history. */
export function setLearningStatus(
  entryId: string,
  status: LearningStatus,
  storage: LearningStatusStorage = chrome.storage.local,
): Promise<void> {
  if (!isEntryId(entryId)) return Promise.reject(new TypeError("Invalid dictionary entry ID."));

  const nextWrite = (pendingWrites.get(storage) ?? Promise.resolve()).then(async () => {
    const statuses = await getLearningStatuses(storage);
    statuses[entryId] = status;
    await storage.set({ [LEARNING_STATUSES_KEY]: statuses });
  });

  pendingWrites.set(storage, nextWrite.then(() => undefined, () => undefined));
  return nextWrite;
}
