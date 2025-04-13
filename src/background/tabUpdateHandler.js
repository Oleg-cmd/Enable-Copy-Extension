// src/background/tabUpdateHandler.js

import { STATE, log, errorLog } from "../shared/utils.js";
import * as StateManager from "./stateManager.js";
import { sendCommandToContent } from "./commandSender.js";

/**
 * Determines the appropriate content script command based on the target state.
 * @param {string} targetState - The desired STATE value.
 * @returns {string|null} - The command action string or null.
 */
function getCommandForState(targetState) {
  // This function maps internal state to content script action strings
  switch (targetState) {
    case STATE.STANDARD_ACTIVE:
      return "enableCopying";
    case STATE.FORCE_ACTIVE:
      return "forceEnableCopying";
    case STATE.DISABLED:
      return "disableCopying";
    default:
      return null;
  }
}

/**
 * Handles the chrome.tabs.onActivated event.
 * Updates the badge based on the stored state for the activated tab.
 * @param {object} activeInfo - Event data containing tabId.
 */
export async function handleTabActivated(activeInfo) {
  const tabId = activeInfo.tabId;
  log(`*** handleTabActivated: START - Tab ${tabId} activated.`); // Log entry
  try {
    const tab = await chrome.tabs.get(tabId);
    const currentState = StateManager.getStoredTabState(tabId);
    log(
      `handleTabActivated: Tab ${tabId} - Stored state BEFORE update: ${currentState}`
    );
    // Update state (which recalculates effective state & updates badge)
    const { newState } = await StateManager.updateTabState(
      tabId,
      tab.url,
      currentState
    );
    log(
      `handleTabActivated: Tab ${tabId} - Effective state AFTER update: ${newState}. Badge updated.`
    );
    // Generally, no command is sent purely on activation; we rely on the content script
    // initializing and reporting its state, or the next tab update.
  } catch (error) {
    // Log errors if getting tab info fails (e.g., tab closed quickly)
    errorLog(`Error handling tab activation for tab ${tabId}:`, error);
    StateManager.removeTabState(tabId); // Clean up state if tab is likely gone
  }
  log(`*** handleTabActivated: END - Tab ${tabId}.`); // Log exit
}

/**
 * Handles the chrome.tabs.onUpdated event.
 * Evaluates state changes and sends commands when a tab finishes loading or URL changes.
 * @param {number} tabId
 * @param {object} changeInfo - Information about what changed (e.g., status, url).
 * @param {object} tab - The updated tab object.
 */
export async function handleTabUpdated(tabId, changeInfo, tab) {
  // Log entry with detailed changeInfo
  log(
    `*** handleTabUpdated: START - Tab ${tabId}, Changes: ${JSON.stringify(
      changeInfo
    )}, Tab Status: ${tab.status}, URL: ${tab.url}`
  );

  // --- Determine if we need to act based on the change ---
  // Act if:
  // 1. Tab finished loading completely.
  // 2. URL changed significantly while the tab was already complete (less common).
  // We ignore transient 'loading' states without URL change, favicon/title changes etc.
  const isComplete = changeInfo.status === "complete";
  const urlChanged = !!changeInfo.url; // Was the URL part of this specific update event?
  const isRelevantStatus = tab.status === "complete"; // Is the tab currently considered complete?

  // Condition to proceed: finish loading OR URL changed on an already complete tab
  const shouldAct = isComplete || (urlChanged && isRelevantStatus);

  if (!shouldAct) {
    log(
      `handleTabUpdated: Skipping action for Tab ${tabId} - Conditions not met (isComplete=${isComplete}, urlChanged=${urlChanged}, isRelevantStatus=${isRelevantStatus}).`
    );
    log(`*** handleTabUpdated: END - Tab ${tabId} (Skipped).`);
    return; // Exit early
  }

  // --- Handle http/https pages ---
  if (
    tab.url &&
    (tab.url.startsWith("http:") || tab.url.startsWith("https:"))
  ) {
    log(`handleTabUpdated: Evaluating http/https tab ${tabId}.`);

    const oldState = StateManager.getStoredTabState(tabId);
    log(
      `handleTabUpdated: Tab ${tabId} - State BEFORE updateTabState: ${oldState}`
    );

    // Update state/badge based on potentially new URL and existing knowledge
    const { newState } = await StateManager.updateTabState(
      tabId,
      tab.url,
      oldState
    );
    log(
      `handleTabUpdated: Tab ${tabId} - State AFTER updateTabState: ${newState}`
    );

    // Send command ONLY if the tab just completed loading OR the effective state changed
    if (isComplete || newState !== oldState) {
      const commandToSend = getCommandForState(newState);
      if (commandToSend) {
        log(
          `handleTabUpdated: Tab ${tabId} - State is ${newState} (was ${oldState}) and conditions met (isComplete=${isComplete}). Sending command: ${commandToSend}`
        );
        await sendCommandToContent(tabId, commandToSend);
      } else {
        log(
          `handleTabUpdated: Tab ${tabId} - State is ${newState}. No command needed.`
        );
      }
    } else {
      log(
        `handleTabUpdated: Tab ${tabId} - State ${newState} did not change effectively and tab didn't just complete loading. No command sent.`
      );
    }
  }
  // --- Handle non-http pages finishing load ---
  else if (isComplete) {
    // Only act on 'complete' for non-http pages
    log(
      `handleTabUpdated: Tab ${tabId} (non-http/https URL: ${tab.url}) finished loading. Ensuring state is DISABLED.`
    );
    // Force disabled state and badge update for non-web pages
    await StateManager.updateTabState(tabId, tab.url, STATE.DISABLED);
  } else {
    log(
      `handleTabUpdated: Skipping action for Tab ${tabId} - Non-http/https and did not complete loading in this event.`
    );
  }
  log(`*** handleTabUpdated: END - Tab ${tabId}.`); // Log exit
}
