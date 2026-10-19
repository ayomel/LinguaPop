import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { dictionaryEntries } from "../src/data/dictionary.ts";
import { applyWordReplacements } from "../src/content/replacements.ts";
import { initializeTranslationTooltip } from "../src/content/tooltip.ts";

function createPage() {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 20 }, () => "Apple").join(", ")}</p><p>Nothing to translate here.</p>`;
  applyWordReplacements(window.document.body, { percentage: 100 });
  return window;
}

function click(window: Window, target: Element) {
  target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
}

test("clicking a replacement opens a translation inside an isolated shadow root", () => {
  const window = createPage();
  const entries = dictionaryEntries.map((entry) =>
    entry.id === "en-apple" ? { ...entry, pronunciation: "mahn-SAH-nah" } : entry,
  );
  const controller = initializeTranslationTooltip(window.document, entries);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  click(window, replacement);

  const host = window.document.querySelector<HTMLElement>("[data-linguapop-tooltip]");
  assert.ok(host);
  assert.ok(host.shadowRoot);
  assert.equal(host.getAttribute("data-linguapop-ui"), "true");
  const entry = entries.find((candidate) => candidate.id === replacement.dataset.linguapopEntryId)!;
  assert.match(host.shadowRoot.textContent ?? "", new RegExp(replacement.dataset.linguapopOriginal!, "i"));
  assert.match(host.shadowRoot.textContent ?? "", new RegExp(entry.spanish, "i"));
  assert.match(host.shadowRoot.textContent ?? "", /mahn-SAH-nah/);
  assert.ok(host.shadowRoot.querySelector("style"));
  assert.equal(replacement.getAttribute("role"), "button");
  assert.equal(replacement.getAttribute("tabindex"), "0");
  controller.dispose();
  window.close();
});

test("Escape and outside clicks dismiss the tooltip", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;
  const outside = window.document.querySelector("p:last-child")!;

  click(window, replacement);
  assert.ok(window.document.querySelector("[data-linguapop-tooltip]"));
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);
  assert.equal(window.document.activeElement, replacement);

  click(window, replacement);
  const closeButton = window.document.querySelector("[data-linguapop-tooltip]")?.shadowRoot?.querySelector("button");
  assert.ok(closeButton);
  closeButton.click();
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);

  click(window, replacement);
  click(window, outside);
  assert.equal(window.document.querySelector("[data-linguapop-tooltip]"), null);
  controller.dispose();
  window.close();
});

test("replacement words open the tooltip with Enter and Space", () => {
  const window = createPage();
  const controller = initializeTranslationTooltip(window.document);
  const replacement = window.document.querySelector<HTMLElement>("[data-linguapop-replacement]")!;

  for (const key of ["Enter", " "]) {
    replacement.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    assert.ok(window.document.querySelector("[data-linguapop-tooltip]"));
    window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  controller.dispose();
  window.close();
});
