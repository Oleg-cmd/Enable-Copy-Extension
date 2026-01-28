// src/content/forceModeManager.js

import { errorLog, log } from "../shared/utils.js";

// --- State for addEventListener override ---
let storedOriginalAddEventListener = null; // Stores the reference *to be called* by the override
let isAddEventListenerOverridden = false; // Flag indicating our override is *intended* to be active

// Events whose listeners we want to block page scripts from adding in Force Mode
const blockedEvents = [
  "copy",
  "cut",
  "contextmenu",
  "selectstart",
  "mousedown",
  "keydown",
];

/**
 * Overrides the native EventTarget.prototype.addEventListener to block
 * certain event listeners when Force Mode is active.
 * WARNING: This is invasive. Its effects on the prototype might persist
 * until the page is reloaded, even after calling resetForceOverrideState.
 */
export function overrideAddEventListener() {
  // Prevent re-applying if the flag is already set
  if (isAddEventListenerOverridden) {
    log(
      "forceModeManager: overrideAddEventListener - Already flagged as overridden, skipping apply."
    );
    return;
  }
  // Check if the target is a function before proceeding
  if (typeof EventTarget.prototype.addEventListener !== "function") {
    errorLog(
      "forceModeManager: Cannot override, EventTarget.prototype.addEventListener is not a function."
    );
    return;
  }

  log(">>> forceModeManager: Applying addEventListener override.");
  try {
    // Store the *current* prototype method just for calling it from our override.
    // Do this every time override is called, in case it was modified elsewhere.
    storedOriginalAddEventListener = EventTarget.prototype.addEventListener;

    // Log descriptor info for debugging (optional)
    try {
      const descriptor = Object.getOwnPropertyDescriptor(
        EventTarget.prototype,
        "addEventListener"
      );
      log("forceModeManager: Descriptor BEFORE override attempt:", descriptor);
      if (descriptor && (!descriptor.configurable || !descriptor.writable)) {
        log(
          "forceModeManager: Warning - addEventListener descriptor suggests it might not be writable/configurable. Override might not be removable."
        );
      }
    } catch (descError) {
      /* ignore descriptor logging error */
    }

    // The actual override function
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options
    ) {
      // Check if the event type is in our blocked list
      if (
        typeof type === "string" &&
        blockedEvents.includes(type.toLowerCase())
      ) {
        log(
          `Force Override: Blocked page script attempt to add listener for: ${type}`
        );
        return; // Prevent the listener from being added
      }

      // If not blocked, call the original addEventListener we stored
      // Check if the stored reference is still valid
      if (typeof storedOriginalAddEventListener === "function") {
        try {
          // Use Reflect.apply for correct 'this' context and arguments
          return Reflect.apply(storedOriginalAddEventListener, this, arguments);
        } catch (applyError) {
          errorLog(
            "Force Override Error: Failed to apply original addEventListener inside override:",
            applyError
          );
          // Avoid potential loops or further issues by returning undefined.
          return undefined;
        }
      } else {
        // This case should ideally not happen if the initial check passed, but safeguard anyway.
        errorLog(
          "Force Override Error: storedOriginalAddEventListener is invalid inside override! Cannot call original."
        );
        return undefined;
      }
    };

    // Set the flag indicating we *intended* to apply the override.
    // We no longer rely on checking if the prototype reference changed,
    // as that check itself can be unreliable or misleading.
    isAddEventListenerOverridden = true;
    log(
      "forceModeManager: addEventListener override function applied. Flag set."
    );
  } catch (overrideError) {
    errorLog(
      "forceModeManager: CRITICAL ERROR during addEventListener override attempt:",
      overrideError
    );
    // Ensure state is clean if the override process failed critically
    storedOriginalAddEventListener = null;
    isAddEventListenerOverridden = false;
  }
  log(
    "<<< forceModeManager: overrideAddEventListener finished. IsOverridden Flag:",
    isAddEventListenerOverridden
  );
}

/**
 * Resets the internal state associated with the Force Mode override.
 * Clears the flag and the stored reference to the original function.
 * IMPORTANT: This function DOES NOT attempt to restore the actual
 * EventTarget.prototype.addEventListener to its original state,
 * as that is often not possible reliably. The override might persist
 * until a page reload.
 */
export function resetForceOverrideState() {
  log(">>> forceModeManager: resetForceOverrideState called.");
  // Only log change if state was actually active
  if (isAddEventListenerOverridden || storedOriginalAddEventListener) {
    storedOriginalAddEventListener = null; // Clear the stored reference
    isAddEventListenerOverridden = false; // Reset the flag
    log("forceModeManager: Force override flag reset and reference cleared.");
  } else {
    log("forceModeManager: Force override flag was already clear.");
  }
  log("<<< forceModeManager: resetForceOverrideState finished.");
}

/**
 * Checks if the addEventListener override is currently flagged as active.
 * Note: This flag indicates the intended state based on the last action
 * (overrideAddEventListener or resetForceOverrideState), not a guarantee
 * that the prototype hasn't been modified by other scripts or that restoration
 * (which we don't attempt) was successful.
 * @returns {boolean}
 */
export function isForceOverrideActive() {
  return isAddEventListenerOverridden;
}
