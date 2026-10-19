import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "LinguaPop",
  version: "0.1.0",
  description: "Learn Spanish while browsing the web.",
  action: {
    default_popup: "index.html",
    default_title: "LinguaPop",
  },
});
