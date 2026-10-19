import { readSettings, type SettingsStorage } from "./settings.ts";

export async function initializePopup(
  root: Document = document,
  storage: SettingsStorage = chrome.storage.local,
): Promise<void> {
  const toggle = root.querySelector<HTMLInputElement>("#enabled-toggle");
  const percentage = root.querySelector<HTMLInputElement>("#replacement-percentage");
  const percentageValue = root.querySelector<HTMLOutputElement>("#replacement-percentage-value");
  const status = root.querySelector<HTMLElement>("#enabled-status");
  const error = root.querySelector<HTMLElement>("#settings-error");

  if (!toggle || !percentage || !percentageValue || !status || !error) {
    throw new Error("LinguaPop popup controls are missing.");
  }

  let currentEnabled = true;
  let savedPercentage = 5;
  const renderPercentage = (): void => {
    percentageValue.value = `${percentage.value}%`;
    percentageValue.textContent = `${percentage.value}%`;
  };
  const updateStatus = (): void => {
    status.textContent = `LinguaPop is ${currentEnabled ? "on" : "off"}`;
  };

  toggle.disabled = true;
  percentage.disabled = true;
  status.textContent = "Loading setting…";
  error.hidden = true;

  try {
    const settings = await readSettings(storage);
    currentEnabled = settings.enabled;
    savedPercentage = settings.replacementPercentage;
    toggle.checked = currentEnabled;
    percentage.value = String(savedPercentage);
    renderPercentage();
    toggle.disabled = false;
    percentage.disabled = false;
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

  percentage.addEventListener("input", renderPercentage);
  percentage.addEventListener("change", () => {
    const requestedPercentage = Math.min(30, Math.max(0, Math.round(Number(percentage.value))));
    percentage.value = String(requestedPercentage);
    renderPercentage();
    percentage.disabled = true;
    error.hidden = true;

    void storage
      .set({ replacementPercentage: requestedPercentage })
      .then(() => {
        savedPercentage = requestedPercentage;
      })
      .catch(() => {
        percentage.value = String(savedPercentage);
        renderPercentage();
        error.textContent = "Could not save the setting. Try again.";
        error.hidden = false;
      })
      .finally(() => {
        percentage.disabled = false;
      });
  });
}

if (typeof chrome !== "undefined" && chrome.storage) {
  void initializePopup();
}
