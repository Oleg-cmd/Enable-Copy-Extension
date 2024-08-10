const isDevMode = false;

function log(message) {
  if (isDevMode) {
    console.log(message);
  }
}

function errorLog(error) {
  if (isDevMode) {
    console.error(error);
  }
}

function enableCopying() {
  log("Attempting to allow copying on a page.");
  overrideCss();
  overrideHtml();
  overrideNonStatic();
  overrideCopyRestrictions();
  makeContentSelectable();
  applyCustomStyles();
  log("Processing of the page for copy authorization is complete.");
}

function overrideCopyRestrictions() {
  log("Attempting to bypass copying restrictions");

  document.addEventListener("copy", copyEventOverride, true);
  document.addEventListener("keydown", keydownEventOverride, true);
}

function copyEventOverride(event) {
  event.stopImmediatePropagation();
  log("Copying is allowed!");
}

function keydownEventOverride(event) {
  if (event.ctrlKey && (event.key === "c" || event.key === "C")) {
    event.stopImmediatePropagation();
  }
}

function overrideNonStatic() {
  log("Trying to disable js-scripts");
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === "copy") {
      log("An attempt to add a copy event handler was blocked.");
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}

function overrideCss() {
  try {
    const styleSheets = [...document.styleSheets];
    styleSheets.forEach((sheet) => {
      const rules = [...sheet.cssRules];
      rules.forEach((rule) => {
        if (rule.style && rule.style.userSelect === "none") {
          log("Found rule userSelect: none; - changed to auto.");
          rule.style.userSelect = "auto";
        }
      });
    });
  } catch (e) {
    errorLog("Error when changing styles: ", e);
  }
}

function overrideHtml() {
  document.querySelectorAll("*").forEach((el) => {
    if (el.style.userSelect === "none") {
      el.style.userSelect = "auto";
      log("Changed the inline style of userSelect to auto.");
    }
    if (el.getAttribute("onselectstart")) {
      log("The onselectstart attribute has been removed.");
      el.removeAttribute("onselectstart");
    }
    if (el.getAttribute("oncopy")) {
      log("The oncopy attribute has been removed.");
      el.removeAttribute("oncopy");
    }
    el.onselectstart = null;
    el.oncopy = null;
  });
}

function makeContentSelectable() {
  const styleElement = document.createElement("style");
  styleElement.setAttribute("data-extension", "enable-copy");
  styleElement.type = "text/css";
  styleElement.innerHTML = `
      :host,
      :host *,
      :host div *,
      :host span *,
      :host p *,
      :host h1 *,
      :host h2 *,
      :host h3 *,
      :host h4 *,
      :host h5 *,
      :host h5 *,
      :host h5 *,
      :host h5 *:not(input):not(textarea):not([contenteditable=""]),
      :host h5 *:not(input):not(textarea):not([contenteditable="true"]) {
        user-select: text !important;
        pointer-events: initial !important;
      }
    `;
  document.head.appendChild(styleElement);
}

function applyCustomStyles() {
  const css = `
      html,
      body,
      body *,
      html body *,
      html body.ds *,
      html body div *,
      html body span *,
      html body p *,
      html body h1 *,
      html body h2 *,
      html body h3 *,
      html body h4 *,
      html body h5 *,
      html body h5 *,
      html body h5 *,
      html body *:not(input):not(textarea):not([contenteditable=""]):not([contenteditable="true"]) {
        user-select: text !important;
        pointer-events: initial !important;
      }
      html body *:not(input):not(textarea)::selection,
      body *:not(input):not(textarea)::selection,
      html body div *:not(input):not(textarea)::selection,
      html body span *:not(input):not(textarea)::selection,
      html body p *:not(input):not(textarea)::selection,
      html body h1 *:not(input):not(textarea)::selection,
      html body h2 *:not(input):not(textarea)::selection,
      html body h3 *:not(input):not(textarea)::selection,
      html body h4 *:not(input):not(textarea)::selection,
      html body h5 *:not(input):not(textarea)::selection {
        background-color: #3297fd !important;
        color: #ffffff !important;
      }
      /* Specific site rules */
      .www_linkedin_com .sa-assessment-flow__card.sa-assessment-quiz .sa-assessment-quiz__scroll-content .sa-assessment-quiz__response .sa-question-multichoice__item.sa-question-basic-multichoice__item .sa-question-multichoice__input.sa-question-basic-multichoice__input.ember-checkbox.ember-view {
        width: 40px;
      }
      .www_instagram_com ._aagw {
        display: none;
      }
      .bp-doc .pdfViewer .page:not(.bp-is-invisible):before {
        display: none;
      }
      .web_telegram_org .emoji-animation-container {
        display: none;
      }
      .ladno_ru [style*="position: absolute; left: 0; right: 0; top: 0; bottom: 0;"] {
        display: none !important;
      }
      .mycomfyshoes_fr #fader.fade-out {
        display: none !important;
      }
      .www_mindmeister_com .kr-view {
        z-index: -1 !important;
      }
      .www_newvision_co_ug .v-snack:not(.v-snack--absolute) {
        z-index: -1 !important;
      }
      
      .derstarih_com .bs-sks {
        z-index: -1;
      }
    `;

  const styleElement = document.createElement("style");
  styleElement.setAttribute("data-extension", "enable-copy");
  styleElement.type = "text/css";
  styleElement.appendChild(document.createTextNode(css));
  document.head.appendChild(styleElement);
}

function disableCopying() {
  log("Disabling copying functionality on the page.");
  const addedStyles = document.head.querySelectorAll(
    'style[data-extension="enable-copy"]'
  );
  addedStyles.forEach((style) => style.remove());
  document.removeEventListener("copy", copyEventOverride, true);
  document.removeEventListener("keydown", keydownEventOverride, true);
  log("Copying functionality has been disabled.");
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "enableCopying") {
    enableCopying();
    log("Copying enabled");
  } else if (message.action === "disableCopying") {
    disableCopying();
    log("Copying disabled");
  }
});

chrome.storage.local.get("extensionEnabled", function (result) {
  if (result.extensionEnabled) {
    enableCopying();
  } else {
    disableCopying();
  }
});
