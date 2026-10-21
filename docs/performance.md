# Replacement performance check

Run `pnpm benchmark:replacements` to measure DOM traversal, selection, and replacement on a repeatable synthetic page.

The fixture has 500 paragraphs and 10,000 eligible words drawn from 40 unique source words. The matcher uses the full language-pair dataset. Each run replaces 5% of the words and checks that exactly 500 replacements were made.

The script reports separate cold and warm medians. Cold runs use a fresh entries array, so they include matcher construction. Warm runs reuse the same array after an untimed priming call, so they measure the cached matcher path. Each median uses three measured runs, with the DOM created before timing.

The check uses Happy DOM and Node, so it measures the extension's replacement logic without a browser layout engine. It is a regression signal for the same local runtime, not a claim about every real webpage.

## Results

On 2026-10-21, five runs before matcher caching had a median of 36.08 ms per call. With caching, five runs measured a cold median of 37.17 ms and a warm median of 24.34 ms on Node 22.20.0 and pnpm 10.22.0. The warm path was about 33% faster in this synthetic fixture. The cold path did not improve, so this change helps repeated processing such as dynamic page updates and settings changes, not the initial page pass.

The earlier single-median baseline from 2026-10-19 measured 27.93 ms initially and 29.03 ms on the final QA rerun. It used a different measurement method and is not directly comparable to the cold and warm results above. Timings vary by machine; use the same machine and runtime when comparing.
