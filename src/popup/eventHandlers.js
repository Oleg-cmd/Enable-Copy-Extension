// src/popup/eventHandlers.js

import { STATE, errorLog, log } from "../shared/utils.js";
// Import UI functions needed for optimistic updates or temporary states
import { showErrorState } from "./uiUpdater.js"; // Assuming UI functions are needed

/**
 * Sends a command message to the background script.
 * @param {string} commandAction - The action name for the message (e.g., 'commandEnableStandard').
 * @returns {Promise<object>} Promise resolving with the response from the background.
 */
async function sendCommand(commandAction) {
  log(`Sending command: ${commandAction}`);
  try {
    const response = await chrome.runtime.sendMessage({
      action: commandAction,
    });
    if (chrome.runtime.lastError) {
      // Handle runtime errors (e.g., background script not responding)
      throw new Error(
        `Runtime error sending ${commandAction}: ${chrome.runtime.lastError.message}`
      );
    }
    if (response && response.success === false) {
      // Handle logical errors reported by the background script
      throw new Error(
        response.error || `Command ${commandAction} failed in background.`
      );
    }
    log(`Command ${commandAction} successful. Response:`, response);
    return response; // Return the successful response
  } catch (error) {
    errorLog(`Error sending or processing command ${commandAction}:`, error);
    // Rethrow or handle the error as needed (e.g., show error in UI)
    throw error; // Rethrow to be caught by the calling handler
  }
}

/**
 * Handles clicks on the main toggle button.
 * This modifies the global 'extensionEnabled' state in storage.
 * The background storage listener is responsible for updating tab states.
 * @param {object} popupState - The current popup state object from popup.js.
 */
export function handleToggleClick(popupState) {
  log("Handler: Toggle button clicked.");
  const els = document.getElementById("toggleExtension"); // Get element directly for disabling
  if (!els || els.disabled) {
    log("Handler: Toggle button disabled or not found, ignoring.");
    return;
  }

  // Determine the NEW desired global state
  const newGlobalState = !popupState.isGloballyEnabled;
  log(`Handler: Setting global state to: ${newGlobalState}`);

  // Optional: Provide immediate visual feedback
  els.textContent = "Saving...";
  els.disabled = true;

  chrome.storage.local.set({ extensionEnabled: newGlobalState }, () => {
    if (chrome.runtime.lastError) {
      errorLog(
        "Handler: Error setting global state in storage:",
        chrome.runtime.lastError
      );
      showErrorState("Error saving setting."); // Update UI to show error
      // Re-enable button after a delay? Or rely on refresh?
      setTimeout(() => popupState.refreshStateAndUI(), 1500); // Refresh after error
    } else {
      log("Handler: Global state saved. Background listener will update tabs.");
      // Update local state cache immediately
      popupState.isGloballyEnabled = newGlobalState;
      // The background listener should handle updating the specific tab's state.
      // We *could* immediately query the new state, or just let the UI update naturally
      // when the popup closes/reopens or if we implement a state listener.
      // Let's just update the UI based on the new global state immediately.
      // The actual tab state might take a moment to update via background.
      log("Handler: Triggering UI update based on new global state.");
      popupState.refreshStateAndUI(); // Refresh state from background to get definitive status
    }
  });
}

/**
 * Handles clicks on the Force Mode button.
 * Sends 'commandEnableForce' or 'commandEnableStandard' based on the *current* tab state.
 * @param {object} popupState - The current popup state object.
 */
export async function handleForceClick(popupState) {
  log("Handler: Force button clicked.");
  const els = document.getElementById("forceEnable");
  if (!els || els.disabled) {
    log("Handler: Force button disabled or not found, ignoring.");
    return;
  }

  const currentState = popupState.currentTabState;
  const isCurrentlyForced = currentState === STATE.FORCE_ACTIVE;

  // Determine the command and expected state
  const command = isCurrentlyForced
    ? "commandEnableStandard"
    : "commandEnableForce";
  const expectedStateAfterCommand = isCurrentlyForced
    ? STATE.STANDARD_ACTIVE
    : STATE.FORCE_ACTIVE;

  // Provide immediate feedback
  els.textContent = "Processing...";
  els.disabled = true;

  try {
    const response = await sendCommand(command);

    // Command sent (maybe successfully processed by background, maybe blocked)
    // Update local state cache based on what the background *should* have set
    // Note: response might indicate success even if blocked (e.g., success:false, error:"blocked")
    if (response && response.stateSet) {
      // If background confirms the state it set
      popupState.currentTabState = response.stateSet;
    } else {
      // Assume the expected state if command didn't obviously fail network-wise
      // Background determined the actual state. Refresh to be sure.
      log(
        `Handler: Command ${command} sent, but definitive state confirmation missing. Assuming ${expectedStateAfterCommand} locally before refresh.`
      );
      popupState.currentTabState = expectedStateAfterCommand; // Optimistic update before refresh
    }
  } catch (error) {
    // Error occurred sending command or background reported failure
    errorLog(`Handler: Command ${command} failed:`, error);
    showErrorState(error.message || "Failed to apply mode."); // Show specific error if available
    // State likely didn't change, refresh will confirm
  } finally {
    // ALWAYS refresh state from background to get the authoritative status after the attempt
    log("Handler: Re-querying state after force command attempt.");
    // Re-enable button will happen inside refreshStateAndUI -> updateAllUI
    popupState.refreshStateAndUI();
  }
}

/**
 * Handles clicks on the "Disable on this site" button.
 * @param {object} popupState - The current popup state object.
 */
export function handleAddWhitelistClick(popupState) {
  log("Handler: Add to Whitelist clicked.");
  const els = document.getElementById("addToWhitelist");
  if (!els || els.disabled) {
    log("Handler: Add Whitelist button disabled or not found, ignoring.");
    return;
  }

  const hostname = popupState.currentHostname;
  if (!hostname) {
    errorLog("Handler: Cannot add to whitelist, hostname is missing.");
    return;
  }

  els.textContent = "Adding...";
  els.disabled = true;

  chrome.runtime.sendMessage(
    { action: "addToWhitelist", domain: hostname },
    (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        errorLog(
          "Handler: Error adding to whitelist:",
          chrome.runtime.lastError || response?.error
        );
        showErrorState("Error adding to whitelist.");
        // Re-enable? Refresh will handle UI update based on actual state.
        setTimeout(() => popupState.refreshStateAndUI(), 1500);
      } else {
        log(`Handler: Successfully requested add ${hostname} to whitelist.`);
        // Update local state immediately to reflect the expected outcome
        popupState.isWhitelisted = true;
        popupState.currentTabState = STATE.DISABLED; // Whitelisting forces disabled
        // Refresh UI immediately based on optimistic update
        log("Handler: Triggering UI update after whitelist add request.");
        popupState.updateUI(); // Update based on modified local state
        // Optional: could also trigger refreshStateAndUI after a short delay
        // to confirm background processing is complete.
      }
    }
  );
}

/**
 * Handles clicks on the "Settings button.
 */
export function handleSettingsClick() {
  log("Handler: Settings clicked.");
  try {
    chrome.runtime.openOptionsPage();
  } catch (error) {
    errorLog("Handler: Failed to open options page:", error);
    showErrorState("Could not open options page.");
  }
}

/**
 * Handles clicks on the "Start OCR" button.
 * @param {object} popupState - The current popup state object.
 */
export async function handleOCRClick(popupState) {
  log("Handler: Start OCR clicked.");
  const button = document.getElementById("startOCR");
  const statusEl = document.getElementById("ocrStatus");

  if (!button || button.disabled) {
    log("Handler: Extract button disabled or not found, ignoring.");
    return;
  }

  const tabId = popupState.currentTabId;
  if (!tabId) {
    errorLog("Handler: No tab ID available for extraction");
    if (statusEl) {
      statusEl.textContent = "Error: No active tab";
      statusEl.style.color = "red";
      statusEl.style.display = "block";
    }
    return;
  }

  // Provide immediate feedback
  button.textContent = "Extracting...";
  button.disabled = true;
  if (statusEl) {
    statusEl.textContent = "Processing...";
    statusEl.style.color = "#1a73e8";
    statusEl.style.display = "block";
  }

  try {
    // Send OCR selection command to content script
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "startOCRSelection",
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    if (response && response.success) {
      log("Handler: Google Docs extraction successful:", response);
      button.textContent = "✓ Copied!";
      if (statusEl) {
        statusEl.textContent =
          response.message || "Successfully copied to clipboard";
        statusEl.style.color = "#0f9d58"; // Green
      }

      // Reset button after 2 seconds
      setTimeout(() => {
        button.textContent = "Select Area & Extract Text";
        button.disabled = false;
        if (statusEl) {
          statusEl.style.display = "none";
        }
      }, 2000);
    } else {
      throw new Error(response?.message || "Extraction failed");
    }
  } catch (error) {
    errorLog("Handler: Google Docs extraction failed:", error);
    button.textContent = "✗ Failed";
    if (statusEl) {
      statusEl.textContent = error.message || "Extraction failed";
      statusEl.style.color = "red";
    }

    // Reset button after 3 seconds
    setTimeout(() => {
      button.textContent = "Select Area & Extract Text";
      button.disabled = false;
    }, 3000);
  }
}
