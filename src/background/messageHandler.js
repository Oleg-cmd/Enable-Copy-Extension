// src/background/messageHandler.js

import { STATE, errorLog, log } from "../shared/utils.js";
import { sendCommandToContent } from "./commandSender.js"; // Use the dedicated sender
import { performOCR } from "./ocrManager.js";
import * as StateManager from "./stateManager.js";
import * as WhitelistManager from "./whitelistManager.js";

// --- Specific Handlers ---

async function handleQueryState(sender) {
  // (Keep this function as is)
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].id) {
    const activeTabId = tabs[0].id;
    const activeTabUrl = tabs[0].url;
    const effectiveState = await StateManager.getCurrentEffectiveStateForTab(
      activeTabId,
      activeTabUrl
    );
    log(
      `Message Handler: Sending state to popup for tab ${activeTabId}: ${effectiveState}`
    );
    return { success: true, state: effectiveState };
  } else {
    throw new Error("Could not get active tab.");
  }
}

async function handleReportState(message, sender) {
  // (Keep this function as is)
  const tabId = sender.tab?.id;
  const tabUrl = sender.tab?.url;
  if (typeof tabId !== "number") {
    throw new Error("State report received without valid tab ID.");
  }
  log(
    `Message Handler: Received state report from tab ${tabId}: ${message.state}`
  );
  await StateManager.updateTabState(tabId, tabUrl, message.state);
  return { status: "State report processed." };
}

async function handlePopupCommand(message, sender) {
  // --- This function handles commands triggered DIRECTLY by popup interaction ---
  let targetState = null;
  let commandToSendToContent = null;

  switch (message.action) {
    case "commandEnableStandard":
      targetState = STATE.STANDARD_ACTIVE;
      commandToSendToContent = "enableCopying";
      break;
    case "commandEnableForce":
      targetState = STATE.FORCE_ACTIVE;
      commandToSendToContent = "forceEnableCopying";
      break;
    default:
      throw new Error(`Unknown popup command action: ${message.action}`);
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].id) {
    const activeTabId = tabs[0].id;
    const activeTabUrl = tabs[0].url;

    log(
      `Message Handler: Processing command ${message.action} for tab ${activeTabId}.`
    );

    // Determine if the intended state is allowed BEFORE trying to apply it
    const potentialEffectiveState = await StateManager.determineEffectiveState(
      activeTabId,
      activeTabUrl,
      targetState
    );

    if (potentialEffectiveState === targetState) {
      // Command is allowed (not blocked by global/whitelist)
      log(
        `Message Handler: Command ${message.action} allowed. Target state: ${targetState}`
      );

      // Optimistically update state/badge
      await StateManager.updateTabState(activeTabId, activeTabUrl, targetState);

      // --- Attempt to send command and handle response/error ---
      let commandError = null;
      let contentScriptResponse = null;
      try {
        // Send the command using the dedicated function
        contentScriptResponse = await sendCommandToContent(
          activeTabId,
          commandToSendToContent
        );

        // Check for logical errors reported back from content script (if response format includes it)
        // Example check (adapt if your content script response is different):
        if (
          contentScriptResponse &&
          contentScriptResponse.status?.toLowerCase().includes("error")
        ) {
          throw new Error(contentScriptResponse.status);
        }
        // Handle case where content script is unreachable (sendCommandToContent returns null)
        if (contentScriptResponse === null) {
          // This can happen if the tab was closed, navigating, or a restricted page
          throw new Error("Content script did not respond.");
        }
      } catch (e) {
        commandError = e; // Catch errors during send OR errors reported back
      }
      // --- End command attempt ---

      // --- Respond based on outcome ---
      if (!commandError) {
        log(
          `Message Handler: Command ${commandToSendToContent} executed successfully (as reported by content script).`
        );
        // Command sent and content script didn't report immediate critical error
        return { success: true, stateSet: targetState }; // Report the state we intended to set
      } else {
        // An error occurred during sending or execution
        errorLog(
          `Message Handler: Command ${commandToSendToContent} failed for tab ${activeTabId}. Error:`,
          commandError
        );

        // Since the command failed, the optimistic state update might be wrong.
        // Re-determine the ACTUAL current state.
        const actualState = await StateManager.getCurrentEffectiveStateForTab(
          activeTabId,
          activeTabUrl
        );
        errorLog(
          `Message Handler: Re-queried state after command failure: ${actualState}`
        );

        // Correct the stored state and badge if they don't match the actual state after failure
        await StateManager.updateTabState(
          activeTabId,
          activeTabUrl,
          actualState
        );

        // Respond indicating failure and the actual current state
        return {
          success: false,
          error: `Command execution failed: ${
            commandError.message || "Unknown content script error"
          }`,
          stateActual: actualState, // Inform the popup about the real state
        };
      }
    } else {
      // Command was blocked by global/whitelist determination
      log(
        `Message Handler: Command ${message.action} blocked for tab ${activeTabId}. Effective state remains: ${potentialEffectiveState}`
      );
      // Ensure state/badge reflect the blocking reason (updateTabState handles this)
      await StateManager.updateTabState(
        activeTabId,
        activeTabUrl,
        potentialEffectiveState
      );
      return {
        success: false,
        error: `Action blocked (Effective state: ${potentialEffectiveState})`,
        stateActual: potentialEffectiveState,
      };
    }
  } else {
    throw new Error("No active tab found for command.");
  }
}

async function handleWhitelistAction(message, sender) {
  // (Keep this function as is)
  switch (message.action) {
    case "getWhitelist":
      const list = await WhitelistManager.getWhitelist();
      return { success: true, whitelist: list };
    case "addToWhitelist":
      // Logic to update tabs moved to storageChangeHandler
      return await WhitelistManager.addDomainToWhitelist(message.domain);
    case "removeFromWhitelist":
      // Logic to update tabs moved to storageChangeHandler
      return await WhitelistManager.removeDomainFromWhitelist(message.domain);
    default:
      throw new Error(`Unknown whitelist action: ${message.action}`);
  }
}

/**
 * Main handler for chrome.runtime.onMessage.
 * Routes messages to specific handlers based on action.
 */
export function handleMessage(message, sender, sendResponse) {
  // (Keep the main routing logic as is)
  (async () => {
    const action = message.action;
    log(`Message Handler: Routing action: ${action}`); // Added log here
    try {
      let response;
      // Route based on action prefix or specific name
      if (action === "captureVisibleTab") {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length === 0) {
            throw new Error("No active tab found");
          }
          log(`Message Handler: Capturing tab ${tabs[0].id} in window ${tabs[0].windowId}`);
          const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: "png" });
          log(`Message Handler: Captured ${dataUrl ? dataUrl.length : 0} bytes`);
          if (!dataUrl) {
            throw new Error("captureVisibleTab returned empty data");
          }
          response = { success: true, dataUrl };
        } catch (captureErr) {
          const msg = captureErr?.message || String(captureErr) || "Screenshot capture failed";
          errorLog(`Capture Action Failed: ${msg}`);
          response = { success: false, error: msg };
        }
      } else if (action === "performBackgroundOCR") {
        try {
          const extractedText = await performOCR(message.image);
          response = { success: true, text: extractedText };
        } catch (ocrErr) {
          const msg = ocrErr?.message || String(ocrErr) || "Internal OCR Error";
          errorLog(`OCR Action Failed: ${msg}`);
          response = { success: false, error: msg };
        }
      } else if (action === "queryStateForPopup") {
        response = await handleQueryState(sender);
      } else if (action === "reportActualState") {
        response = await handleReportState(message, sender);
      } else if (action.startsWith("command")) {
        // Handles commandEnableStandard, commandEnableForce
        response = await handlePopupCommand(message, sender);
      } else if (action.includes("Whitelist")) {
        // Handles getWhitelist, addToWhitelist, removeFromWhitelist
        response = await handleWhitelistAction(message, sender);
      } else {
        throw new Error(`Unknown action type: ${action}`);
      }
      sendResponse(response);
    } catch (error) {
      errorLog(`Error processing action ${action}:`, error);
      sendResponse({
        success: false,
        error: error?.message || String(error) || "Internal background error",
      });
    }
  })();
  return true;
}
