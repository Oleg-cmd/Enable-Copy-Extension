// src/background/main.js

import { log, errorLog } from "../shared/utils.js";
import * as WhitelistManager from "./whitelistManager.js";
import * as StateManager from "./stateManager.js";
import { handleMessage } from "./messageHandler.js";
import { handleTabActivated, handleTabUpdated } from "./tabUpdateHandler.js";
import { handleStorageChange } from "./storageChangeHandler.js";

log("Background script starting...");

// --- Setup Listeners ---

// Listen for messages from popup, content scripts, options page
chrome.runtime.onMessage.addListener(handleMessage);

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(handleTabActivated);

// Listen for tab URL changes or completion
chrome.tabs.onUpdated.addListener(handleTabUpdated);

// Listen for tab closures
chrome.tabs.onRemoved.addListener(StateManager.removeTabState); // Directly call state manager cleanup

// Listen for storage changes (global toggle, whitelist)
chrome.storage.onChanged.addListener(handleStorageChange);

// Listen for installation/update events
chrome.runtime.onInstalled.addListener(async (details) => {
  log(`Extension event: ${details.reason}`);
  if (details.reason === "install") {
    // Set defaults on first install
    try {
      await chrome.storage.local.set({
        extensionEnabled: true,
        whitelistDomains: [],
      });
      log("Default settings applied on install.");
    } catch (e) {
      errorLog("Failed to set defaults on install:", e);
    }
  }
  // Always load whitelist on startup/install/update
  await WhitelistManager.loadWhitelist();
  log("Background script initialized/re-initialized.");
});

// --- Initial Load ---
// Load whitelist immediately when the background script starts
(async () => {
  await WhitelistManager.loadWhitelist();
  log("Initial whitelist load complete.");
  // Optionally: Evaluate state for all existing tabs on startup?
  // try {
  //     const allTabs = await chrome.tabs.query({});
  //     for (const tab of allTabs) {
  //         if(tab.id && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
  //              const currentState = StateManager.getStoredTabState(tab.id);
  //              await StateManager.updateTabState(tab.id, tab.url, currentState);
  //              // Maybe send command if needed? Handled by updateTabState logic now? Check tabUpdateHandler
  //         }
  //     }
  //      log("Initial state evaluation for existing tabs complete.");
  // } catch (e) {
  //      errorLog("Error during initial state evaluation:", e);
  // }
})();
