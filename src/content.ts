import { startContentSettings } from "./content/settings.ts";
import { initializeTranslationTooltip } from "./content/tooltip.ts";
import { getLanguagePair, englishToSpanishPair } from "./data/language-pairs.ts";
import { readSettings } from "./settings.ts";

startContentSettings(
  document.body,
  chrome.storage.local,
  chrome.storage.onChanged,
  englishToSpanishPair,
);
let tooltipPairId = englishToSpanishPair.id;
let tooltipController = initializeTranslationTooltip(document, englishToSpanishPair);
let tooltipSyncVersion = 0;
const synchronizeTooltip = async (): Promise<void> => {
  const requestVersion = ++tooltipSyncVersion;
  try {
    const settings = await readSettings(chrome.storage.local);
    if (requestVersion !== tooltipSyncVersion) return;
    const pair = getLanguagePair(settings.languagePairId);
    if (!pair || pair.id === tooltipPairId) return;
    tooltipController.dispose();
    tooltipController = initializeTranslationTooltip(document, pair);
    tooltipPairId = pair.id;
  } catch {
    // Keep the last working tooltip pair when extension storage is unavailable.
  }
};
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.languagePairId) void synchronizeTooltip();
});
void synchronizeTooltip();
