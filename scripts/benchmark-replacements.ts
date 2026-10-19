import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Window } from "happy-dom";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";

const paragraphCount = 500;
const wordsPerParagraph = 20;
const replacementPercentage = 5;
const words = dictionaryEntries.slice(0, 40).map((entry) => entry.english);
const paragraphMarkup = Array.from({ length: paragraphCount }, (_, paragraphIndex) => {
  const paragraphWords = Array.from({ length: wordsPerParagraph }, (_, wordIndex) => {
    return words[(paragraphIndex * wordsPerParagraph + wordIndex) % words.length];
  });
  return `<p>${paragraphWords.join(" ")}</p>`;
}).join("");
const expectedReplacementCount =
  (paragraphCount * wordsPerParagraph * replacementPercentage) / 100;
const samples: number[] = [];

for (let run = 0; run < 4; run += 1) {
  const window = new Window({ url: "https://benchmark.example/article" });
  window.document.body.innerHTML = paragraphMarkup;

  const start = performance.now();
  const replacementCount = applyWordReplacements(window.document.body, {
    percentage: replacementPercentage,
  });
  const elapsed = performance.now() - start;

  assert.equal(replacementCount, expectedReplacementCount);
  if (run > 0) samples.push(elapsed);
  window.close();
}

const sortedSamples = [...samples].sort((left, right) => left - right);
const medianMs = sortedSamples[1];

console.log(
  JSON.stringify(
    {
      fixture: `${paragraphCount} paragraphs, ${paragraphCount * wordsPerParagraph} words, ${words.length} dictionary terms`,
      replacementPercentage,
      replacements: expectedReplacementCount,
      measuredRuns: samples.length,
      medianMs: Number(medianMs?.toFixed(2)),
      runtime: `Node ${process.version}`,
    },
    null,
    2,
  ),
);
