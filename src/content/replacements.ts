import { dictionaryEntries, type DictionaryEntry } from "../data/dictionary.ts";
import { getEligibleTextNodes } from "./dom.ts";

const replacementSelector = '[data-linguapop-replacement="true"]';
const maximumPercentage = 30;

type ReplacementRoot = Document | DocumentFragment | Element;

export interface ReplacementOptions {
  percentage?: number;
  entries?: readonly DictionaryEntry[];
}

interface Candidate {
  node: Text;
  start: number;
  end: number;
  original: string;
  entry: DictionaryEntry;
  key: string;
  rank: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const rootElement = root.nodeType === 1 ? (root as Element) : undefined;
  const matchesRoot = rootElement?.matches(replacementSelector) ? [rootElement as HTMLElement] : [];
  return [...matchesRoot, ...root.querySelectorAll<HTMLElement>(replacementSelector)];
}

function createMatcher(entries: readonly DictionaryEntry[]) {
  const entriesByEnglish = new Map<string, DictionaryEntry>();
  for (const entry of entries) {
    const english = entry.english.trim().toLocaleLowerCase("en");
    if (english && !entriesByEnglish.has(english)) entriesByEnglish.set(english, entry);
  }

  const terms = [...entriesByEnglish.keys()].sort(
    (left, right) => right.length - left.length || (left < right ? -1 : left > right ? 1 : 0),
  );
  if (terms.length === 0) return { entriesByEnglish, pattern: undefined };

  const alternatives = terms.map(escapeRegex).join("|");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${alternatives})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  return { entriesByEnglish, pattern };
}

function getCandidates(
  root: ReplacementRoot,
  entries: readonly DictionaryEntry[],
): Candidate[] {
  const { entriesByEnglish, pattern } = createMatcher(entries);
  if (!pattern) return [];

  const pageKey = getPageKey(root);
  const candidates: Candidate[] = [];
  let textOffset = 0;

  for (const node of getEligibleTextNodes(root)) {
    pattern.lastIndex = 0;
    let match = pattern.exec(node.data);

    while (match) {
      const original = match[0];
      const entry = entriesByEnglish.get(original.toLocaleLowerCase("en"));
      if (entry) {
        const position = textOffset + match.index;
        const key = `${entry.id}:${position}`;
        candidates.push({
          node,
          start: match.index,
          end: match.index + original.length,
          original,
          entry,
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

function preserveWordCase(original: string, translation: string): string {
  if (original === original.toLocaleUpperCase("en")) {
    return translation.toLocaleUpperCase("es");
  }

  const firstCharacter = Array.from(original)[0];
  if (!firstCharacter) return translation;

  const rest = original.slice(firstCharacter.length);
  const isTitleCase =
    firstCharacter === firstCharacter.toLocaleUpperCase("en") &&
    rest === rest.toLocaleLowerCase("en");

  return isTitleCase
    ? `${Array.from(translation)[0]?.toLocaleUpperCase("es") ?? ""}${Array.from(translation).slice(1).join("")}`
    : translation;
}

function appendText(document: Document, fragment: DocumentFragment, value: string): void {
  if (value) fragment.append(document.createTextNode(value));
}

function replaceNodeMatches(node: Text, matches: Candidate[], percentage: number): void {
  const document = node.ownerDocument;
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of matches.sort((left, right) => left.start - right.start)) {
    appendText(document, fragment, node.data.slice(cursor, match.start));

    const replacement = document.createElement("span");
    replacement.setAttribute("data-linguapop-replacement", "true");
    replacement.setAttribute("data-linguapop-original", match.original);
    replacement.setAttribute("data-linguapop-entry-id", match.entry.id);
    replacement.setAttribute("data-linguapop-percentage", String(percentage));
    replacement.setAttribute("data-linguapop-key", match.key);
    replacement.setAttribute("role", "button");
    replacement.setAttribute("tabindex", "0");
    replacement.setAttribute(
      "aria-label",
      `Spanish word ${match.entry.spanish}. Show English translation for ${match.original}.`,
    );
    replacement.textContent = preserveWordCase(match.original, match.entry.spanish);
    fragment.append(replacement);
    cursor = match.end;
  }

  appendText(document, fragment, node.data.slice(cursor));
  node.replaceWith(fragment);
}

/** Replaces a stable, configured share of eligible dictionary matches. */
export function applyWordReplacements(
  root: ReplacementRoot = document.body,
  options: ReplacementOptions = {},
): number {
  const percentage = clampPercentage(options.percentage);
  const existing = getReplacementElements(root);

  if (
    existing.length > 0 &&
    existing.every((element) => element.getAttribute("data-linguapop-percentage") === String(percentage))
  ) {
    return 0;
  }

  if (existing.length > 0) restoreWordReplacements(root);
  if (percentage === 0) return 0;

  const candidates = getCandidates(root, options.entries ?? dictionaryEntries);
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
    replaceNodeMatches(node, matches, percentage);
  }

  return selected.length;
}

/** Restores the exact English strings stored by LinguaPop's replacement spans. */
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
