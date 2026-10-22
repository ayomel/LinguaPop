import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { applyWordReplacements } from "../src/content/replacements.ts";
import { startContentSettings } from "../src/content/settings.ts";
import type { WordEncounter } from "../src/learning/encounters.ts";
import type { SettingsStorage } from "../src/settings.ts";

class FakeStorage {
  values: Record<string, unknown> = {};
  reads = 0;
  failEncounterWrites = false;

  async get(defaults: Record<string, unknown>) {
    this.reads += 1;
    return { ...defaults, ...this.values };
  }

  async set(values: Record<string, unknown>) {
    if (this.failEncounterWrites && Object.hasOwn(values, "encounteredWords")) {
      throw new Error("Progress storage is unavailable");
    }
    Object.assign(this.values, values);
  }
}

class FakeStorageChanges {
  listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>();

  addListener(listener: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) {
    this.listeners.delete(listener);
  }

  emit(changes: Record<string, chrome.storage.StorageChange>, areaName = "local") {
    for (const listener of this.listeners) listener(changes, areaName);
  }
}

function createPage() {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 20 }, () => "Apple").join(" ")}</p>`;
  return window;
}

async function settleStorageChange() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("content settings restore prior replacements when the saved state is off", async () => {
  const window = createPage();
  const { document } = window;
  applyWordReplacements(document.body, { percentage: 30 });
  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 6);

  const storage = new FakeStorage();
  storage.values = { enabled: false, replacementPercentage: 30 };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(document.body.textContent?.match(/Apple/g)?.length, 20);
  controller.dispose();
  window.close();
});

test("content settings use the default on state and update open pages from local changes", async () => {
  const window = createPage();
  const { document } = window;
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 1);

  storage.values = { enabled: false };
  changes.emit({ enabled: { oldValue: true, newValue: false } });
  await settleStorageChange();
  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 0);

  storage.values = { enabled: true, replacementPercentage: 30 };
  changes.emit({ enabled: { oldValue: false, newValue: true } });
  await settleStorageChange();
  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 6);

  storage.values = { enabled: true, replacementPercentage: 10 };
  changes.emit({ replacementPercentage: { oldValue: 30, newValue: 10 } });
  await settleStorageChange();
  assert.equal(document.querySelectorAll("[data-linguapop-replacement]").length, 2);

  controller.dispose();
  window.close();
});

test("content settings ignore unrelated keys and non-local storage changes", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  const readsAfterInit = storage.reads;

  changes.emit({ learnedWords: { oldValue: 2, newValue: 3 } });
  changes.emit({ encounteredWords: { oldValue: {}, newValue: { "en-apple": {} } } });
  changes.emit({ enabled: { oldValue: true, newValue: false } }, "sync");
  await settleStorageChange();

  assert.equal(storage.reads, readsAfterInit);
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  controller.dispose();
  window.close();
});

test("a late initial settings read cannot override a newer storage change", async () => {
  const window = createPage();
  const changes = new FakeStorageChanges();
  const reads: Array<{ resolve: (value: Record<string, unknown>) => void }> = [];
  const storage = {
    get(defaults: Record<string, unknown>) {
      assert.equal(changes.listeners.size, 1, "register storage listener before reading settings");
      return new Promise<Record<string, unknown>>((resolve) => reads.push({ resolve: (value) => resolve({ ...defaults, ...value }) }));
    },
  };
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );

  changes.emit({ enabled: { oldValue: true, newValue: false } });
  reads[1].resolve({ enabled: false, replacementPercentage: 5 });
  await settleStorageChange();
  reads[0].resolve({ enabled: true, replacementPercentage: 5 });
  await controller.ready;

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  controller.dispose();
  window.close();
});

test("content settings restore replacements if local settings cannot be read", async () => {
  const window = createPage();
  applyWordReplacements(window.document.body, { percentage: 30 });
  const storage = { async get() { throw new Error("Storage is unavailable"); } };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );

  await controller.ready;
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(window.document.body.textContent?.match(/Apple/g)?.length, 20);
  controller.dispose();
  window.close();
});

test("one global state change updates every open page", async () => {
  const first = createPage();
  const second = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controllers = [first, second].map((window) =>
    startContentSettings(
      window.document.body,
      storage as unknown as SettingsStorage,
      changes as unknown as typeof chrome.storage.onChanged,
    ),
  );
  await Promise.all(controllers.map((controller) => controller.ready));

  assert.deepEqual(
    [first, second].map((window) => window.document.querySelectorAll("[data-linguapop-replacement]").length),
    [1, 1],
  );

  storage.values = { enabled: false };
  changes.emit({ enabled: { oldValue: true, newValue: false } });
  await settleStorageChange();

  assert.deepEqual(
    [first, second].map((window) => window.document.querySelectorAll("[data-linguapop-replacement]").length),
    [0, 0],
  );
  for (const controller of controllers) controller.dispose();
  first.close();
  second.close();
});

test("content settings honor a per-site disable and re-enable without duplicate replacements", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);

  storage.values = { enabled: true, replacementPercentage: 5, siteOverrides: { "example.test": false } };
  changes.emit({ siteOverrides: { oldValue: {}, newValue: { "example.test": false } } });
  await settleStorageChange();
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(window.document.body.textContent?.match(/Apple/g)?.length, 20);

  storage.values.siteOverrides = { "example.test": true };
  changes.emit({ siteOverrides: { oldValue: { "example.test": false }, newValue: { "example.test": true } } });
  await settleStorageChange();
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  assert.equal(window.document.body.textContent?.match(/Apple|Manzana/g)?.length, 20);

  controller.dispose();
  window.close();
});

test("global disable takes precedence over a site being enabled", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.values = { enabled: false, replacementPercentage: 30, siteOverrides: { "example.test": true } };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(window.document.body.textContent?.match(/Apple/g)?.length, 20);
  controller.dispose();
  window.close();
});

test("a site override for another hostname does not disable the current site", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.values = { enabled: true, replacementPercentage: 5, siteOverrides: { "other.test": false } };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  const readsAfterInit = storage.reads;
  storage.values.siteOverrides = { "other.test": false, "third.test": false };
  changes.emit({ siteOverrides: { oldValue: { "other.test": false }, newValue: { "other.test": false, "third.test": false } } });
  await settleStorageChange();
  assert.equal(storage.reads, readsAfterInit);
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  controller.dispose();
  window.close();
});

test("new eligible subtrees are processed without rescanning the page body", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const scannedRoots: Node[] = [];
  const createTreeWalker = window.document.createTreeWalker.bind(window.document);
  Object.defineProperty(window.document, "createTreeWalker", {
    configurable: true,
    value(root: Node, ...args: [number?, NodeFilter | NodeFilterInit?]) {
      scannedRoots.push(root);
      return createTreeWalker(root, ...args);
    },
  });
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  const bodyScansAfterInitial = scannedRoots.filter((root) => root === window.document.body).length;

  const added = window.document.createElement("section");
  added.innerHTML = `<p>${Array.from({ length: 20 }, () => "Apple").join(" ")}</p><button>${Array.from({ length: 20 }, () => "Apple").join(" ")}</button><span data-linguapop-ui>Apple</span>`;
  window.document.body.append(added);
  await settleStorageChange();

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 2);
  assert.equal(added.querySelectorAll("button [data-linguapop-replacement]").length, 0);
  assert.equal(added.querySelectorAll('[data-linguapop-ui] [data-linguapop-replacement]').length, 0);
  assert.equal(scannedRoots.filter((root) => root === window.document.body).length, bodyScansAfterInitial);
  assert.ok(scannedRoots.includes(added));

  controller.dispose();
  window.close();
});

test("directly added text nodes are processed once without observer loops", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const scannedRoots: Node[] = [];
  const createTreeWalker = window.document.createTreeWalker.bind(window.document);
  Object.defineProperty(window.document, "createTreeWalker", {
    configurable: true,
    value(root: Node, ...args: [number?, NodeFilter | NodeFilterInit?]) {
      scannedRoots.push(root);
      return createTreeWalker(root, ...args);
    },
  });
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  const paragraph = window.document.querySelector("p")!;
  const addedText = window.document.createTextNode(` ${Array.from({ length: 20 }, () => "Apple").join(" ")}`);
  paragraph.append(addedText);
  await settleStorageChange();
  await settleStorageChange();

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 2);
  assert.equal(scannedRoots.filter((root) => root === window.document.body).length, 1);

  controller.dispose();
  window.close();
});

test("disabled sites do not replace content added after the initial page load", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.values = { enabled: true, replacementPercentage: 5, siteOverrides: { "example.test": false } };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;

  const added = window.document.createElement("p");
  added.textContent = Array.from({ length: 20 }, () => "Apple").join(" ");
  window.document.body.append(added);
  await settleStorageChange();

  assert.equal(added.querySelectorAll("[data-linguapop-replacement]").length, 0);
  assert.equal(added.textContent?.match(/Apple/g)?.length, 20);
  controller.dispose();
  window.close();
});

test("content settings update replacements when the selected difficulty changes", async () => {
  const window = new Window({ url: "https://example.test/article" });
  window.document.body.innerHTML = `<p>${Array.from({ length: 20 }, () => "language").join(" ")}</p>`;
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 0);

  storage.values = { enabled: true, replacementPercentage: 5, difficulty: "intermediate" };
  changes.emit({ difficulty: { oldValue: "beginner", newValue: "intermediate" } });
  await settleStorageChange();
  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  assert.equal(window.document.querySelector("[data-linguapop-entry-id='en-language']")?.textContent, "idioma");

  controller.dispose();
  window.close();
});

test("content settings track only words actually replaced and update local encounter records", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  await settleStorageChange();

  const encounteredWords = storage.values.encounteredWords as Record<string, WordEncounter>;
  const firstEncounter = encounteredWords["en-apple"];
  assert.ok(firstEncounter);
  assert.equal(firstEncounter.encounterCount, 1);
  assert.ok(firstEncounter.firstSeenAt <= firstEncounter.lastSeenAt);

  const added = window.document.createElement("p");
  added.textContent = Array.from({ length: 20 }, () => "Apple").join(" ");
  window.document.body.append(added);
  await settleStorageChange();

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 2);
  const updatedEncounter = (storage.values.encounteredWords as Record<string, WordEncounter>)["en-apple"];
  assert.equal(updatedEncounter.firstSeenAt, firstEncounter.firstSeenAt);
  assert.equal(updatedEncounter.encounterCount, 2);

  controller.dispose();
  window.close();
});

test("content settings save only the sentence containing each encountered word", async () => {
  const window = createPage();
  const appleText = Array.from({ length: 20 }, () => "Apple.").join(" ");
  window.document.body.innerHTML = `<p>Before this. ${appleText} After this.</p>`;
  const storage = new FakeStorage();
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );

  await controller.ready;
  await settleStorageChange();

  const encounter = (storage.values.encounteredWords as Record<string, WordEncounter>)?.["en-apple"];
  assert.equal(encounter?.contextSentence, "Apple.");
  controller.dispose();
  window.close();
});

test("graduated words stop replacing and return to replacements when ungraduated", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.values.graduatedWords = { "en-apple": true };
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  await settleStorageChange();

  assert.equal(window.document.querySelectorAll("[data-linguapop-entry-id='en-apple']").length, 0);

  storage.values.graduatedWords = {};
  changes.emit({ graduatedWords: { oldValue: { "en-apple": true }, newValue: {} } });
  await settleStorageChange();

  assert.ok(window.document.querySelectorAll("[data-linguapop-entry-id='en-apple']").length > 0);
  controller.dispose();
  window.close();
});

test("selecting French reprocesses an open page and stores French-specific encounters", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.values.languagePairId = "en-es";
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );
  await controller.ready;
  assert.ok(window.document.querySelector('[data-linguapop-entry-id="en-apple"]'));

  storage.values.languagePairId = "en-fr";
  changes.emit({ languagePairId: { oldValue: "en-es", newValue: "en-fr" } });
  await settleStorageChange();
  await settleStorageChange();

  const replacement = window.document.querySelector('[data-linguapop-entry-id="en-fr-apple"]');
  assert.ok(replacement);
  assert.equal(replacement?.textContent, "Pomme");
  assert.ok(Object.hasOwn(storage.values.encounteredWords as Record<string, unknown>, "en-fr-apple"));
  assert.ok(Object.hasOwn(storage.values.encounteredWords as Record<string, unknown>, "en-apple"));
  controller.dispose();
  window.close();
});

test("progress storage errors do not prevent page replacements", async () => {
  const window = createPage();
  const storage = new FakeStorage();
  storage.failEncounterWrites = true;
  const changes = new FakeStorageChanges();
  const controller = startContentSettings(
    window.document.body,
    storage as unknown as SettingsStorage,
    changes as unknown as typeof chrome.storage.onChanged,
  );

  await controller.ready;
  await settleStorageChange();

  assert.equal(window.document.querySelectorAll("[data-linguapop-replacement]").length, 1);
  controller.dispose();
  window.close();
});
