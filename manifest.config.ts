import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "LinguaPop",
  version: "0.1.0",
  description: "Practice Spanish or French while browsing the web.",
  icons: {
    16: "icons/linguapop-16.png",
    48: "icons/linguapop-48.png",
    128: "icons/linguapop-128.png",
  },
  permissions: ["storage", "activeTab"],
  action: {
    default_icon: {
      16: "icons/linguapop-16.png",
      48: "icons/linguapop-48.png",
    },
    default_popup: "index.html",
    default_title: "LinguaPop",
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
  ],
});
