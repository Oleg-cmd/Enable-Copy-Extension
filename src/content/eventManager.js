// src/content/eventManager.js

import { log, errorLog } from "../shared/utils.js";

// List of events whose default/page behavior we want to ensure by stopping propagation in capture phase
const managedEvents = [
  "copy",
  "cut",
  "contextmenu",
  "selectstart",
  "mousedown",
];
// Consistent options object for adding/removing listeners
const eventListenerOptions = { capture: true, passive: false }; // passive: false might be needed if stopImmediatePropagation causes issues

/**
 * Event handler that stops the event from propagating further down or up the DOM.
 * Used in the capture phase to intercept potentially blocking listeners from the page.
 * @param {Event} event The event object.
 */
function stopImmediatePropagationHandler(event) {
  event.stopImmediatePropagation();
  // Log selectively if needed for debugging specific events:
  // log(`eventManager: Event ${event.type} intercepted and propagation stopped.`);
}

/**
 * Adds capture-phase listeners to intercept and stop propagation of potentially blocked events.
 */
export function overrideEventRestrictions() {
  log(">>> eventManager: overrideEventRestrictions for:", managedEvents);
  try {
    managedEvents.forEach((type) => {
      // Remove first to avoid duplicates if called multiple times mistakenly
      document.removeEventListener(
        type,
        stopImmediatePropagationHandler,
        eventListenerOptions
      );
      document.addEventListener(
        type,
        stopImmediatePropagationHandler,
        eventListenerOptions
      );
    });
    log("eventManager: Capture-phase listeners added.");
  } catch (e) {
    errorLog("eventManager: Error overriding event restrictions:", e);
  }
  log("<<< eventManager: overrideEventRestrictions finished.");
}

/**
 * Removes the capture-phase listeners added by overrideEventRestrictions.
 */
export function removeEventRestrictions() {
  log(">>> eventManager: removeEventRestrictions for:", managedEvents);
  let removeCount = 0;
  try {
    managedEvents.forEach((type) => {
      document.removeEventListener(
        type,
        stopImmediatePropagationHandler,
        eventListenerOptions
      );
      removeCount++;
    });
    log(
      `eventManager: Attempted to remove ${removeCount} capture-phase listeners.`
    );
  } catch (e) {
    errorLog("eventManager: Error removing event restrictions:", e);
  }
  log("<<< eventManager: removeEventRestrictions finished.");
}
