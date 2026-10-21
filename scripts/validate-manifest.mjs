import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const manifestPath = new URL("../dist/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.manifest_version, 3, "The built extension must use Manifest V3.");
for (const size of [16, 48, 128]) {
  const iconPath = manifest.icons?.[size];
  assert.equal(typeof iconPath, "string", `The built extension must declare a ${size}px icon.`);
  await access(new URL(`../dist/${iconPath}`, import.meta.url));
}
for (const iconPath of Object.values(manifest.action?.default_icon ?? {})) {
  await access(new URL(`../dist/${iconPath}`, import.meta.url));
}
assert.deepEqual(
  [...(manifest.permissions ?? [])].sort(),
  ["activeTab", "storage"],
  "Review any change to the extension API permissions.",
);
assert.deepEqual(manifest.host_permissions ?? [], [], "Do not add broad host permissions.");
assert.deepEqual(manifest.optional_permissions ?? [], [], "Do not add optional API permissions without review.");
assert.deepEqual(
  manifest.optional_host_permissions ?? [],
  [],
  "Do not add optional host permissions without review.",
);

assert.equal(manifest.action?.default_popup, "index.html", "The popup must remain in the built extension.");
assert.equal(manifest.content_scripts?.length, 1, "Expected one page content script.");
assert.deepEqual(
  [...(manifest.content_scripts[0]?.matches ?? [])].sort(),
  ["http://*/*", "https://*/*"],
  "Review any change to the pages where LinguaPop can run.",
);
assert.equal(
  manifest.content_scripts[0]?.run_at,
  "document_idle",
  "The content script should run after the page document is ready.",
);

console.log("Validated Manifest V3, icons, extension permissions, and HTTP/HTTPS page scope.");
