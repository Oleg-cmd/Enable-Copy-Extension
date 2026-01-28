# Enable Copy Extension

Enable Copy Extension is a browser extension that restores your ability to select and copy text on websites that try to block it. In addition to bypassing copy restrictions, it includes OCR (Optical Character Recognition) to extract text from images, PDFs, and protected documents.

The project is fully open source and privacy-focused. No data is collected or sent anywhere.

## Overview

Many websites disable text selection, right-click menus, or copy actions using CSS and JavaScript. Enable Copy Extension neutralizes these restrictions and gives control back to the user.

The extension works out of the box on most websites and provides an optional aggressive mode for especially stubborn cases. You can also whitelist sites where the extension should be disabled.

## Features

Unlock copying on most websites by overriding restrictive CSS and blocking JavaScript handlers that prevent selection or copying.

Two operating modes are available.

Standard Mode (default) safely restores copying by applying CSS overrides and intercepting blocking events in the capture phase. It is designed to work on the majority of websites with minimal side effects.

Force Mode (risky) uses more aggressive techniques to defeat advanced copy protection. It overrides the browser’s `addEventListener` mechanism for specific events, which can break site functionality such as buttons, menus, or forms. Use only when Standard Mode is not enough.

Whitelist functionality allows you to disable the extension on specific domains. Sites can be added directly from the popup or managed through the Options page.

Simple popup controls allow you to enable or disable the extension globally, switch between Standard and Force modes for the current tab, add the current site to the whitelist, and open the settings page.

OCR (text recognition) allows extracting text from images, PDFs, and protected content using Tesseract.js.

Persistent settings are stored locally using `chrome.storage.local`.

## OCR Support

English OCR is included by default.

Additional languages can be added manually.

To add OCR languages, open the Options page and go to OCR Languages. Download `.traineddata.gz` files from the official Tesseract OCR tessdata repository. Click “Upload Language File”, select the downloaded file, choose the languages you want to use, and start scanning.

All OCR processing happens locally in the browser. No images or text are uploaded anywhere.

## How to Use

Click the Enable Copy Extension icon in the browser toolbar to open the popup.

Use the global toggle at the top of the popup to enable or disable the extension entirely.

When enabled and the current site is not whitelisted, the extension runs in Standard Mode by default.

If copying is still blocked, activate Force Mode by clicking the “Force Copy (Risky)” button. When Force Mode is active, the button label will change to indicate this.

Click the Force Mode button again to return to Standard Mode.

To disable the extension on the current website, click “Disable on [site.com]”. The site will be added to the whitelist and the extension will stop affecting it immediately.

Use the Settings button to open the Options page and manage the full whitelist or OCR languages.

The popup also shows status information if the site is whitelisted or if the extension cannot run on the current page type (for example `about:` or `chrome:` pages).

## Important Notes

Force Mode is powerful but dangerous. It can break website behavior, including buttons, links, menus, input fields, and login forms. Only use it when you understand the risks.

Because Force Mode overrides core event handling, its effects may not fully disappear when switching back to Standard Mode or disabling the extension. Reloading the page is often required to fully restore normal behavior.

Although the extension is designed to be minimally intrusive, it may conflict with complex web applications. If a site behaves incorrectly, add it to the whitelist.

## Technical Details

The extension injects CSS rules such as `user-select: text !important` and `pointer-events: auto !important`.

It attaches capture-phase event listeners that stop propagation of events like `copy`, `cut`, `contextmenu`, `selectstart`, and `mousedown`.

In Force Mode, it additionally overrides `EventTarget.prototype.addEventListener` in the page context to prevent websites from registering new blocking event listeners.

Settings such as the global enabled state and whitelist are stored using `chrome.storage.local`.

Communication between popup, background scripts, and content scripts is handled via `chrome.runtime` messaging.

The extension is built for Manifest V3 and uses the `chrome.scripting` API where applicable.

## Third-Party Libraries

This project uses the following open-source libraries.

Tesseract.js – pure JavaScript OCR engine licensed under Apache-2.0.

A small automatic patch is applied during build to fix a known issue in Tesseract.js v7 (see `scripts/patch-tesseract.js`).

Language data files are taken from the official Tesseract tessdata repository.

## Links

Firefox Add-ons: [https://addons.mozilla.org/ru/firefox/addon/enable-copy-extension](https://addons.mozilla.org/ru/firefox/addon/enable-copy-extension)

## License

MIT License
