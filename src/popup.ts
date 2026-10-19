import { isDifficulty, normalizeHostname, readSettings, type SettingsStorage } from "./settings.ts";
import { initializeReviewCard } from "./learning/review-card.ts";

interface ActiveTabProvider {
  query(queryInfo: { active: true; lastFocusedWindow: true }): Promise<Array<{ url?: string }>>;
}

export async function initializePopup(
  root: Document = document,
  storage: SettingsStorage = chrome.storage.local,
  tabs: ActiveTabProvider = chrome.tabs,
): Promise<void> {
  const toggle = root.querySelector<HTMLInputElement>("#enabled-toggle");
  const siteToggle = root.querySelector<HTMLInputElement>("#site-enabled-toggle");
  const siteHostnameLabel = root.querySelector<HTMLElement>("#site-hostname");
  const siteStatus = root.querySelector<HTMLElement>("#site-enabled-status");
  const difficulty = root.querySelector<HTMLSelectElement>("#vocabulary-difficulty");
  const percentage = root.querySelector<HTMLInputElement>("#replacement-percentage");
  const percentageValue = root.querySelector<HTMLOutputElement>("#replacement-percentage-value");
  const status = root.querySelector<HTMLElement>("#enabled-status");
  const error = root.querySelector<HTMLElement>("#settings-error");

  if (
    !toggle ||
    !siteToggle ||
    !siteHostnameLabel ||
    !siteStatus ||
    !difficulty ||
    !percentage ||
    !percentageValue ||
    !status ||
    !error
  ) {
    throw new Error("LinguaPop popup controls are missing.");
  }

  let currentEnabled = true;
  let savedPercentage = 5;
  let savedDifficulty: "beginner" | "intermediate" | "advanced" = "beginner";
  let currentSiteEnabled = true;
  let hostname: string | undefined;
  let siteAvailable = false;
  const renderPercentage = (): void => {
    percentageValue.value = `${percentage.value}%`;
    percentageValue.textContent = `${percentage.value}%`;
  };
  const updateStatus = (): void => {
    status.textContent = `LinguaPop is ${currentEnabled ? "on" : "off"}`;
    updateSiteStatus();
  };
  const updateSiteStatus = (): void => {
    if (!siteAvailable) return;
    siteStatus.textContent = currentEnabled
      ? `LinguaPop is ${currentSiteEnabled ? "on" : "off"} for this site.`
      : "Saved for this site; global LinguaPop is off.";
  };

  toggle.disabled = true;
  siteToggle.disabled = true;
  difficulty.disabled = true;
  percentage.disabled = true;
  status.textContent = "Loading setting…";
  siteStatus.textContent = "Loading site setting…";
  error.hidden = true;

  try {
    const settings = await readSettings(storage);
    currentEnabled = settings.enabled;
    savedPercentage = settings.replacementPercentage;
    savedDifficulty = settings.difficulty;
    toggle.checked = currentEnabled;
    percentage.value = String(savedPercentage);
    difficulty.value = savedDifficulty;
    renderPercentage();
    toggle.disabled = false;
    percentage.disabled = false;
    difficulty.disabled = false;
    updateStatus();

    try {
      const [activeTab] = await tabs.query({ active: true, lastFocusedWindow: true });
      const activeUrl = activeTab?.url ? new URL(activeTab.url) : undefined;
      if (activeUrl && (activeUrl.protocol === "http:" || activeUrl.protocol === "https:")) {
        hostname = normalizeHostname(activeUrl.hostname);
        if (hostname) {
          siteAvailable = true;
          siteHostnameLabel.textContent = hostname;
          currentSiteEnabled = settings.siteOverrides[hostname] !== false;
          siteToggle.checked = currentSiteEnabled;
          siteToggle.disabled = false;
          updateSiteStatus();
        }
      }
    } catch {
      // Keep the global controls usable when an active tab cannot be queried.
    }

    if (!siteAvailable) {
      siteStatus.textContent = "Per-site settings are unavailable on this page.";
    }
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

  siteToggle.addEventListener("change", () => {
    if (!hostname || !siteAvailable) return;

    const siteHostname = hostname;
    const requestedSiteEnabled = siteToggle.checked;
    siteToggle.disabled = true;
    siteStatus.textContent = "Saving site setting…";
    error.hidden = true;

    void readSettings(storage)
      .then((latestSettings) => {
        const siteOverrides = { ...latestSettings.siteOverrides, [siteHostname]: requestedSiteEnabled };
        return storage.set({ siteOverrides });
      })
      .then(() => {
        currentSiteEnabled = requestedSiteEnabled;
        updateSiteStatus();
      })
      .catch(() => {
        siteToggle.checked = currentSiteEnabled;
        siteStatus.textContent = "This site's setting could not be saved.";
        error.textContent = "Could not save the setting. Try again.";
        error.hidden = false;
      })
      .finally(() => {
        siteToggle.disabled = false;
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

  difficulty.addEventListener("change", () => {
    const requestedDifficulty = isDifficulty(difficulty.value) ? difficulty.value : savedDifficulty;
    difficulty.value = requestedDifficulty;
    difficulty.disabled = true;
    error.hidden = true;

    void storage
      .set({ difficulty: requestedDifficulty })
      .then(() => {
        savedDifficulty = requestedDifficulty;
      })
      .catch(() => {
        difficulty.value = savedDifficulty;
        error.textContent = "Could not save the setting. Try again.";
        error.hidden = false;
      })
      .finally(() => {
        difficulty.disabled = false;
      });
  });
}

if (typeof chrome !== "undefined" && chrome.storage && chrome.tabs) {
  void initializePopup(document, chrome.storage.local, chrome.tabs);
  void initializeReviewCard(document, chrome.storage.local);
}
