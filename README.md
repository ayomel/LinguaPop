# LinguaPop

LinguaPop is a Chrome extension for learning Spanish while browsing the web.

## Requirements

- Node.js 20.19 or newer in the 20.x line, or 22.12 or newer
- pnpm
- Google Chrome

Vite's current release supports Node.js 20.19+ in the 20.x line and 22.12+.

## Set up

```sh
pnpm install
pnpm dev
```

## Build and load in Chrome

```sh
pnpm build
```

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the `dist` directory.

The extension popup controls replacement settings and offers a quick review for encountered vocabulary. Open the vocabulary dashboard from the popup to see learning counts and review your encountered word list. The content script safely processes eligible webpage text and leaves form fields, editable content, code, and interactive controls unchanged.

The dashboard also has a flashcard review flow and a configurable daily goal. The goal defaults to 10 reviews and accepts 1 to 50. Progress counts explicit review answers and resets on the next local calendar day.

Single words and common phrases use separate static JSON files. Phrase matches stay within one eligible text node and take precedence over individual words inside the phrase. Run `pnpm dictionary:check` to validate both datasets.

## Review schedule

Only choosing **Remembered** or **Need practice** records a review. Seeing a word in a webpage or opening the review card does not change its schedule.

- A first remembered answer is due again in 1 day. Consecutive remembered answers double the interval, up to 30 days.
- A **Need practice** answer is due again in 1 hour and resets the success interval to 1 day.
- Encountered words without a review record are available for their first explicit recall. Review outcomes and due dates are saved locally, separately from dictionary data.
