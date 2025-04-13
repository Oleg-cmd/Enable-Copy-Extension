// src/background/commandSender.js

import { log, errorLog } from "../shared/utils.js";

/**
 * Sends a specific command action to a content script in a given tab.
 * @param {number} tabId - The ID of the target tab.
 * @param {string} commandAction - The action string to send (e.g., 'enableCopying').
 * @returns {Promise<object|null>} - Resolves with the response from the content script, or null on error.
 */
export async function sendCommandToContent(tabId, commandAction) {
  if (typeof tabId !== "number" || !commandAction) {
    errorLog("sendCommandToContent: Invalid arguments.", {
      tabId,
      commandAction,
    });
    return null;
  }

  log(`Sending command '${commandAction}' to tab ${tabId}`);
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: commandAction,
    });
    log(`Response from tab ${tabId} for '${commandAction}':`, response);
    return response;
  } catch (error) {
    // Errors are expected if the content script isn't ready, the tab is closed,
    // or it's a restricted page (like chrome://). We usually don't need to spam logs for these.
    // Log only if it's potentially unexpected.
    if (
      !error.message.includes("Receiving end does not exist") &&
      !error.message.includes("Could not establish connection")
    ) {
      errorLog(
        `Error sending command '${commandAction}' to tab ${tabId}:`,
        error
      );
    } else {
      // log(`Tab ${tabId} not reachable for command '${commandAction}'.`); // Optional debug log
    }
    return null; // Indicate failure to send/receive
  }
}
