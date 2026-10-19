import { applyWordReplacements, restoreWordReplacements } from "./replacements.ts";
import { didSiteOverrideChange, isSiteEnabled, readSettings, type SettingsStorage } from "../settings.ts";

export interface ContentSettingsController {
  ready: Promise<void>;
  dispose(): void;
}

export function startContentSettings(
  root: Element,
  storage: SettingsStorage = chrome.storage.local,
  storageChanges: typeof chrome.storage.onChanged = chrome.storage.onChanged,
): ContentSettingsController {
  let version = 0;
  let disposed = false;
  const ownerDocument = root.ownerDocument;
  const hostname = ownerDocument?.defaultView?.location.hostname ?? "";

  const synchronize = async (): Promise<void> => {
    const requestVersion = ++version;

    try {
      const settings = await readSettings(storage);
      if (disposed || requestVersion !== version) return;

      if (isSiteEnabled(settings, hostname)) {
        applyWordReplacements(root, { percentage: settings.replacementPercentage });
      } else {
        restoreWordReplacements(root);
      }
    } catch {
      if (!disposed && requestVersion === version) restoreWordReplacements(root);
    }
  };

  const onStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    const siteOverrideChanged =
      Boolean(changes.siteOverrides) &&
      didSiteOverrideChange(changes.siteOverrides.oldValue, changes.siteOverrides.newValue, hostname);
    if (
      areaName !== "local" ||
      (!changes.enabled && !changes.replacementPercentage && !siteOverrideChanged)
    ) return;
    void synchronize();
  };

  storageChanges.addListener(onStorageChanged);

  return {
    ready: synchronize(),
    dispose() {
      disposed = true;
      version += 1;
      storageChanges.removeListener(onStorageChanged);
    },
  };
}
