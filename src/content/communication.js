// src/content/communication.js

import { STATE, log, errorLog } from "../shared/utils.js";
// Import the functions that apply state changes
import {
  enableCopyingStandard,
  enableCopyingForce,
  disableCopying,
} from "./stateApplier.js";

// Need access to the whitelist status from the main content script
// Pass it during initialization or provide a getter function if state is managed centrally.
// For now, assume a global `isCurrentlyWhitelisted` exists or is passed to the listener setup.
// Let's pass it via a function reference setup during init.
let getWhitelistStatus = () => false; // Placeholder getter
let isInitComplete = () => false; // Placeholder getter

/**
 * Sends the content script's current state to the background.
 * @param {string} state - The state value (STATE.DISABLED, etc.)
 */
export function reportActualState(state) {
  if (!isInitComplete()) {
    // log("communication: Initialization not complete, skipping state report:", state);
    return;
  }
  if (getWhitelistStatus()) {
    log(
      `communication: Not reporting state ${state} because page is whitelisted.`
    );
    // Ensure features are off if whitelisted but trying to report active
    if (state !== STATE.DISABLED) {
      disableCopying();
    }
    return;
  }

  log(`communication: Reporting actual state to background: ${state}`);
  chrome.runtime
    .sendMessage({ action: "reportActualState", state: state })
    .catch((e) => errorLog("communication: Error reporting actual state:", e));
}

/**
 * Handles incoming messages from the background script.
 * @param {object} message - The message object { action: string, ... }
 * @param {chrome.runtime.MessageSender} sender
 * @param {function} sendResponse
 */
function messageListener(message, sender, sendResponse) {
  const isWhitelisted = getWhitelistStatus(); // Check current status

  if (isWhitelisted) {
    log(
      `communication: Message ${message.action} received, but page is whitelisted. Ignoring & ensuring disabled.`
    );
    disableCopying();
    sendResponse({ status: "Blocked by content script (whitelisted)" });
    return; // Stop processing
  }

  log(`communication: Received action: ${message.action}`);
  let status = "Action processed by content script";
  let appliedState = null;

  try {
    switch (message.action) {
      case "enableCopying": // Command for standard mode
        enableCopyingStandard(isWhitelisted); // Pass status just in case
        appliedState = STATE.STANDARD_ACTIVE;
        break;
      case "disableCopying": // Command to disable
        disableCopying();
        appliedState = STATE.DISABLED;
        break;
      case "forceEnableCopying": // Command for force mode
        enableCopyingForce(isWhitelisted); // Pass status just in case
        appliedState = STATE.FORCE_ACTIVE;
        break;
      default:
        errorLog("communication: Unknown action received:", message.action);
        status = "Unknown action";
    }
  } catch (e) {
    errorLog(`communication: Error applying action ${message.action}:`, e);
    status = `Error applying action: ${e.message}`;
    // Try to ensure disabled state on error? Could loop.
    // disableCopying();
    // appliedState = STATE.DISABLED;
  }

  sendResponse({ status: status, appliedState: appliedState });
}

/**
 * Sets up the message listener.
 * @param {function} whitelistStatusGetter - Function returning current whitelist status.
 * @param {function} initCompleteGetter - Function returning initialization status.
 */
export function setupCommunication(whitelistStatusGetter, initCompleteGetter) {
  log("communication: Setting up message listener.");
  getWhitelistStatus = whitelistStatusGetter;
  isInitComplete = initCompleteGetter;
  chrome.runtime.onMessage.addListener(messageListener);
}
