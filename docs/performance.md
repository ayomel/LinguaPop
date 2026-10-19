# Replacement performance check

Run `pnpm benchmark:replacements` to measure DOM traversal, selection, and replacement on a repeatable synthetic page.

The fixture has 500 paragraphs and 10,000 eligible words drawn from 40 dictionary entries. Each run replaces 5% of the words. The script creates the DOM before timing, runs once as a warm-up, then reports the median of three measured runs. It also checks that exactly 500 replacements were made.

The check uses Happy DOM and Node, so it measures the extension's replacement logic without a browser layout engine. It is a regression signal for the same local runtime, not a claim about every real webpage.

## Baseline

Measured with Node 22.20.0 and pnpm 10.22.0 on 2026-10-19. The initial median was 27.93 ms, and the final QA rerun measured 29.03 ms. Timings vary by machine, so compare runs on the same machine and runtime.
