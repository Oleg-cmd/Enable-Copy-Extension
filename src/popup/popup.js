// src/popup/popup.js

import { STATE, log, errorLog, getRelevantHostname } from "../shared/utils.js";
import { updateAllUI, showLoadingState, showErrorState } from "./uiUpdater.js";
import {
  handleToggleClick,
  handleForceClick,
  handleAddWhitelistClick,
  handleManageWhitelistClick,
} from "./eventHandlers.js";

// --- Popup State Object ---
// Encapsulates the current knowledge the popup has about the system state.
// This state is refreshed from authoritative sources (background, storage).
const popupState = {
  currentTabId: null,
  currentTabUrl: null,
  currentHostname: null,
  isOperablePage: false, // Is it http/https?
  isWhitelisted: false, // Based on last check/update
  isGloballyEnabled: true, // Based on last check/update
  currentTabState: STATE.UNKNOWN, // Based on last check/update from background

  // Method to update the UI based on current state values
  updateUI: function () {
    updateAllUI(this); // Pass the whole state object to the UI updater
  },

  // Method to fetch state from background/storage and update UI
  refreshStateAndUI: async function () {
    log("Refreshing state and UI...");
    showLoadingState(); // Show loading indicators

    try {
      // 1. Get Tab Info
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        throw new Error("Could not get active tab information.");
      }
      this.currentTabId = tabs[0].id;
      this.currentTabUrl = tabs[0].url;
      this.currentHostname = getRelevantHostname(this.currentTabUrl);
      this.isOperablePage = !!(
        this.currentTabUrl &&
        (this.currentTabUrl.startsWith("http:") ||
          this.currentTabUrl.startsWith("https:"))
      );
      log(
        `Tab Info: ID=${this.currentTabId}, Host=${this.currentHostname}, Operable=${this.isOperablePage}`
      );

      // 2. Get Global Enabled State from Storage
      const storageData = await chrome.storage.local.get({
        extensionEnabled: true,
      });
      this.isGloballyEnabled = storageData.extensionEnabled !== false;
      log(`Global Enabled State: ${this.isGloballyEnabled}`);

      // 3. Query Background for Tab-Specific State (which considers whitelist & global state)
      const response = await chrome.runtime.sendMessage({
        action: "queryStateForPopup",
      });
      if (chrome.runtime.lastError)
        throw new Error(
          `Background query failed: ${chrome.runtime.lastError.message}`
        );
      if (!response || !response.success)
        throw new Error(
          response?.error || "Failed to query state from background."
        );

      this.currentTabState = response.state || STATE.UNKNOWN;
      // Determine whitelisted status based on the definitive state from background
      // If the background says disabled, and the page is operable, and global is enabled, it *must* be whitelisted (or error)
      // This syncs the 'isWhitelisted' flag with the background's effective state decision.
      this.isWhitelisted =
        this.isOperablePage &&
        this.isGloballyEnabled &&
        this.currentTabState === STATE.DISABLED;

      log(
        `Received Tab State: ${this.currentTabState}, Deduced Whitelisted: ${this.isWhitelisted}`
      );

      // 4. Update the UI with the refreshed state
      this.updateUI();
    } catch (error) {
      errorLog("Error during state refresh:", error);
      showErrorState(error.message); // Show error in the UI
      // Reset state variables to defaults on error?
      this.currentTabState = STATE.UNKNOWN;
      this.isWhitelisted = false;
      // Keep isGloballyEnabled as fetched if possible, else default
      this.isGloballyEnabled = this.isGloballyEnabled ?? true; // Keep if fetched, else default true
    }
  },

  // Setup event listeners
  attachListeners: function () {
    log("Attaching listeners...");
    const els = {
      // Get elements once for listeners
      toggleButton: document.getElementById("toggleExtension"),
      forceButton: document.getElementById("forceEnable"),
      addToWhitelistButton: document.getElementById("addToWhitelist"),
      manageWhitelistButton: document.getElementById("manageWhitelist"),
    };

    if (els.toggleButton) {
      els.toggleButton.addEventListener("click", () => handleToggleClick(this));
    } else {
      errorLog("Toggle button not found for listener.");
    }

    if (els.forceButton) {
      els.forceButton.addEventListener("click", () => handleForceClick(this));
    } else {
      errorLog("Force button not found for listener.");
    }

    if (els.addToWhitelistButton) {
      els.addToWhitelistButton.addEventListener("click", () =>
        handleAddWhitelistClick(this)
      );
    } else {
      errorLog("Add whitelist button not found for listener.");
    }

    if (els.manageWhitelistButton) {
      els.manageWhitelistButton.addEventListener(
        "click",
        handleManageWhitelistClick
      ); // Doesn't need state
    } else {
      errorLog("Manage whitelist button not found for listener.");
    }

    log("Listeners attached.");
  },
};

// --- Initialization ---
// Wait for the DOM to be fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
  log("Popup DOM loaded.");
  popupState.attachListeners(); // Setup button clicks
  popupState.refreshStateAndUI(); // Fetch initial state and render UI
});
