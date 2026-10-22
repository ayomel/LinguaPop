export const GRADUATED_WORDS_KEY = "graduatedWords";

export type GraduatedWordMap = Record<string, true>;
export type GraduationStorage = Pick<chrome.storage.StorageArea, "get">;

interface StoredGraduatedWords {
  [GRADUATED_WORDS_KEY]?: unknown;
}

function isEntryId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

function readGraduatedWords(rawValue: unknown): GraduatedWordMap {
  if (typeof rawValue !== "object" || rawValue === null || Array.isArray(rawValue)) return {};

  const graduated: GraduatedWordMap = {};
  for (const [entryId, value] of Object.entries(rawValue)) {
    if (isEntryId(entryId) && value === true) graduated[entryId] = true;
  }
  return graduated;
}

export async function getGraduatedWords(
  storage: GraduationStorage = chrome.storage.local,
): Promise<GraduatedWordMap> {
  const stored = await storage.get<StoredGraduatedWords>({ [GRADUATED_WORDS_KEY]: {} });
  return readGraduatedWords(stored[GRADUATED_WORDS_KEY]);
}
