export const DEFAULT_SETTINGS = {
  enabled: true,
  replacementPercentage: 5,
} as const;

export interface LinguaPopSettings {
  enabled: boolean;
  replacementPercentage: number;
}

export type SettingsStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

interface StoredSettings {
  enabled?: unknown;
  replacementPercentage?: unknown;
}

export async function readSettings(
  storage: SettingsStorage = chrome.storage.local,
): Promise<LinguaPopSettings> {
  const stored = await storage.get<StoredSettings>(DEFAULT_SETTINGS);
  const percentage = stored.replacementPercentage;

  return {
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : DEFAULT_SETTINGS.enabled,
    replacementPercentage:
      typeof percentage === "number" && Number.isFinite(percentage)
        ? Math.min(30, Math.max(0, percentage))
        : DEFAULT_SETTINGS.replacementPercentage,
  };
}
