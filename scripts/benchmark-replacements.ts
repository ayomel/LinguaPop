import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Window } from "happy-dom";
import { englishToSpanishPair } from "../src/data/language-pairs.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";

const paragraphCount = 500;
const wordsPerParagraph = 20;
const replacementPercentage = 5;
const words = englishToSpanishPair.entries
  .filter((entry) => entry.kind === "word")
  .slice(0, 40)
  .map((entry) => entry.sourceText);
const paragraphMarkup = Array.from({ length: paragraphCount }, (_, paragraphIndex) => {
  const paragraphWords = Array.from({ length: wordsPerParagraph }, (_, wordIndex) => {
    return words[(paragraphIndex * wordsPerParagraph + wordIndex) % words.length];
  });
  return `<p>${paragraphWords.join(" ")}</p>`;
}).join("");
const expectedReplacementCount =
  (paragraphCount * wordsPerParagraph * replacementPercentage) / 100;
const createWindow = (): Window => {
  const window = new Window({ url: "https://benchmark.example/article" });
  window.document.body.innerHTML = paragraphMarkup;
  return window;
};
const createPair = () => ({
  ...englishToSpanishPair,
  entries: [...englishToSpanishPair.entries],
});
const median = (samples: number[]): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const coldSamples: number[] = [];

for (let run = 0; run < 4; run += 1) {
  const window = createWindow();
  const pair = createPair();

  const start = performance.now();
  const replacementCount = applyWordReplacements(window.document.body, {
    percentage: replacementPercentage,
    pair,
  });
  const elapsed = performance.now() - start;

  assert.equal(replacementCount, expectedReplacementCount);
  if (run > 0) coldSamples.push(elapsed);
  window.close();
}

const warmPair = createPair();
const warmupWindow = createWindow();
assert.equal(
  applyWordReplacements(warmupWindow.document.body, {
    percentage: replacementPercentage,
    pair: warmPair,
  }),
  expectedReplacementCount,
);
warmupWindow.close();

const warmSamples: number[] = [];
for (let run = 0; run < 3; run += 1) {
  const window = createWindow();
  const start = performance.now();
  const replacementCount = applyWordReplacements(window.document.body, {
    percentage: replacementPercentage,
    pair: warmPair,
  });
  warmSamples.push(performance.now() - start);
  assert.equal(replacementCount, expectedReplacementCount);
  window.close();
}

console.log(
  JSON.stringify(
    {
      fixture: `${paragraphCount} paragraphs, ${paragraphCount * wordsPerParagraph} words using ${words.length} unique source words`,
      matcherEntries: englishToSpanishPair.entries.length,
      replacementPercentage,
      replacements: expectedReplacementCount,
      coldMedianMs: Number(median(coldSamples).toFixed(2)),
      warmMedianMs: Number(median(warmSamples).toFixed(2)),
      measuredRunsPerMode: coldSamples.length,
      runtime: `Node ${process.version}`,
    },
    null,
    2,
  ),
);
