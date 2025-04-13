// src/content/styleManager.js

import { log, errorLog } from "../shared/utils.js";

const STYLE_ID = "enable-copy-core-styles";

/**
 * Removes the extension's core CSS styles from the page.
 * @returns {boolean} - True if a style element was found and removed, false otherwise.
 */
export function removeCoreStyles() {
  log(`>>> styleManager: removeCoreStyles searching for ID: ${STYLE_ID}`);
  let removed = false;
  try {
    const styleElements = document.querySelectorAll(`style#${STYLE_ID}`);
    if (styleElements.length > 0) {
      styleElements.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
          log(`styleManager: Removed style element with ID: ${STYLE_ID}`);
          removed = true;
        }
      });
    } else {
      log(`styleManager: No style element found with ID: ${STYLE_ID}`);
    }
  } catch (e) {
    errorLog("styleManager: Error removing styles:", e);
  }
  log(`<<< styleManager: removeCoreStyles. Removed: ${removed}`);
  return removed;
}

/**
 * Applies the core CSS styles needed for copying, adjusting for Force Mode.
 * Ensures any previous styles are removed first.
 * @param {boolean} isForceMode - If true, applies aggressive pointer-events.
 */
export function applyCoreStyles(isForceMode = false) {
  removeCoreStyles(); // Ensure clean slate *before* applying
  log(`>>> styleManager: applyCoreStyles. Force Mode: ${isForceMode}`);

  try {
    // --- Define CSS Rules ---
    const baseCss = `
        /* General selectability */
        *, *::before, *::after {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
        /* Selection styles override */
        ::selection { background-color: #3297fd !important; color: #ffffff !important; }
        ::-moz-selection { background-color: #3297fd !important; color: #ffffff !important; }
        `;

    let pointerEventsCss = "";
    if (isForceMode) {
      log("styleManager: Applying aggressive pointer-events for Force Mode.");
      pointerEventsCss = `
            /* Aggressive Pointer Events (Force Mode) */
            body, body * { pointer-events: auto !important; }
            `;
    } else {
      log("styleManager: Applying refined pointer-events for Standard Mode.");
      pointerEventsCss = `
            /* Refined Pointer Events (Standard Mode) - Exclude interactive elements */
            body *:not(button):not(a):not(input):not(select):not(textarea):not(label):not(svg):not(svg *):not(canvas):not(video):not(audio):not([role="button"]):not([role="link"]):not([role="checkbox"]):not([role="radio"]):not([role="tab"]):not([role="menuitem"]):not([role="slider"]):not([role="spinbutton"]):not([role="textbox"]):not([contenteditable="true"]) {
                pointer-events: auto !important;
            }
            /* Ensure body itself is targetable */
            body { pointer-events: auto !important; }
            `;
    }

    // --- Add Specific Site Fixes ---
    const siteFixesCss = `
        /* --- Specific Site Fixes --- */
        /* Add site-specific rules here if needed */
        `;

    const finalCss = baseCss + pointerEventsCss + siteFixesCss;

    // --- Create and Append Style Element ---
    const styleElement = document.createElement("style");
    styleElement.id = STYLE_ID;
    styleElement.type = "text/css";
    styleElement.appendChild(document.createTextNode(finalCss));

    const head = document.head || document.documentElement;
    if (head) {
      head.appendChild(styleElement);
      log(`styleManager: Core CSS styles applied with ID: ${STYLE_ID}`);
    } else {
      errorLog(
        "styleManager: Could not find head or documentElement to append styles."
      );
    }
  } catch (e) {
    errorLog("styleManager: Error applying styles:", e);
  }
  log(`<<< styleManager: applyCoreStyles finished.`);
}
