# LinguaPop engineering case study

LinguaPop is a Manifest V3 Chrome extension for practicing Spanish while reading ordinary web pages. Readers choose a replacement percentage and vocabulary level. Replaced words can open a translation, and encountered vocabulary can be reviewed later.

## The engineering problem

The extension changes text it does not own. A useful version has to preserve the page around that text, avoid controls and code, keep replacements predictable as settings change, and handle content that websites add after the first page load.

## Design choices

- **Work with text nodes.** The content script walks eligible text nodes and skips links, form fields, code, media, interactive roles, and LinguaPop's own UI. That limits changes to readable page text.
- **Match phrases before words.** The matcher checks longer phrases first, supports common English contractions for fixed-context phrases, and observes word boundaries. It does not join text across separate DOM nodes.
- **Keep the selected replacements stable.** A hash of the page key, vocabulary entry, and text position ranks candidates. The configured percentage selects a slice of that ranking instead of choosing new words randomly on each run.
- **Reuse the compiled matcher.** A `WeakMap` cache keys matchers by the vocabulary array, source locale, and difficulty. Dynamic page updates and settings changes can reuse the compiled pattern.
- **Make replacements reversible.** Each replacement stores its original text and metadata in a span. The extension can restore the original text when the percentage, level, or site setting changes.
- **Handle pages that keep changing.** A `MutationObserver` batches added page nodes. LinguaPop disconnects the observer while it edits the DOM and ignores nodes it owns, preventing its own changes from triggering another replacement pass.
- **Keep learning data local.** The extension stores encounters, review schedules, and daily-goal progress in `chrome.storage.local`. A remembered word's interval doubles up to 30 days; a missed word is due again in one hour.

## What the checks cover

The automated suite covers replacement stability and restoration, protected page content, phrase and contraction matching, settings changes, tooltip interaction, and learning storage. `pnpm build` runs TypeScript checking before producing the extension bundle. `pnpm dictionary:check` validates the bundled word and phrase data. `pnpm manifest:check` guards the built extension's permissions and page match scope.

The [replacement benchmark](performance.md) uses a synthetic Happy DOM page. It is useful for comparing cold and warm matcher runs on the same machine and runtime, but it does not measure browser layout or represent every real website. The sample reading page supports a manual Chrome walkthrough; automated tests and fixture rendering do not replace that live extension check.

## Current scope and limits

The shipped vocabulary pair is English to Spanish. Phrase matches stay within one text node, so a phrase split by nested markup is not matched as one phrase. This project has automated DOM and storage coverage, but its hiring-manager demo still benefits from a recorded Chrome walkthrough showing the built extension, popup controls, replacements, translation tooltip, and skipped fields.
