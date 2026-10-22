import {
  englishToSpanishPair,
  type LanguagePair,
  type LanguagePairEntry,
} from "../data/language-pairs.ts";
import type { VocabularyDifficulty } from "../data/dictionary.ts";
import { getContainingSentence } from "../learning/context-sentence.ts";
import { getEligibleTextNodes } from "./dom.ts";

const replacementSelector = '[data-linguapop-replacement="true"]';
const maximumPercentage = 30;

type ReplacementRoot = Document | DocumentFragment | Element | Text;

export interface ReplacementOptions {
  percentage?: number;
  pair?: LanguagePair;
  difficulty?: VocabularyDifficulty;
  excludedEntryIds?: ReadonlySet<string>;
  onReplacement?: (entryId: string, contextSentence: string) => void;
}

interface Candidate {
  node: Text;
  start: number;
  end: number;
  original: string;
  entry: LanguagePairEntry;
  contextSentence: string;
  key: string;
  rank: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPhraseSourceVariants(sourceText: string): string[] {
  const subjectAuxiliary = /\b(i|you|he|she|it|we|they)\s+(am|are|is|have|has|will|would|had)\b/giu;
  const matches = [...sourceText.matchAll(subjectAuxiliary)];
  if (matches.length === 0) return [sourceText];

  const getContractedForms = (text: string): string[] => {
    const [subject, auxiliary] = text.toLocaleLowerCase("en").split(/\s+/);
    const suffix = {
      am: subject === "i" ? "m" : undefined,
      are: ["you", "we", "they"].includes(subject ?? "") ? "re" : undefined,
      is: ["he", "she", "it"].includes(subject ?? "") ? "s" : undefined,
      have: "ve",
      has: ["he", "she", "it"].includes(subject ?? "") ? "s" : undefined,
      will: "ll",
      would: "d",
      had: "d",
    }[auxiliary ?? ""];

    if (!subject || !suffix) return [text.toLocaleLowerCase("en")];
    return [`${subject}'${suffix}`, `${subject}’${suffix}`];
  };

  let variants = [""];
  let cursor = 0;
  for (const match of matches) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const forms = [match[0].toLocaleLowerCase("en"), ...getContractedForms(match[0])];
    variants = variants.flatMap((variant) =>
      forms.map((form) => `${variant}${sourceText.slice(cursor, start)}${form}`),
    );
    cursor = end;
  }

  return variants.map((variant) => `${variant}${sourceText.slice(cursor)}`);
}

function clampPercentage(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 5;
  return Math.min(maximumPercentage, Math.max(0, value));
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function getPageKey(root: ReplacementRoot): string {
  const ownerDocument = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  const location = ownerDocument?.defaultView?.location;
  return location ? `${location.origin}${location.pathname}${location.search}` : "";
}

function getReplacementElements(root: ReplacementRoot): HTMLElement[] {
  if (root.nodeType === 3) return [];

  const rootElement = root.nodeType === 1 ? (root as Element) : undefined;
  const matchesRoot = rootElement?.matches(replacementSelector) ? [rootElement as HTMLElement] : [];
  const descendants = (root as Document | DocumentFragment | Element).querySelectorAll<HTMLElement>(
    replacementSelector,
  );
  return [...matchesRoot, ...descendants];
}

function createMatcher(entries: readonly LanguagePairEntry[], sourceLocale: string) {
  const entriesBySourceText = new Map<string, LanguagePairEntry>();
  for (const entry of entries) {
    const sourceTexts =
      entry.kind === "phrase" && sourceLocale.toLocaleLowerCase("en").startsWith("en")
        ? getPhraseSourceVariants(entry.sourceText)
        : [entry.sourceText];
    for (const sourceText of sourceTexts) {
      const normalizedSourceText = sourceText.trim().toLocaleLowerCase(sourceLocale);
      if (normalizedSourceText && !entriesBySourceText.has(normalizedSourceText)) {
        entriesBySourceText.set(normalizedSourceText, entry);
      }
    }
  }

  const terms = [...entriesBySourceText.keys()].sort(
    (left, right) => right.length - left.length || (left < right ? -1 : left > right ? 1 : 0),
  );
  if (terms.length === 0) return { entriesBySourceText, pattern: undefined };

  const alternatives = terms.map(escapeRegex).join("|");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_'’])(${alternatives})(?![\\p{L}\\p{N}_'’])`,
    "giu",
  );
  return { entriesBySourceText, pattern };
}

type Matcher = ReturnType<typeof createMatcher>;

const matcherCache = new WeakMap<
  readonly LanguagePairEntry[],
  Map<string, Map<VocabularyDifficulty, Matcher>>
>();

function getMatcher(
  entries: readonly LanguagePairEntry[],
  sourceLocale: string,
  difficulty: VocabularyDifficulty,
): Matcher {
  let matchersByLocale = matcherCache.get(entries);
  if (!matchersByLocale) {
    matchersByLocale = new Map();
    matcherCache.set(entries, matchersByLocale);
  }

  let matchersByDifficulty = matchersByLocale.get(sourceLocale);
  if (!matchersByDifficulty) {
    matchersByDifficulty = new Map();
    matchersByLocale.set(sourceLocale, matchersByDifficulty);
  }

  const cachedMatcher = matchersByDifficulty.get(difficulty);
  if (cachedMatcher) return cachedMatcher;

  const eligibleEntries =
    difficulty === "all"
      ? entries
      : entries.filter((entry) => entry.difficulty === difficulty);
  const matcher = createMatcher(eligibleEntries, sourceLocale);
  matchersByDifficulty.set(difficulty, matcher);
  return matcher;
}

function getCandidates(
  root: ReplacementRoot,
  pair: LanguagePair,
  difficulty: VocabularyDifficulty,
  excludedEntryIds: ReadonlySet<string>,
): Candidate[] {
  const sourceLocale = pair.sourceLanguage.locale;
  const { entriesBySourceText, pattern } = getMatcher(pair.entries, sourceLocale, difficulty);
  if (!pattern) return [];

  const pageKey = getPageKey(root);
  const candidates: Candidate[] = [];
  let textOffset = 0;

  for (const node of getEligibleTextNodes(root)) {
    pattern.lastIndex = 0;
    let match = pattern.exec(node.data);

    while (match) {
      const original = match[0];
      const entry = entriesBySourceText.get(original.toLocaleLowerCase(sourceLocale));
      if (entry && !excludedEntryIds.has(entry.id)) {
        const position = textOffset + match.index;
        const key = `${entry.id}:${position}`;
        candidates.push({
          node,
          start: match.index,
          end: match.index + original.length,
          original,
          entry,
          contextSentence: getContainingSentence(node.data, match.index, match.index + original.length),
          key,
          rank: hash(`${pageKey}|${key}`),
        });
      }

      match = pattern.exec(node.data);
    }

    textOffset += node.data.length;
  }

  return candidates;
}

function preserveTextCase(
  original: string,
  translation: string,
  sourceLocale: string,
  targetLocale: string,
): string {
  if (original === original.toLocaleUpperCase(sourceLocale)) {
    return translation.toLocaleUpperCase(targetLocale);
  }

  const firstCharacter = Array.from(original)[0];
  if (!firstCharacter) return translation;

  const rest = original.slice(firstCharacter.length);
  const isTitleCase =
    firstCharacter === firstCharacter.toLocaleUpperCase(sourceLocale) &&
    rest === rest.toLocaleLowerCase(sourceLocale);

  return isTitleCase
    ? `${Array.from(translation)[0]?.toLocaleUpperCase(targetLocale) ?? ""}${Array.from(translation).slice(1).join("")}`
    : translation;
}

function appendText(document: Document, fragment: DocumentFragment, value: string): void {
  if (value) fragment.append(document.createTextNode(value));
}

function replaceNodeMatches(
  node: Text,
  matches: Candidate[],
  pair: LanguagePair,
  percentage: number,
  difficulty: VocabularyDifficulty,
): void {
  const document = node.ownerDocument;
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of matches.sort((left, right) => left.start - right.start)) {
    appendText(document, fragment, node.data.slice(cursor, match.start));

    const replacement = document.createElement("span");
    replacement.style.setProperty("background-color", "rgba(255, 230, 0, 0.5)", "important");
    replacement.setAttribute("data-linguapop-replacement", "true");
    replacement.setAttribute("data-linguapop-pair-id", pair.id);
    replacement.setAttribute("data-linguapop-kind", match.entry.kind);
    replacement.setAttribute("data-linguapop-original", match.original);
    replacement.setAttribute("data-linguapop-entry-id", match.entry.id);
    replacement.setAttribute("data-linguapop-percentage", String(percentage));
    replacement.setAttribute("data-linguapop-difficulty", difficulty);
    replacement.setAttribute("data-linguapop-key", match.key);
    replacement.setAttribute("role", "button");
    replacement.setAttribute("tabindex", "0");
    replacement.setAttribute(
      "aria-label",
      `${pair.targetLanguage.name} ${match.entry.kind} ${match.entry.targetText}. Show ${pair.sourceLanguage.name} translation for ${match.original}.`,
    );
    replacement.textContent = preserveTextCase(
      match.original,
      match.entry.targetText,
      pair.sourceLanguage.locale,
      pair.targetLanguage.locale,
    );
    fragment.append(replacement);
    cursor = match.end;
  }

  appendText(document, fragment, node.data.slice(cursor));
  node.replaceWith(fragment);
}

/** Replaces a stable, configured share of eligible entries in the selected language pair. */
export function applyWordReplacements(
  root: ReplacementRoot = document.body,
  options: ReplacementOptions = {},
): number {
  const percentage = clampPercentage(options.percentage);
  const difficulty = options.difficulty ?? "all";
  const excludedEntryIds = options.excludedEntryIds ?? new Set<string>();
  const existing = getReplacementElements(root);

  if (
    existing.length > 0 &&
    existing.every(
      (element) =>
        element.getAttribute("data-linguapop-percentage") === String(percentage) &&
        element.getAttribute("data-linguapop-difficulty") === difficulty &&
        element.getAttribute("data-linguapop-pair-id") === (options.pair ?? englishToSpanishPair).id &&
        !excludedEntryIds.has(element.getAttribute("data-linguapop-entry-id") ?? ""),
    )
  ) {
    return 0;
  }

  if (existing.length > 0) restoreWordReplacements(root);
  if (percentage === 0) return 0;

  const pair = options.pair ?? englishToSpanishPair;
  const candidates = getCandidates(root, pair, difficulty, excludedEntryIds);
  const targetCount = Math.floor((candidates.length * percentage) / 100);
  const selected = candidates
    .sort((left, right) => left.rank - right.rank || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
    .slice(0, targetCount);
  const selectedByNode = new Map<Text, Candidate[]>();

  for (const candidate of selected) {
    const matches = selectedByNode.get(candidate.node) ?? [];
    matches.push(candidate);
    selectedByNode.set(candidate.node, matches);
  }

  for (const [node, matches] of selectedByNode) {
    replaceNodeMatches(node, matches, pair, percentage, difficulty);
    for (const match of matches) {
      if (match.entry.kind === "word") {
        options.onReplacement?.(match.entry.id, match.contextSentence);
      }
    }
  }

  return selected.length;
}

/** Restores the exact source strings stored by LinguaPop's replacement spans. */
export function restoreWordReplacements(root: ReplacementRoot = document.body): number {
  const replacements = getReplacementElements(root);
  let restored = 0;

  for (const replacement of replacements) {
    const original = replacement.getAttribute("data-linguapop-original");
    if (original === null || !replacement.parentNode) continue;

    replacement.replaceWith(replacement.ownerDocument.createTextNode(original));
    restored += 1;
  }

  return restored;
}
