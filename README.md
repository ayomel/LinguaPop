# LinguaPop

**Practice Spanish while you browse.** LinguaPop is a Manifest V3 Chrome extension that replaces some eligible English words and phrases on web pages with Spanish. It saves those words for you to review later.

See the [engineering case study](docs/engineering-case-study.md) for the problem, implementation choices, and verification boundaries.

## What it does

- Choose how much page text changes and which vocabulary level to use. You can also pause LinguaPop everywhere or on a specific site.
- Replace complete phrases before individual words. LinguaPop skips editable fields, code, and interactive controls.
- Select a replacement to see its translation, then review encountered words with flashcards.
- Track review progress with a daily goal and a schedule based on explicit "Remembered" or "Need practice" answers.

Settings, encountered words, and review progress are saved in `chrome.storage.local`. The extension includes English-to-Spanish word and phrase data. English to Spanish is the only language pair available right now.

## Permissions and data

The `storage` permission saves your settings, site overrides, encountered words, and review progress on this device. The `activeTab` permission lets the popup read the current tab’s URL and show its per-site toggle. LinguaPop works with page text on HTTP and HTTPS sites. It does not send page text or learning data to a remote service.

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

The runtime uses a language-neutral `LanguagePair` model. The English and Spanish dictionaries are stored in separate JSON files. Within an eligible text node, longer phrases take priority over individual words.

## Run it locally

You’ll need Node.js 20.19 or newer in the 20.x line, or Node.js 22.12 or newer, along with pnpm and Google Chrome.

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
