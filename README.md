# LinguaPop

**Practice Spanish while you browse.** LinguaPop is a Manifest V3 Chrome extension that replaces selected English words and phrases on eligible web pages with Spanish. It saves the words you encounter so you can review them later.

See the [engineering case study](docs/engineering-case-study.md) for the problem, implementation choices, and verification boundaries.

## What it does

- Choose how much page text LinguaPop changes and set a vocabulary level. Pause it everywhere or on a specific site.
- Replace full phrases before individual words. LinguaPop skips editable fields, code, and interactive controls.
- Open a translation from the tooltip, then review encountered words with flashcards.
- Set a daily goal. Mark words "Remembered" or "Need practice" to schedule reviews.

## Permissions and data

The `storage` permission saves settings, site overrides, encountered vocabulary, and review progress in `chrome.storage.local` on your device. The `activeTab` permission lets the popup read the current tab's URL and show the per-site toggle. The content script runs on HTTP and HTTPS pages. LinguaPop does not send page text or learning data to a remote service.

## How it works

```mermaid
flowchart LR
    Page[Web page text] --> Content[Content script]
    Content --> Match[Eligible text and phrase matching]
    Data[Bundled English and Spanish data] --> Match
    Match --> PageResult[Spanish text and translation tooltip]
    Match --> Encounters[Encountered vocabulary]
    Encounters --> Local[(Chrome local storage)]
    Local --> Review[Popup, flashcards, and dashboard]
    Review --> Local
```

The `LanguagePair` model keeps replacement logic separate from language data. LinguaPop currently ships English and Spanish dictionaries in separate JSON files. It checks phrases before single words in each eligible text node.

## Run it locally

Use Node.js 20.19.x or newer in the 20.x line, or Node.js 22.12 or newer. You also need pnpm and Google Chrome.

```sh
pnpm install
pnpm build
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist` directory.

To try the sample reading page, run `pnpm dev` in another terminal and open `http://localhost:5173/demo.html` in Chrome:

```sh
pnpm dev
```

Open the LinguaPop popup, raise the replacement percentage, and refresh the page. Select a Spanish replacement to see its translation. The editable field and code sample show content LinguaPop skips.

## Checks

```sh
pnpm build
pnpm test
pnpm dictionary:check
pnpm manifest:check
```

`pnpm build` checks TypeScript and bundles the extension. After the build, run `pnpm manifest:check` to check permissions and page match scope. `pnpm dictionary:check` validates the word and phrase data.

## Code map

- `manifest.config.ts` and `src/content.ts` define the Manifest V3 extension entry points.
- `src/content/` contains webpage matching and translation tooltip behavior.
- `src/data/` contains the language-pair adapter and bundled vocabulary.
- `src/learning/` contains encounters, review scheduling, flashcards, and the dashboard.
- `src/popup.ts` and `src/settings.ts` implement extension controls and saved preferences.
