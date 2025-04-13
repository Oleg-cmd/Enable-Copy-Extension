// src/background/badgeManager.js

import { STATE, log, errorLog } from "../shared/utils.js";

const badgeConfigs = {
  [STATE.DISABLED]: { text: "OFF", color: "#808080" },
  [STATE.STANDARD_ACTIVE]: { text: "ON", color: "#4CAF50" },
  [STATE.FORCE_ACTIVE]: { text: "F", color: "#F44336" },
  [STATE.UNKNOWN]: { text: "", color: "#808080" }, // Default/fallback
};

/**
 * Updates the browser action badge text and color for a specific tab.
 * @param {number} tabId - The ID of the tab to update.
 * @param {string} state - The state value (e.g., STATE.DISABLED).
 */
export async function updateBadge(tabId, state) {
  if (typeof tabId !== "number") {
    errorLog("updateBadge called without a valid tabId.");
    return;
  }

  const config = badgeConfigs[state] || badgeConfigs[STATE.UNKNOWN];
  const badgeText = config.text;
  const badgeColor = config.color;

  try {
    // Check if the action API is available (it might not be in all contexts)
    if (chrome.action && typeof chrome.action.setBadgeText === "function") {
      await chrome.action.setBadgeText({ text: badgeText, tabId: tabId });
      await chrome.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tabId,
      });
      log(
        `Badge updated for tab ${tabId} to state: ${state} (Text: '${badgeText}')`
      );
    } else {
      log("chrome.action API not available, skipping badge update.");
    }
  } catch (error) {
    // Errors are expected if the tab is closed or on restricted pages (e.g., chrome:// URLs)
    // We usually don't need to log these unless debugging specific badge issues.
    // errorLog(`Failed to update badge for tab ${tabId}. Error: ${error.message}`);
  }
}

/**
 * Clears the badge for a specific tab.
 * @param {number} tabId
 */
export async function clearBadge(tabId) {
  if (typeof tabId !== "number") return;
  try {
    if (chrome.action && typeof chrome.action.setBadgeText === "function") {
      await chrome.action.setBadgeText({ text: "", tabId: tabId });
      log(`Badge cleared for tab ${tabId}`);
    }
  } catch (error) {
    // Ignore errors
  }
}
