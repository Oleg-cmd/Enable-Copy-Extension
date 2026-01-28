// src/content/communication.js

import { STATE, errorLog, log } from "../shared/utils.js";
// Import the functions that apply state changes
import {
  disableCopying,
  enableCopyingForce,
  enableCopyingStandard,
} from "./stateApplier.js";
// Import OCR selector
import { selectAreaAndExtractText } from "./ocrSelector.js";

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
  // Handle OCR area selection (works regardless of whitelist status)
  if (message.action === "startOCRSelection") {
    log(
      "communication: Received startOCRSelection command",
      message.counter || 0
    );
    selectAreaAndExtractText()
      .then(async (text) => {
        if (text) {
          log(`communication: OCR extracted ${text.length} characters`);
          log(`communication: Text content: "${text.substring(0, 100)}..."`);

          // Try to copy to clipboard using fallback method
          let copySuccess = false;
          try {
            // Modern API - may fail due to user activation
            await navigator.clipboard.writeText(text);
            copySuccess = true;
            log("communication: Successfully copied to clipboard (modern API)");
          } catch (modernError) {
            log(
              "communication: Modern clipboard API failed, trying fallback method"
            );
            // Fallback: create temporary textarea
            try {
              const textarea = document.createElement("textarea");
              textarea.value = text;
              // Делаем элемент невидимым, но оставляем в DOM
              textarea.style.position = "fixed";
              textarea.style.opacity = "0";
              document.body.appendChild(textarea);
              textarea.focus(); // Важно добавить фокус
              textarea.select();
              const successful = document.execCommand("copy");
              document.body.removeChild(textarea);
              copySuccess = successful;
            } catch (fallbackError) {
              errorLog("Fallback clipboard failed", fallbackError);
            }
          }

          sendResponse({
            success: copySuccess,
            message: copySuccess
              ? `Successfully copied ${text.length} characters`
              : `Extracted ${text.length} characters, but failed to copy. Please use Ctrl+V or paste manually.`,
            textLength: text.length,
            text: text,
          });
        } else {
          log("communication: OCR returned empty text");
          sendResponse({
            success: false,
            message: "OCR cancelled or failed",
          });
        }
      })
      .catch((error) => {
        errorLog("communication: Error in OCR selection:", error);
        sendResponse({
          success: false,
          message: `Error: ${error.message}`,
        });
      });
    return true; // Keep message channel open for async response
  }

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
