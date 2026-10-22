# Chrome Web Store listing draft

## Product details

**Name:** LinguaPop

**Short description:** Practice Spanish or French as you browse. Replace selected English words and phrases, check translations, and review vocabulary you encounter.

**Category:** Education

**Language:** English

**Support contact:** huntermelverton@gmail.com

**Single purpose:** Help users practice Spanish or French while reading webpages by replacing selected English words and phrases with the selected language and supporting review of encountered vocabulary.

## Detailed description

Build everyday Spanish or French vocabulary a little at a time, right in the pages you already read.

Choose English-to-Spanish or English-to-French in the popup. LinguaPop replaces a percentage of eligible English words and phrases with the selected language. Choose a replacement for its translation, then review vocabulary you encounter with flashcards and a daily goal.

- Choose a replacement percentage and a beginner, intermediate, advanced, or all-level vocabulary set.
- Pause LinguaPop everywhere or turn it off for a specific site.
- See a translation when you select a replacement.
- Save encountered vocabulary and review it later with recall-based scheduling and its most recently encountered sentence (up to 500 characters per word).
- Keep settings and learning progress in Chrome's local extension storage.

LinguaPop supports English-to-Spanish and English-to-French practice. It processes eligible page text locally to provide replacements and saves one recently encountered sentence (up to 500 characters) per encountered word in Chrome's local extension storage for review. Each language pair keeps separate encounter, review, and daily progress. It does not send page text or learning data to a LinguaPop server. Editable fields, code, and interactive content are skipped.

## Privacy declarations to complete in the dashboard

- **Single purpose:** Use the statement above.
- **Permissions:** `storage` stores settings and learning progress locally. `activeTab` lets the popup read the current tab URL to show the per-site control. The content script runs on HTTP and HTTPS pages for the reading-practice feature.
- **Data handling:** Disclose that webpage text is processed locally to deliver the feature, and that settings, selected site hostnames, vocabulary/review progress, and one most recently encountered sentence per word (up to 500 characters) are stored locally. Do not state that the extension handles no user data.
- **Privacy policy URL:** Publish [privacy-policy.md](privacy-policy.md) at a stable public URL and paste that URL into the dashboard. The policy already uses the support email above.
- **Distribution:** Public.

## Store artwork

- Store icon: `store-assets/icon-128.png`
- Screenshots: `store-assets/screenshots/`
- Small promotional tile: `store-assets/promo-tile-440x280.png`

The screenshots should be uploaded in order, starting with the in-context reading experience. Keep them current with the reviewed package.

## Before submission

- Publish the privacy policy at a stable public URL.
- Build the package and confirm the ZIP's root contains `manifest.json`.
- Verify screenshots show the current extension and meet the Chrome Web Store's 1280x800 or 640x400 size requirement.
