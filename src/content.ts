import { startContentSettings } from "./content/settings.ts";
import { initializeTranslationTooltip } from "./content/tooltip.ts";
import { dictionaryEntries } from "./data/dictionary.ts";
import { phraseEntries } from "./data/phrases.ts";

startContentSettings(document.body);
initializeTranslationTooltip(document, [...dictionaryEntries, ...phraseEntries]);
