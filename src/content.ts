import { startContentSettings } from "./content/settings.ts";
import { initializeTranslationTooltip } from "./content/tooltip.ts";

startContentSettings(document.body);
initializeTranslationTooltip(document);
