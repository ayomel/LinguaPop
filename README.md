# LinguaPop

LinguaPop is a Chrome extension for learning Spanish while browsing the web.

## Requirements

- Node.js 20.19 or newer in the 20.x line, or 22.12 or newer
- npm
- Google Chrome

Vite's current release supports Node.js 20.19+ in the 20.x line and 22.12+.

## Set up

```sh
npm install
npm run dev
```

## Build and load in Chrome

```sh
npm run build
```

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the `dist` directory.

The popup is wired into the Manifest V3 build. The content-script source file is in place, but the manifest does not inject it into websites yet. Page processing and its site access will be added in later issues.
