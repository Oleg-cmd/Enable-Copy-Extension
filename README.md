# Enable Copy Extension

## Briefly

Allows copying text from any page by overriding restrictive styles and blocking scripts that prevent selection and copying.

## Features

Enable Copy Extension enhances your browsing by ensuring you can always copy text or interact with content, even on websites that try to prevent it. It provides user control over how and where the extension is active.

*   **Unlock Copying:** Overcomes common techniques used to block text selection and copying, including CSS (`user-select: none;`) and JavaScript event listeners (e.g., `oncopy`, `oncontextmenu`, `onselectstart`).
*   **Two Operating Modes:** Choose the level of intervention needed:
    *   **Standard Mode (Default):** Uses CSS overrides and intercepts specific JavaScript events in the capture phase. Generally sufficient for most websites and designed to minimize interference with site functionality.
    *   **Force Mode (Risky):** Employs more aggressive techniques, including **overriding the browser's core `addEventListener` function** for specific elements. This can unlock copying on very stubborn sites but has a **higher risk of breaking website features** (like buttons, menus, or login fields). Use with caution!
*   **Whitelist Functionality:** Easily disable the extension on specific domains where it's not needed or causes issues. Add the current site directly from the popup or manage the full list via the Options page.
*   **Simple Popup Control:** Manage the extension's state directly from the browser toolbar:
    *   Globally enable/disable the extension.
    *   Switch between Standard and Force modes for the active tab.
    *   Quickly add the current website to the whitelist.
    *   Access the full whitelist management page.
*   **Persistent Settings:** Your global enabled/disabled state and whitelist are saved using `chrome.storage.local`.

## How to Use

1.  **Click the Extension Icon:** Find the Enable Copy Extension icon in your browser toolbar to open the popup.
2.  **Global Toggle:** The top button ("Enable Extension" / "Disable Extension") controls whether the extension is active globally.
3.  **Mode Selection:**
    *   If the extension is enabled and the site isn't whitelisted, it defaults to **Standard Mode**.
    *   Click the "**Force Copy (Risky)**" button to activate **Force Mode** for the current tab. The button text will change to "**Force Mode Active**".
    *   Click "**Force Mode Active**" again to return to **Standard Mode**.
4.  **Whitelisting:**
    *   Click "**Disable on [site.com]**" (or similar) to add the current website's domain to the whitelist. The extension will immediately become inactive on that page.
    *   Click "**Settings**" to open the extension's Options page, where you can view, add, or remove domains from the list.
5.  **Status:** The popup indicates if the site is whitelisted or if the extension is inactive on the current page type (e.g., `about:` or `chrome:` pages).

## Disclaimer / Important Notes

*   **Force Mode Warning:** Force Mode is powerful but **can break websites**. Buttons, links, menus, forms, and other interactive elements may stop working correctly. Use it only when Standard Mode fails and you understand the risks.
*   **Page Reload for Force Mode Deactivation:** Due to the invasive nature of Force Mode (overriding `addEventListener`), its effects might not fully disappear immediately when switching back to Standard Mode or disabling the extension. **A page reload is often required** to completely restore the website's original event handling after using Force Mode.
*   **Potential Interference:** While designed to be minimally intrusive, any extension modifying website behavior *could* potentially conflict with complex web applications. If you encounter issues on a specific site, try adding it to the whitelist.

## Technical Details (Briefly)

*   Injects CSS to enforce `user-select: text !important;` and `pointer-events: auto !important;`.
*   Uses capture-phase event listeners to call `event.stopImmediatePropagation()` for events like `copy`, `cut`, `contextmenu`, `selectstart`, `mousedown`.
*   **Force Mode:** Additionally overrides `EventTarget.prototype.addEventListener` within the content script's context to prevent sites from adding new blocking listeners for certain events.
*   Uses `chrome.storage.local` for storing the global enabled state and the whitelist array.
*   Uses `chrome.runtime` messaging for communication between the popup, background script, and content scripts.
*   Uses `chrome.scripting` API where applicable (Manifest V3).

## Third-Party Libraries

This extension uses the following open-source libraries:

- **[Tesseract.js](https://github.com/naptha/tesseract.js)** - Pure Javascript OCR (Apache-2.0 License)
  - We apply an automatic patch during build to fix a bug in v7 (see `scripts/patch-tesseract.js`)
  - Language data files are from [tessdata repository](https://github.com/tesseract-ocr/tessdata)

## Links

Link to the Firefox Add-ons store: [Enable Copy Extension](https://addons.mozilla.org/ru/firefox/addon/enable-copy-extension)


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)