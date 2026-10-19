import { startContentSettings } from "./content/settings.ts";
import { initializeTranslationTooltip } from "./content/tooltip.ts";
import { englishToSpanishPair } from "./data/language-pairs.ts";

startContentSettings(
  document.body,
  chrome.storage.local,
  chrome.storage.onChanged,
  englishToSpanishPair,
);
initializeTranslationTooltip(document, englishToSpanishPair);
