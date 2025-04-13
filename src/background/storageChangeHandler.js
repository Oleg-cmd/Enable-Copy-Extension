// src/background/storageChangeHandler.js

import {
  STATE,
  log,
  errorLog,
  getRelevantHostname,
  isHostnameWhitelisted,
} from "../shared/utils.js";
import * as WhitelistManager from "./whitelistManager.js";
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
 * Handles the chrome.storage.onChanged event.
 * Reloads whitelist if needed, re-evaluates state for affected tabs,
 * and sends commands if the effective state changes.
 * @param {object} changes - Object describing the changes.
 * @param {string} areaName - The storage area ('local', 'sync', 'managed').
 */
export async function handleStorageChange(changes, areaName) {
  if (areaName !== "local") return; // Only listen to local storage changes

  // Log entry with detailed changes
  log(
    `*** handleStorageChange: START - Area=${areaName}, Changes=`,
    JSON.stringify(changes)
  );

  let needsTabReEvaluation = false;
  let reloadWhitelist = false;
  let changedDomain = null; // Track specific domain if possible

  // Check if relevant keys changed
  if (changes.whitelistDomains) {
    log("handleStorageChange: Whitelist domains changed.");
    reloadWhitelist = true;
    needsTabReEvaluation = true;
    // Simple diff to find added/removed (works for single changes)
    const oldValue = changes.whitelistDomains.oldValue || [];
    const newValue = changes.whitelistDomains.newValue || [];
    if (newValue.length > oldValue.length) {
      changedDomain = newValue.find((d) => !oldValue.includes(d));
      log(
        `handleStorageChange: Detected add to whitelist: ${
          changedDomain || "(Multiple changes?)"
        }`
      );
    } else if (newValue.length < oldValue.length) {
      changedDomain = oldValue.find((d) => !newValue.includes(d));
      log(
        `handleStorageChange: Detected remove from whitelist: ${
          changedDomain || "(Multiple changes?)"
        }`
      );
    }
  }
  if (changes.extensionEnabled) {
    log(
      `handleStorageChange: Global enabled state changed to ${changes.extensionEnabled.newValue}.`
    );
    needsTabReEvaluation = true;
  }

  // Exit if no relevant changes occurred
  if (!needsTabReEvaluation) {
    log("handleStorageChange: No relevant changes detected.");
    log(`*** handleStorageChange: END (No relevant changes).`);
    return;
  }

  // Reload whitelist cache if it changed BEFORE evaluating tabs
  if (reloadWhitelist) {
    log("handleStorageChange: Reloading whitelist cache...");
    await WhitelistManager.loadWhitelist();
  }

  log("handleStorageChange: Re-evaluating state for relevant tabs...");
  try {
    const allTabs = await chrome.tabs.query({}); // Check all tabs
    log(
      `handleStorageChange: Found ${allTabs.length} tabs to potentially evaluate.`
    );

    for (const tab of allTabs) {
      if (typeof tab.id !== "number" || !tab.url) {
        log(
          `handleStorageChange: Skipping tab ${tab.id || "N/A"} (no ID or URL).`
        );
        continue; // Skip invalid tabs
      }

      // --- Determine if this specific tab needs re-evaluation ---
      let shouldReEvaluate = false;
      if (changes.extensionEnabled) {
        shouldReEvaluate = true; // Global toggle change affects all tabs
        log(
          `handleStorageChange: Tab ${tab.id} needs re-evaluation due to global toggle change.`
        );
      } else if (changes.whitelistDomains) {
        // Whitelist changed - only re-evaluate http/https tabs
        if (tab.url.startsWith("http:") || tab.url.startsWith("https:")) {
          // More efficient: just re-evaluate all http/https tabs on any whitelist change
          // Trying to match changedDomain perfectly can be complex if multiple domains changed
          shouldReEvaluate = true;
          log(
            `handleStorageChange: Tab ${tab.id} (http/https) needs re-evaluation due to whitelist change.`
          );
        } else {
          log(
            `handleStorageChange: Skipping non-http tab ${tab.id} for whitelist change evaluation.`
          );
        }
      }
      // --- End determination ---

      if (shouldReEvaluate) {
        log(`handleStorageChange: Evaluating tab ${tab.id} (URL: ${tab.url})`);
        const oldState = StateManager.getStoredTabState(tab.id);
        log(
          `handleStorageChange: Tab ${tab.id} - State BEFORE updateTabState: ${oldState}`
        );

        // Update state/badge - this recalculates effective state based on new storage data
        const { newState } = await StateManager.updateTabState(
          tab.id,
          tab.url,
          oldState
        ); // Pass old state
        log(
          `handleStorageChange: Tab ${tab.id} - State AFTER updateTabState: ${newState}`
        );

        // Send command ONLY if the effective state for THIS tab actually changed
        if (newState !== oldState) {
          log(
            `handleStorageChange: Tab ${tab.id} - State CHANGED from ${oldState} to ${newState}. Preparing command...`
          );
          const commandToSend = getCommandForState(newState);
          if (commandToSend) {
            log(
              `handleStorageChange: Tab ${tab.id} - Sending command: ${commandToSend}`
            );
            // Don't await here - let commands go out without blocking loop for other tabs
            sendCommandToContent(tab.id, commandToSend);
          } else {
            log(
              `handleStorageChange: Tab ${tab.id} - State changed to ${newState}, but no command needed.`
            );
          }
        } else {
          log(
            `handleStorageChange: Tab ${tab.id} - Effective state remains ${newState}. No command needed.`
          );
        }
      } else {
        // log(`handleStorageChange: Skipping re-evaluation for tab ${tab.id}.`);
      }
    } // End for loop over tabs

    log("handleStorageChange: Finished re-evaluating tabs.");
  } catch (e) {
    errorLog("Error during tab update loop after storage change:", e);
  }
  log(`*** handleStorageChange: END.`); // Log exit
}
