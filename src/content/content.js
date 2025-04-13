// src/content/content.js

import {
  STATE,
  log,
  errorLog,
  getRelevantHostname,
  isHostnameWhitelisted,
} from "../shared/utils.js";
import { setupCommunication, reportActualState } from "./communication.js";
import { disableCopying } from "./stateApplier.js"; // Only need disable for initial state/whitelist

// --- Global State ---
let isCurrentlyWhitelisted = false;
let initializationComplete = false;

// --- Whitelist Check ---
async function checkInitialWhitelist() {
  try {
    const data = await chrome.storage.local.get({ whitelistDomains: [] });
    const whitelist = data.whitelistDomains || [];
    const hostname = getRelevantHostname(window.location.hostname);
    isCurrentlyWhitelisted = isHostnameWhitelisted(hostname, whitelist);
    log(
      `Main: Initial whitelist check complete. Whitelisted: ${isCurrentlyWhitelisted}`
    );
  } catch (e) {
    errorLog("Main: Failed to check initial whitelist status:", e);
    isCurrentlyWhitelisted = false;
  }
}

// --- Storage Listener ---
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      changes.whitelistDomains &&
      initializationComplete
    ) {
      log("Main: Storage - Whitelist changed, re-checking...");
      const whitelist = changes.whitelistDomains.newValue || [];
      const hostname = getRelevantHostname(window.location.hostname);
      const wasWhitelisted = isCurrentlyWhitelisted;
      isCurrentlyWhitelisted = isHostnameWhitelisted(hostname, whitelist);

      if (isCurrentlyWhitelisted && !wasWhitelisted) {
        log(
          "Main: Storage - Page became whitelisted dynamically. Disabling features."
        );
        disableCopying(); // Ensure disabled (will also report state)
      } else if (!isCurrentlyWhitelisted && wasWhitelisted) {
        log(
          "Main: Storage - Page removed from whitelist. Reporting disabled for re-evaluation."
        );
        // Report disabled state. Background should handle sending enable command.
        reportActualState(STATE.DISABLED);
      }
    }
    // Handle global enable toggle changes? Usually background handles this.
    // if (areaName === 'local' && changes.extensionEnabled && initializationComplete) { ... }
  });
}

// --- Initialization ---
async function initialize() {
  log("Main: Content script initializing...");

  await checkInitialWhitelist();

  // Setup communication listener, passing getters for current state
  setupCommunication(
    () => isCurrentlyWhitelisted, // Getter for whitelist status
    () => initializationComplete // Getter for init status
  );

  if (isCurrentlyWhitelisted) {
    log("Main: Page is whitelisted. Content script inactive.");
    disableCopying(); // Ensure clean state
    initializationComplete = true;
    return; // Stop
  }

  log("Main: Content script active (not whitelisted).");
  initializationComplete = true;

  // Setup listener for dynamic changes AFTER initial check and setupCommunication
  setupStorageListener();

  // Report initial 'disabled' state to background for evaluation
  reportActualState(STATE.DISABLED);

  log("Main: Content script initialization complete.");
}

// --- Start Execution ---
initialize();
