// src/popup/uiUpdater.js

import { STATE, log } from "../shared/utils.js";

// --- DOM Elements Cache (fetched once) ---
let elements = null;
function getElements() {
  if (!elements) {
    elements = {
      toggleButton: document.getElementById("toggleExtension"),
      forceButton: document.getElementById("forceEnable"),
      forceTooltip: document.getElementById("forceTooltip"),
      whitelistStatus: document.getElementById("whitelistStatus"),
      addToWhitelistButton: document.getElementById("addToWhitelist"),
      settingsButton: document.getElementById("settingsButton"),
      // Add any other elements you might need to update
    };
    // Basic check if elements exist
    if (
      !elements.toggleButton ||
      !elements.forceButton ||
      !elements.addToWhitelistButton
    ) {
      console.error("Popup UI elements not found! Check popup.html IDs.");
      // Prevent further errors by nullifying elements if essential ones are missing
      elements = null;
    }
  }
  return elements;
}

// --- Constants ---
const defaultForceButtonText = "Force Copy (Risky)";
const activatedForceButtonText = "Force Mode Active"; // Text when force mode is ON

/**
 * Updates the main toggle button's text and disabled state.
 * @param {boolean} isGloballyEnabled
 * @param {boolean} isWhitelisted
 * @param {boolean} isOperablePage - Is the page type where extension can work (http/https)
 */
function updateToggleButtonUI(
  isGloballyEnabled,
  isWhitelisted,
  isOperablePage
) {
  const els = getElements();
  if (!els?.toggleButton) return;

  els.toggleButton.disabled = !isOperablePage || isWhitelisted;

  if (!isOperablePage) {
    els.toggleButton.textContent = "Inactive on this page";
  } else if (isWhitelisted) {
    els.toggleButton.textContent = "Site Whitelisted";
  } else {
    els.toggleButton.textContent = isGloballyEnabled
      ? "Disable Extension"
      : "Enable Extension";
  }
  log(
    `UI: Toggle button updated. Disabled: ${els.toggleButton.disabled}, Text: ${els.toggleButton.textContent}`
  );
}

/**
 * Updates the Force button's text, disabled state, and tooltip visibility.
 * @param {string} currentTabState - The current state (STATE.DISABLED, STATE.STANDARD_ACTIVE, STATE.FORCE_ACTIVE)
 * @param {boolean} isGloballyEnabled
 * @param {boolean} isWhitelisted
 * @param {boolean} isOperablePage
 */
function updateForceButtonUI(
  currentTabState,
  isGloballyEnabled,
  isWhitelisted,
  isOperablePage
) {
  const els = getElements();
  if (!els?.forceButton || !els?.forceTooltip) return;

  const canUseForce = isOperablePage && isGloballyEnabled && !isWhitelisted;
  els.forceButton.disabled = !canUseForce;
  els.forceTooltip.style.display = canUseForce ? "block" : "none";

  if (!canUseForce) {
    els.forceButton.textContent = defaultForceButtonText; // Reset text if disabled
  } else {
    // Set text based on the actual current state for the tab
    els.forceButton.textContent =
      currentTabState === STATE.FORCE_ACTIVE
        ? activatedForceButtonText
        : defaultForceButtonText;
  }
  log(
    `UI: Force button updated. Disabled: ${els.forceButton.disabled}, Text: ${els.forceButton.textContent}`
  );
}

/**
 * Updates the whitelist status message and add/manage buttons.
 * @param {boolean} isWhitelisted
 * @param {string|null} hostname
 * @param {boolean} isGloballyEnabled
 * @param {boolean} isOperablePage
 */
function updateWhitelistUI(
  isWhitelisted,
  hostname,
  isGloballyEnabled,
  isOperablePage
) {
  const els = getElements();
  if (
    !els?.whitelistStatus ||
    !els?.addToWhitelistButton ||
    !els?.settingsButton
  )
    return;

  els.settingsButton.disabled = false; // Settings button is always enabled

  if (!isOperablePage) {
    els.whitelistStatus.textContent = "Extension inactive on this page.";
    els.whitelistStatus.style.display = "block";
    els.whitelistStatus.style.color = "#666"; // Neutral color
    els.addToWhitelistButton.disabled = true;
    els.addToWhitelistButton.textContent = "N/A";
  } else if (isWhitelisted) {
    els.whitelistStatus.textContent = `This site (${
      hostname || "Unknown"
    }) is whitelisted.`;
    els.whitelistStatus.style.display = "block";
    els.whitelistStatus.style.color = "#e65100"; // Warning color
    els.addToWhitelistButton.textContent = "Site Whitelisted";
    els.addToWhitelistButton.disabled = true;
  } else {
    els.whitelistStatus.style.display = "none";
    els.addToWhitelistButton.disabled = !isGloballyEnabled; // Can only disable if extension is enabled
    if (isGloballyEnabled) {
      els.addToWhitelistButton.textContent = hostname
        ? `Disable on ${hostname}`
        : "Disable on this site";
    } else {
      els.addToWhitelistButton.textContent = "Enable extension first";
    }
  }
  log(
    `UI: Whitelist section updated. Whitelisted: ${isWhitelisted}, Add button disabled: ${els.addToWhitelistButton.disabled}`
  );
}

/**
 * Sets a general loading state for the UI.
 */
export function showLoadingState() {
  const els = getElements();
  if (!els) return;
  els.toggleButton.textContent = "Loading...";
  els.toggleButton.disabled = true;
  els.forceButton.textContent = "Loading...";
  els.forceButton.disabled = true;
  els.addToWhitelistButton.textContent = "Loading...";
  els.addToWhitelistButton.disabled = true;
  els.whitelistStatus.style.display = "none";
  if (els.forceTooltip) els.forceTooltip.style.display = "none";
}

/**
 * Sets a general error state for the UI.
 * @param {string} message - Error message to display.
 */
export function showErrorState(message = "Error loading status.") {
  const els = getElements();
  if (!els) return;
  showLoadingState(); // Reset buttons to disabled/loading first
  els.toggleButton.textContent = "Error"; // Or keep loading?
  if (els.whitelistStatus) {
    els.whitelistStatus.textContent = message;
    els.whitelistStatus.style.display = "block";
    els.whitelistStatus.style.color = "red";
  }
  // Keep settings button enabled
  if (els.settingsButton) els.settingsButton.disabled = false;
}

/**
 * Updates all UI elements based on the current state provided.
 * This is the main function to call from popup.js after fetching state.
 * @param {object} state - The state object from popup.js containing all necessary info.
 * @param {string} state.currentTabState - Current effective state from background (STATE value)
 * @param {boolean} state.isGloballyEnabled - Is the extension globally enabled?
 * @param {boolean} state.isWhitelisted - Is the current site whitelisted?
 * @param {string|null} state.currentHostname - The hostname of the current site.
 * @param {boolean} state.isOperablePage - Can the extension run on this page type?
 * @param {string|null} state.currentTabUrl - The current tab URL
 */
export function updateAllUI(state) {
  log("Updating all UI elements with state:", state);
  // Ensure elements are fetched first
  const els = getElements();
  if (!els) {
    errorLog("Cannot update UI, elements not found.");
    return;
  }

  updateToggleButtonUI(
    state.isGloballyEnabled,
    state.isWhitelisted,
    state.isOperablePage
  );
  updateForceButtonUI(
    state.currentTabState,
    state.isGloballyEnabled,
    state.isWhitelisted,
    state.isOperablePage
  );
  updateWhitelistUI(
    state.isWhitelisted,
    state.currentHostname,
    state.isGloballyEnabled,
    state.isOperablePage
  );
}
