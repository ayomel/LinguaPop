import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "LinguaPop",
  version: "0.1.0",
  description: "Learn Spanish while browsing the web.",
  permissions: ["storage"],
  action: {
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
