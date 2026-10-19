import { applyWordReplacements, restoreWordReplacements } from "./replacements.ts";
import { isWithinLinguaPopOwnedElement } from "./dom.ts";
import {
  didSiteOverrideChange,
  isSiteEnabled,
  readSettings,
  type LinguaPopSettings,
  type SettingsStorage,
} from "../settings.ts";

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
  let currentSettings: LinguaPopSettings | undefined;
  let flushScheduled = false;
  const pendingNodes = new Set<Node>();
  const ownerDocument = root.ownerDocument;
  const hostname = ownerDocument?.defaultView?.location.hostname ?? "";
  const MutationObserverConstructor = ownerDocument?.defaultView?.MutationObserver;
  let observer: MutationObserver | undefined;

  const observe = (): void => {
    observer?.observe(root, { childList: true, subtree: true });
  };

  const pauseObserver = (callback: () => void): void => {
    observer?.disconnect();
    try {
      callback();
    } finally {
      observe();
    }
  };

  const flushPendingNodes = (): void => {
    if (disposed || pendingNodes.size === 0) return;
    const settings = currentSettings;
    if (!settings) return;

    const addedNodes = [...pendingNodes];
    pendingNodes.clear();
    const addedNodeSet = new Set(addedNodes);
    const topLevelNodes = addedNodes.filter((node) => {
      let ancestor = node.parentNode;
      while (ancestor && ancestor !== root) {
        if (addedNodeSet.has(ancestor)) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    });
    if (!isSiteEnabled(settings, hostname)) return;

    pauseObserver(() => {
      for (const node of topLevelNodes) {
        if (node.nodeType !== 1 && node.nodeType !== 3) continue;
        if (!root.contains(node) || isWithinLinguaPopOwnedElement(node)) continue;
        applyWordReplacements(node as Element | Text, {
          percentage: settings.replacementPercentage,
          difficulty: settings.difficulty,
        });
      }
    });
  };

  const scheduleFlush = (): void => {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      flushPendingNodes();
    });
  };

  if (MutationObserverConstructor) {
    observer = new MutationObserverConstructor((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1 && node.nodeType !== 3) continue;
          if (!isWithinLinguaPopOwnedElement(node)) pendingNodes.add(node);
        }
      }
      scheduleFlush();
    });
    observe();
  }

  const synchronize = async (): Promise<void> => {
    const requestVersion = ++version;

    try {
      const settings = await readSettings(storage);
      if (disposed || requestVersion !== version) return;

      currentSettings = settings;
      pendingNodes.clear();
      pauseObserver(() => {
        if (isSiteEnabled(settings, hostname)) {
          applyWordReplacements(root, {
            percentage: settings.replacementPercentage,
            difficulty: settings.difficulty,
          });
        } else {
          restoreWordReplacements(root);
        }
      });
    } catch {
      if (!disposed && requestVersion === version) {
        currentSettings = undefined;
        pendingNodes.clear();
        pauseObserver(() => restoreWordReplacements(root));
      }
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
      (!changes.enabled &&
        !changes.replacementPercentage &&
        !changes.difficulty &&
        !siteOverrideChanged)
    ) return;
    void synchronize();
  };

  storageChanges.addListener(onStorageChanged);

  return {
    ready: synchronize(),
    dispose() {
      disposed = true;
      version += 1;
      pendingNodes.clear();
      observer?.disconnect();
      storageChanges.removeListener(onStorageChanged);
    },
  };
}
