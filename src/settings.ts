export const DEFAULT_SETTINGS = {
  enabled: true,
  replacementPercentage: 5,
  siteOverrides: {},
} as const;

export interface LinguaPopSettings {
  enabled: boolean;
  replacementPercentage: number;
  siteOverrides: Record<string, boolean>;
}

export type SettingsStorage = Pick<chrome.storage.StorageArea, "get" | "set">;

interface StoredSettings {
  enabled?: unknown;
  replacementPercentage?: unknown;
  siteOverrides?: unknown;
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function readSiteOverrides(value: unknown): Record<string, boolean> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const overrides: Record<string, boolean> = {};
  for (const [hostname, enabled] of Object.entries(value)) {
    const normalizedHostname = normalizeHostname(hostname);
    if (normalizedHostname && typeof enabled === "boolean") {
      overrides[normalizedHostname] = enabled;
    }
  }
  return overrides;
}

export function isSiteEnabled(settings: LinguaPopSettings, hostname: string): boolean {
  return settings.enabled && settings.siteOverrides[normalizeHostname(hostname)] !== false;
}

export function didSiteOverrideChange(
  oldValue: unknown,
  newValue: unknown,
  hostname: string,
): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return false;
  return (
    readSiteOverrides(oldValue)[normalizedHostname] !==
    readSiteOverrides(newValue)[normalizedHostname]
  );
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
    siteOverrides: readSiteOverrides(stored.siteOverrides),
  };
}
