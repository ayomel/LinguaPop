import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";
import { initializePopup } from "../src/popup.ts";
import type { SettingsStorage } from "../src/settings.ts";

class PopupStorage {
  values: Record<string, unknown> = {};
  failSet = false;

  async get(defaults: Record<string, unknown>) {
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    if (this.failSet) throw new Error("Storage is unavailable");
    Object.assign(this.values, values);
  }
}

async function createPopup() {
  const window = new Window();
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  window.document.write(html);
  return window;
}

async function settlePopupChange() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("popup loads and persists the global toggle with an accessible status", async () => {
  const window = await createPopup();
  const storage = new PopupStorage();
  storage.values = { enabled: false, replacementPercentage: 20 };
  const initialized = initializePopup(window.document, storage as unknown as SettingsStorage);
  const toggle = window.document.querySelector<HTMLInputElement>("#enabled-toggle")!;

  assert.equal(toggle.disabled, true);
  await initialized;
  assert.equal(toggle.checked, false);
  assert.equal(toggle.disabled, false);
  assert.equal(toggle.getAttribute("role"), "switch");
  assert.equal(window.document.querySelector('label[for="enabled-toggle"]')?.textContent, "Enable LinguaPop");
  assert.equal(toggle.getAttribute("aria-describedby"), "enabled-description enabled-status");
  assert.equal(window.document.querySelector("#enabled-status")?.textContent, "LinguaPop is off");

  toggle.checked = true;
  toggle.dispatchEvent(new window.Event("change"));
  await settlePopupChange();

  assert.equal(storage.values.enabled, true);
  assert.equal(storage.values.replacementPercentage, 20);
  assert.equal(window.document.querySelector("#enabled-status")?.textContent, "LinguaPop is on");
  assert.equal(window.document.querySelector("#settings-error")?.hasAttribute("hidden"), true);
  assert.equal(window.document.querySelector<HTMLInputElement>("#replacement-percentage")?.value, "20");
  window.close();

  const reopened = await createPopup();
  await initializePopup(reopened.document, storage as unknown as SettingsStorage);
  assert.equal(reopened.document.querySelector<HTMLInputElement>("#enabled-toggle")?.checked, true);
  assert.equal(reopened.document.querySelector("#enabled-status")?.textContent, "LinguaPop is on");
  reopened.close();
});

test("popup keeps the saved toggle state and shows an error when saving fails", async () => {
  const window = await createPopup();
  const storage = new PopupStorage();
  storage.values = { enabled: true };
  storage.failSet = true;
  await initializePopup(window.document, storage as unknown as SettingsStorage);
  const toggle = window.document.querySelector<HTMLInputElement>("#enabled-toggle")!;

  toggle.checked = false;
  toggle.dispatchEvent(new window.Event("change"));
  await settlePopupChange();

  assert.equal(toggle.checked, true);
  assert.equal(toggle.disabled, false);
  assert.equal(window.document.querySelector("#enabled-status")?.textContent, "LinguaPop is on");
  assert.equal(window.document.querySelector("#settings-error")?.hasAttribute("hidden"), false);
  window.close();
});

test("popup reports a settings read error without enabling an unknown state", async () => {
  const window = await createPopup();
  const storage = {
    async get() {
      throw new Error("Storage is unavailable");
    },
    async set() {},
  };

  await initializePopup(window.document, storage as unknown as SettingsStorage);

  const toggle = window.document.querySelector<HTMLInputElement>("#enabled-toggle")!;
  assert.equal(toggle.disabled, true);
  assert.equal(window.document.querySelector("#enabled-status")?.textContent, "LinguaPop settings could not be loaded.");
  assert.equal(window.document.querySelector("#settings-error")?.hasAttribute("hidden"), false);
  window.close();
});

test("popup starts enabled when no saved setting exists", async () => {
  const window = await createPopup();
  const storage = new PopupStorage();

  await initializePopup(window.document, storage as unknown as SettingsStorage);

  assert.equal(window.document.querySelector<HTMLInputElement>("#enabled-toggle")?.checked, true);
  assert.equal(window.document.querySelector("#enabled-status")?.textContent, "LinguaPop is on");
  assert.equal(window.document.querySelector<HTMLInputElement>("#replacement-percentage")?.value, "5");
  assert.equal(window.document.querySelector("#replacement-percentage-value")?.textContent, "5%");
  window.close();
});

test("percentage slider uses integer bounds and persists the selected value", async () => {
  const window = await createPopup();
  const storage = new PopupStorage();
  await initializePopup(window.document, storage as unknown as SettingsStorage);

  const slider = window.document.querySelector<HTMLInputElement>("#replacement-percentage")!;
  const value = window.document.querySelector<HTMLOutputElement>("#replacement-percentage-value")!;
  assert.equal(slider.min, "0");
  assert.equal(slider.max, "30");
  assert.equal(slider.step, "1");
  assert.equal(window.document.querySelector('label[for="replacement-percentage"]')?.textContent, "Replacement percentage");

  slider.value = "0";
  slider.dispatchEvent(new window.Event("input"));
  assert.equal(value.textContent, "0%");
  slider.dispatchEvent(new window.Event("change"));
  await settlePopupChange();
  assert.equal(storage.values.replacementPercentage, 0);

  slider.value = "30";
  slider.dispatchEvent(new window.Event("input"));
  slider.dispatchEvent(new window.Event("change"));
  await settlePopupChange();
  assert.equal(storage.values.replacementPercentage, 30);
  assert.equal(value.textContent, "30%");

  const reopened = await createPopup();
  await initializePopup(reopened.document, storage as unknown as SettingsStorage);
  assert.equal(reopened.document.querySelector<HTMLInputElement>("#replacement-percentage")?.value, "30");
  reopened.close();
  window.close();
});

test("percentage slider restores its saved value and reports a storage error", async () => {
  const window = await createPopup();
  const storage = new PopupStorage();
  storage.values = { enabled: true, replacementPercentage: 12 };
  await initializePopup(window.document, storage as unknown as SettingsStorage);
  storage.failSet = true;

  const slider = window.document.querySelector<HTMLInputElement>("#replacement-percentage")!;
  slider.value = "18";
  slider.dispatchEvent(new window.Event("input"));
  slider.dispatchEvent(new window.Event("change"));
  await settlePopupChange();

  assert.equal(slider.value, "12");
  assert.equal(window.document.querySelector("#replacement-percentage-value")?.textContent, "12%");
  assert.equal(window.document.querySelector("#settings-error")?.hasAttribute("hidden"), false);
  window.close();
});
