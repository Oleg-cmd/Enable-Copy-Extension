import { STATE, log, errorLog } from "../shared/utils.js";
import { applyCoreStyles, removeCoreStyles } from "./styleManager.js";
import {
  overrideEventRestrictions,
  removeEventRestrictions,
} from "./eventManager.js";
import {
  overrideAddEventListener,
  resetForceOverrideState, // Use only reset, not restore!
  isForceOverrideActive,
} from "./forceModeManager.js";
// Import both functions from attributeManager
import {
  cleanupElementAttributes,
  restoreElementAttributesAndStyles, // The new restore function
} from "./attributeManager.js";
import { reportActualState } from "./communication.js";

export function enableCopyingStandard(isCurrentlyWhitelisted) {
  log(
    ">>> stateApplier: enableCopyingStandard. Whitelisted:",
    isCurrentlyWhitelisted,
    "ForceActive:",
    isForceOverrideActive()
  );
  if (isCurrentlyWhitelisted) {
    log("stateApplier: enableCopyingStandard - Blocked by whitelist.");
    disableCopying(); // Ensure disabled state if whitelisted
    return;
  }

  // --- ORDER OF OPERATIONS for Standard Mode ---
  resetForceOverrideState(); // 1. Reset the Force Mode flag (doesn't touch prototype)
  restoreElementAttributesAndStyles(); // 1.5 RESTORE attributes/styles if switching FROM another state (just in case)
  removeEventRestrictions(); // 2. Remove extension's capture listeners
  removeCoreStyles(); // 3. Remove extension's CSS styles
  cleanupElementAttributes(); // 4. Clean up attributes/styles (SAVING originals)
  applyCoreStyles(false); // 5. Apply STANDARD CSS styles
  overrideEventRestrictions(); // 6. Add STANDARD capture listeners

  reportActualState(STATE.STANDARD_ACTIVE); // 7. Report the state
  log("<<< stateApplier: enableCopyingStandard - Applied Standard Mode.");
}

export function enableCopyingForce(isCurrentlyWhitelisted) {
  log(
    ">>> stateApplier: enableCopyingForce. Whitelisted:",
    isCurrentlyWhitelisted,
    "ForceActive:",
    isForceOverrideActive()
  );
  if (isCurrentlyWhitelisted) {
    log("stateApplier: enableCopyingForce - Blocked by whitelist.");
    disableCopying(); // Ensure disabled state if whitelisted
    return;
  }

  // --- ORDER OF OPERATIONS for Force Mode ---
  resetForceOverrideState(); // 1. Reset flag (in case switching from another state)
  restoreElementAttributesAndStyles(); // 1.5 RESTORE attributes/styles (just in case)
  removeEventRestrictions(); // 2. Remove existing restrictions
  removeCoreStyles(); // 3. Remove existing styles
  cleanupElementAttributes(); // 4. Clean up attributes/styles (SAVING originals)
  overrideAddEventListener(); // 5. APPLY addEventListener override (modifies prototype) - BEST EFFORT
  applyCoreStyles(true); // 6. Apply FORCE CSS styles
  overrideEventRestrictions(); // 7. Add capture listeners

  reportActualState(STATE.FORCE_ACTIVE); // 8. Report the state
  log("<<< stateApplier: enableCopyingForce - Applied.");
  // WARNING: Force Mode's addEventListener override cannot be reliably undone without page reload.
  log(
    "<<< stateApplier: WARNING - Force Mode's addEventListener override may require page reload to fully disable."
  );
}

export function disableCopying() {
  log(
    ">>> stateApplier: disableCopying. ForceActive:",
    isForceOverrideActive()
  );
  // --- ORDER OF OPERATIONS for Disabling ---
  const wasForceActive = isForceOverrideActive(); // Check *before* resetting
  resetForceOverrideState(); // 1. Reset the Force Mode flag (doesn't touch prototype)
  removeEventRestrictions(); // 2. Remove extension's capture listeners
  removeCoreStyles(); // 3. Remove extension's CSS styles
  restoreElementAttributesAndStyles(); // 4. RESTORE original attributes and styles!

  reportActualState(STATE.DISABLED); // 5. Report the disabled state

  if (wasForceActive) {
    // WARNING: Force Mode's addEventListener override cannot be reliably undone without page reload.
    log(
      "stateApplier: disableCopying - WARNING: Force Mode was active. Its effects on event listeners might linger until page reload."
    );
  }
  log("<<< stateApplier: disableCopying - Applied.");
}
