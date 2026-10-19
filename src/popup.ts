import { readSettings, type SettingsStorage } from "./settings.ts";

export async function initializePopup(
  root: Document = document,
  storage: SettingsStorage = chrome.storage.local,
): Promise<void> {
  const toggle = root.querySelector<HTMLInputElement>("#enabled-toggle");
  const status = root.querySelector<HTMLElement>("#enabled-status");
  const error = root.querySelector<HTMLElement>("#settings-error");

  if (!toggle || !status || !error) throw new Error("LinguaPop popup controls are missing.");

  let currentEnabled = true;
  const updateStatus = (): void => {
    status.textContent = `LinguaPop is ${currentEnabled ? "on" : "off"}`;
  };

  toggle.disabled = true;
  status.textContent = "Loading setting…";
  error.hidden = true;

  try {
    const settings = await readSettings(storage);
    currentEnabled = settings.enabled;
    toggle.checked = currentEnabled;
    toggle.disabled = false;
    updateStatus();
  } catch {
    status.textContent = "LinguaPop settings could not be loaded.";
    error.textContent = "Check the extension and try again.";
    error.hidden = false;
    return;
  }

  toggle.addEventListener("change", () => {
    const requestedEnabled = toggle.checked;
    toggle.disabled = true;
    error.hidden = true;

    void storage
      .set({ enabled: requestedEnabled })
      .then(() => {
        currentEnabled = requestedEnabled;
        updateStatus();
      })
      .catch(() => {
        toggle.checked = currentEnabled;
        updateStatus();
        error.textContent = "Could not save the setting. Try again.";
        error.hidden = false;
      })
      .finally(() => {
        toggle.disabled = false;
      });
  });
}

if (typeof chrome !== "undefined" && chrome.storage) {
  void initializePopup();
}
