import { log, errorLog } from "../shared/utils.js";

const potentiallyBlockingAttributes = [
  "oncopy",
  "oncut",
  "oncontextmenu",
  "onselectstart",
  "onmousedown",
];

// --- Storage for original states ---
// Map<Element, { attributes: { [attrName: string]: string }, styles: { [propName: string]: string } }>
let originalStates = new Map();
let cleanupRunId = 0; // For debugging, to differentiate runs

/**
 * Saves the original state of an attribute before removing it.
 * @param {Element} element
 * @param {string} attrName
 * @returns {boolean} - True if the attribute was found and removed/saved.
 */
function saveAndRemoveAttribute(element, attrName) {
  if (element.hasAttribute(attrName)) {
    if (!originalStates.has(element)) {
      originalStates.set(element, { attributes: {}, styles: {} });
    }
    const state = originalStates.get(element);
    // Save only if not already saved for this element in this "session"
    if (!(attrName in state.attributes)) {
      state.attributes[attrName] = element.getAttribute(attrName);
      log(
        `attributeManager[Run ${cleanupRunId}]: Saved attribute [${attrName}="${state.attributes[attrName]}"] for ${element.tagName}`
      );
    }
    element.removeAttribute(attrName);
    return true; // Indicates the attribute was found and removed (even if already saved)
  }
  return false;
}

/**
 * Saves the original value of the user-select style before changing it.
 * @param {Element} element
 * @returns {boolean} - True if the style was changed/saved.
 */
function saveAndResetUserSelect(element) {
  let changed = false;
  const style = element.style;
  if (!style) return false;

  // Check both standard and prefixed properties
  if (style.userSelect === "none") {
    if (!originalStates.has(element)) {
      originalStates.set(element, { attributes: {}, styles: {} });
    }
    const state = originalStates.get(element);
    // Save only if not already saved
    if (!("userSelect" in state.styles)) {
      state.styles.userSelect = style.userSelect; // Save 'none'
      log(
        `attributeManager[Run ${cleanupRunId}]: Saved style [userSelect="${state.styles.userSelect}"] for ${element.tagName}`
      );
    }
    style.userSelect = "text"; // Apply standard
    changed = true;
  }

  // Do the same for webkitUserSelect
  if (style.webkitUserSelect === "none") {
    if (!originalStates.has(element)) {
      originalStates.set(element, { attributes: {}, styles: {} });
    }
    const state = originalStates.get(element);
    if (!("webkitUserSelect" in state.styles)) {
      state.styles.webkitUserSelect = style.webkitUserSelect;
      log(
        `attributeManager[Run ${cleanupRunId}]: Saved style [webkitUserSelect="${state.styles.webkitUserSelect}"] for ${element.tagName}`
      );
    }
    style.webkitUserSelect = "text"; // Apply for older browsers
    changed = true;
  }

  return changed;
}

/**
 * Removes common blocking attributes and resets inline user-select styles,
 * saving the original values to allow restoration.
 * Clears previously saved states before running.
 */
export function cleanupElementAttributes() {
  cleanupRunId++;
  log(
    `>>> attributeManager[Run ${cleanupRunId}]: cleanupElementAttributes running... Clearing previous state.`
  );
  // Clear the map before each full cleanup pass to ensure we work
  // with the current DOM state and don't accumulate states from
  // previous activations without deactivation.
  originalStates.clear();
  let cleanedCount = 0;
  let elementsProcessed = 0;

  try {
    const elements = document.querySelectorAll("*"); // Keep using '*' for now
    elementsProcessed = elements.length;

    elements.forEach((el) => {
      let elementModified = false;

      // Handle attributes
      potentiallyBlockingAttributes.forEach((attr) => {
        // Use the new function that saves and removes
        if (saveAndRemoveAttribute(el, attr)) {
          elementModified = true;
        }
      });

      // Handle user-select
      if (saveAndResetUserSelect(el)) {
        elementModified = true;
      }

      if (elementModified) {
        cleanedCount++;
      }
    });
  } catch (e) {
    errorLog(
      `attributeManager[Run ${cleanupRunId}]: Error during attribute cleanup:`,
      e
    );
  }
  log(
    `<<< attributeManager[Run ${cleanupRunId}]: cleanupElementAttributes finished. Processed: ${elementsProcessed}, Elements potentially modified/saved: ${cleanedCount}. Total saved states: ${originalStates.size}`
  );
}

/**
 * Restores the original attributes and styles saved by `cleanupElementAttributes`.
 * Clears the state map after restoration.
 */
export function restoreElementAttributesAndStyles() {
  log(
    `>>> attributeManager: restoreElementAttributesAndStyles running... Restoring ${originalStates.size} elements.`
  );
  let restoredCount = 0;
  let errorsCount = 0;

  try {
    for (const [element, originalState] of originalStates.entries()) {
      try {
        // Check if the element still exists in the DOM (though Map should handle this)
        if (!element || !document.body.contains(element)) {
          // log(`attributeManager: Skipping restore for element no longer in DOM.`);
          continue; // Skip if the element is gone
        }

        let elementRestored = false;

        // Restore attributes
        for (const [attrName, value] of Object.entries(
          originalState.attributes
        )) {
          element.setAttribute(attrName, value);
          // log(`attributeManager: Restored attribute [${attrName}="${value}"] for ${element.tagName}`);
          elementRestored = true;
        }

        // Restore styles
        if (originalState.styles.userSelect !== undefined) {
          element.style.userSelect = originalState.styles.userSelect;
          // log(`attributeManager: Restored style [userSelect="${originalState.styles.userSelect}"] for ${element.tagName}`);
          elementRestored = true;
        }
        if (originalState.styles.webkitUserSelect !== undefined) {
          element.style.webkitUserSelect =
            originalState.styles.webkitUserSelect;
          // log(`attributeManager: Restored style [webkitUserSelect="${originalState.styles.webkitUserSelect}"] for ${element.tagName}`);
          elementRestored = true;
        }

        if (elementRestored) {
          restoredCount++;
        }
      } catch (elementError) {
        errorLog(
          `attributeManager: Error restoring state for element ${element.tagName}:`,
          elementError
        );
        errorsCount++;
      }
    }
  } catch (e) {
    errorLog("attributeManager: Error during restoration loop:", e);
    errorsCount++;
  }

  log(
    `<<< attributeManager: restoreElementAttributesAndStyles finished. Elements restored: ${restoredCount}. Errors: ${errorsCount}. Clearing state map.`
  );
  originalStates.clear(); // Clear the map after finishing restoration
}
