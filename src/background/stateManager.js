// src/background/stateManager.js

import { STATE, log, errorLog } from "../shared/utils.js";
import { checkUrlAgainstWhitelist } from "./whitelistManager.js";
import { updateBadge } from "./badgeManager.js";

let tabStates = {};

async function getGlobalEnabledState() {
  try {
    const result = await chrome.storage.local.get({ extensionEnabled: true });
    const isEnabled = result.extensionEnabled !== false;
    // --- Added detailed log ---
    log(
      `getGlobalEnabledState: Read storage result:`,
      result,
      ` Determined state: ${isEnabled}`
    );
    return isEnabled;
  } catch (error) {
    errorLog("Error reading global enabled state:", error);
    return true; // Assume enabled on error
  }
}

export async function determineEffectiveState(tabId, tabUrl, currentState) {
  // --- Added log ---
  log(
    `Determining effective state for tab ${tabId}. Current assumed state: ${currentState}, URL: ${tabUrl}`
  );

  let effectiveState = currentState;
  const isWhitelisted = await checkUrlAgainstWhitelist(tabUrl);
  if (isWhitelisted) {
    log(`Tab ${tabId} is whitelisted. Effective state: DISABLED.`);
    return STATE.DISABLED;
  }

  const isGloballyEnabled = await getGlobalEnabledState();
  if (!isGloballyEnabled) {
    log(
      `Extension globally disabled. Effective state for tab ${tabId}: DISABLED.`
    );
    return STATE.DISABLED;
  }

  // If globally enabled, but current state suggests disabled/unknown, move to standard active
  if (effectiveState === STATE.UNKNOWN || effectiveState === STATE.DISABLED) {
    log(
      `Tab ${tabId} state was ${effectiveState}, defaulting to STANDARD_ACTIVE.`
    );
    effectiveState = STATE.STANDARD_ACTIVE;
  }

  // Safeguard against invalid states
  if (!Object.values(STATE).includes(effectiveState)) {
    log(
      `Warning: Invalid state '${effectiveState}' resolved. Defaulting to STANDARD_ACTIVE.`
    );
    effectiveState = STATE.STANDARD_ACTIVE;
  }

  log(`Final effective state determined for tab ${tabId}: ${effectiveState}`);
  return effectiveState;
}

/**
 * Updates the stored state for a tab, updates its badge, and returns old/new states.
 * @param {number} tabId
 * @param {string | null | undefined} tabUrl
 * @param {string} newStateSource - The state suggested by the event/command.
 * @returns {Promise<{newState: string, oldState: string}>} - The final effective state and the previous state.
 */
export async function updateTabState(tabId, tabUrl, newStateSource) {
  if (typeof tabId !== "number") {
    return { newState: STATE.UNKNOWN, oldState: STATE.UNKNOWN }; // Return default if tabId invalid
  }

  const oldState = tabStates[tabId] || STATE.UNKNOWN; // Get state before update
  const effectiveState = await determineEffectiveState(
    tabId,
    tabUrl,
    newStateSource
  );

  if (oldState !== effectiveState) {
    tabStates[tabId] = effectiveState;
    log(
      `Stored state for tab ${tabId} changed from ${oldState} to: ${effectiveState}`
    );
    await updateBadge(tabId, effectiveState);
  } else {
    // log(`Effective state for tab ${tabId} remains: ${effectiveState}. No state change.`);
    // Still update badge in case it was out of sync
    await updateBadge(tabId, effectiveState);
  }
  return { newState: effectiveState, oldState: oldState }; // Return both states
}

export function getStoredTabState(tabId) {
  return tabStates[tabId] || STATE.UNKNOWN;
}

// Modify removeTabState to use dynamic import for clearBadge to ensure no circular deps
export function removeTabState(tabId) {
  if (tabStates.hasOwnProperty(tabId)) {
    log(`Removing state for closed tab ${tabId}`);
    delete tabStates[tabId];
    import("./badgeManager.js") // Dynamically import
      .then((badgeMgr) => badgeMgr.clearBadge(tabId))
      .catch((err) => errorLog("Error clearing badge on tab remove:", err));
  }
}

export async function getCurrentEffectiveStateForTab(tabId, tabUrl) {
  const storedState = getStoredTabState(tabId);
  const effectiveState = await determineEffectiveState(
    tabId,
    tabUrl,
    storedState
  );
  if (tabStates[tabId] !== effectiveState) {
    log(
      `Updating stored state for tab ${tabId} during query from ${tabStates[tabId]} to ${effectiveState}`
    );
    tabStates[tabId] = effectiveState;
    await updateBadge(tabId, effectiveState);
  }
  return effectiveState;
}
