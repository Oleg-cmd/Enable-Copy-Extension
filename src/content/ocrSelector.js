// src/content/ocrSelector.js
// Interactive area selection for OCR

import { errorLog, log } from "../shared/utils.js";

/**
 * Shows overlay for user to select area for OCR
 * @returns {Promise<string|null>} Extracted text or null
 */
export async function selectAreaAndExtractText() {
  log("OCR Selector: Starting area selection");

  return new Promise((resolve) => {
    // Create overlay elements
    const overlay = createOverlay();
    const selectionBox = createSelectionBox();

    // Append to body
    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);

    // Selection state
    let isSelecting = false;
    let startX = 0;
    let startY = 0;

    // Instructions
    showInstructions(overlay);

    // Mouse down - start selection
    overlay.addEventListener("mousedown", (e) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;

      selectionBox.style.left = startX + "px";
      selectionBox.style.top = startY + "px";
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
      selectionBox.style.display = "block";

      hideInstructions();

      e.preventDefault();
    });

    // Mouse move - update selection
    overlay.addEventListener("mousemove", (e) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = left + "px";
      selectionBox.style.top = top + "px";
      selectionBox.style.width = width + "px";
      selectionBox.style.height = height + "px";
    });

    // Mouse up - finish selection and perform OCR
    overlay.addEventListener("mouseup", async (e) => {
      if (!isSelecting) return;
      isSelecting = false;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      // Show processing message
      showMessage(overlay, "⏳ Processing OCR...", false);
      selectionBox.style.borderColor = "#4CAF50";

      try {
        // Capture the selected area
        const text = await captureAndOCR(left, top, width, height);

        if (text && text.length > 0) {
          showMessage(
            overlay,
            `✅ Extracted ${text.length} characters!`,
            false
          );
          setTimeout(() => {
            cleanup();
            resolve(text);
          }, 1500);
        } else {
          showMessage(overlay, "⚠️ No text found in selected area", true);
          setTimeout(() => {
            cleanup();
            resolve(null);
          }, 2500);
        }
      } catch (error) {
        errorLog("OCR Selector: Error during OCR:", error);
        showMessage(overlay, `❌ Error: ${error.message}`, true);
        setTimeout(() => {
          cleanup();
          resolve(null);
        }, 3000);
      }
    });

    // ESC key to cancel
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        log("OCR Selector: Cancelled by user");
        cleanup();
        resolve(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    function cleanup() {
      document.removeEventListener("keydown", handleKeyDown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (selectionBox.parentNode)
        selectionBox.parentNode.removeChild(selectionBox);
    }
  });
}

/**
 * Creates semi-transparent overlay
 */
function createOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "enable-copy-ocr-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    cursor: crosshair;
  `;
  return overlay;
}

/**
 * Creates selection box element
 */
function createSelectionBox() {
  const box = document.createElement("div");
  box.id = "enable-copy-selection-box";
  box.style.cssText = `
    position: fixed;
    border: 2px dashed #2196F3;
    background: rgba(33, 150, 243, 0.1);
    z-index: 1000000;
    display: none;
    pointer-events: none;
  `;
  return box;
}

/**
 * Shows instructions to user
 */
function showInstructions(overlay) {
  const instructions = document.createElement("div");
  instructions.id = "enable-copy-instructions";
  instructions.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    z-index: 1000001;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    max-width: 300px;
  `;
  instructions.innerHTML = `
    <div style="margin: 0 0 10px 0; color: #fff; font-size: 16px; font-weight: 600;">📝 OCR Text Extractor</div>
    <div style="margin: 0 0 8px 0; color: #ddd; font-size: 13px;">
      Click and drag to select the text area
    </div>
    <div style="margin: 0; color: #999; font-size: 11px;">
      Press ESC to cancel
    </div>
  `;
  overlay.appendChild(instructions);
}

/**
 * Hides instructions
 */
function hideInstructions() {
  const instructions = document.getElementById("enable-copy-instructions");
  if (instructions) {
    instructions.style.display = "none";
  }
}

/**
 * Shows message on overlay
 */
function showMessage(overlay, message, isError) {
  hideInstructions();

  const messageBox = document.createElement("div");
  messageBox.id = "enable-copy-message";
  messageBox.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? "#f44336" : "#4CAF50"};
    color: white;
    padding: 18px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 1000002;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
  `;
  messageBox.textContent = message;
  overlay.appendChild(messageBox);
}

/**
 * Captures visible area using browser's captureTab API
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width of area
 * @param {number} height - Height of area
 * @returns {Promise<string>} Data URL of captured image
 */
async function captureVisibleArea(x, y, width, height) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "captureVisibleTab",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response || !response.dataUrl) {
          reject(new Error("No screenshot data received"));
          return;
        }

        // Crop the screenshot to selected area
        cropImage(response.dataUrl, x, y, width, height)
          .then(croppedDataUrl => resolve(croppedDataUrl))
          .catch(error => reject(error));
      }
    );
  });
}

/**
 * Crops image to specified area
 */
async function cropImage(dataUrl, x, y, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      // Account for device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      ctx.drawImage(
        img,
        x * dpr, y * dpr, width * dpr, height * dpr,  // Source
        0, 0, canvas.width, canvas.height              // Destination
      );
      
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load screenshot"));
    img.src = dataUrl;
  });
}

/**
 * Renders DOM content to canvas (fallback method)
 * Just uses the tab capture API which should work for any visible content
 */
async function renderDOMToCanvas(x, y, width, height) {
  log("OCR Selector: Using tab capture for DOM content...");
  
  // For DOM content, we can just use the same tab capture method
  // It will capture whatever is visible on screen, including text
  return await captureVisibleArea(x, y, width, height);
}

/**
 * Sends image data to OCR
 */
async function sendToOCR(dataUrl) {
  log("OCR Selector: Sending to background for OCR processing...");
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "performBackgroundOCR",
        image: dataUrl,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.text);
        } else {
          reject(new Error(response?.error || "Background OCR failed"));
        }
      }
    );
  });
}

/**
 * Captures screenshot of selected area and performs OCR
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width of area
 * @param {number} height - Height of area
 * @returns {Promise<string>} Extracted text
 */
async function captureAndOCR(x, y, width, height) {
  log(`OCR Selector: Capturing area (${x}, ${y}, ${width}x${height})`);
  log(`OCR Selector: Scroll position: (${window.scrollX}, ${window.scrollY})`);
  log(`OCR Selector: Device pixel ratio: ${window.devicePixelRatio}`);

  // Try to use browser's captureTab API if available
  try {
    const dataUrl = await captureVisibleArea(x, y, width, height);
    return await sendToOCR(dataUrl);
  } catch (error) {
    errorLog("OCR Selector: Tab capture failed, falling back to canvas method:", error);
  }

  // Fallback: Create a canvas to capture the screen area
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Fill with white background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Find all canvas elements in the selected area
  const canvases = findCanvasesInArea(x, y, width, height);

  if (canvases.length === 0) {
    log("OCR Selector: No canvas elements found, will try DOM rendering");
    // Try to render DOM content
    try {
      const domDataUrl = await renderDOMToCanvas(x, y, width, height);
      return await sendToOCR(domDataUrl);
    } catch (domError) {
      errorLog("OCR Selector: DOM rendering failed:", domError);
      throw new Error("No capturable content found in selected area. Please select an area with visible content.");
    }
  }

  log(`OCR Selector: Found ${canvases.length} canvas elements in area`);

  canvases.forEach((c, i) => {
    const rect = c.getBoundingClientRect();
    log(
      `OCR Selector: Canvas ${i}: position(${rect.left}, ${rect.top}), size(${rect.width}x${rect.height}), actual size(${c.width}x${c.height})`
    );
  });

  log(`OCR Selector: Found ${canvases.length} canvas elements in area`);

  // Draw each canvas onto our capture canvas
  canvases.forEach((sourceCanvas, index) => {
    const rect = sourceCanvas.getBoundingClientRect();

    // IMPORTANT: canvas.width/height might differ from rect.width/height due to CSS scaling
    // We need to account for this scale factor
    const scaleX = sourceCanvas.width / rect.width;
    const scaleY = sourceCanvas.height / rect.height;

    log(
      `OCR Selector: Canvas ${index} scale: (${scaleX.toFixed(
        2
      )}, ${scaleY.toFixed(2)})`
    );

    // Calculate intersection between selection area and canvas
    const intersectLeft = Math.max(rect.left, x);
    const intersectTop = Math.max(rect.top, y);
    const intersectRight = Math.min(rect.right, x + width);
    const intersectBottom = Math.min(rect.bottom, y + height);

    const intersectWidth = intersectRight - intersectLeft;
    const intersectHeight = intersectBottom - intersectTop;

    if (intersectWidth <= 0 || intersectHeight <= 0) {
      log(
        `OCR Selector: Canvas ${index} doesn't intersect with selection area`
      );
      return;
    }

    // Source coordinates (scaled to actual canvas dimensions)
    const srcX = (intersectLeft - rect.left) * scaleX;
    const srcY = (intersectTop - rect.top) * scaleY;
    const srcWidth = intersectWidth * scaleX;
    const srcHeight = intersectHeight * scaleY;

    // Destination coordinates (where to paste on our canvas)
    const destX = intersectLeft - x;
    const destY = intersectTop - y;
    const destWidth = intersectWidth;
    const destHeight = intersectHeight;

    log(`OCR Selector: Drawing canvas ${index}:`);
    log(
      `  Source: (${srcX.toFixed(0)}, ${srcY.toFixed(0)}, ${srcWidth.toFixed(
        0
      )}x${srcHeight.toFixed(0)})`
    );
    log(
      `  Dest: (${destX.toFixed(0)}, ${destY.toFixed(0)}, ${destWidth.toFixed(
        0
      )}x${destHeight.toFixed(0)})`
    );

    try {
      ctx.drawImage(
        sourceCanvas,
        srcX,
        srcY,
        srcWidth,
        srcHeight, // Source rectangle (actual canvas pixels)
        destX,
        destY,
        destWidth,
        destHeight // Destination rectangle (screen pixels)
      );
    } catch (e) {
      errorLog("OCR Selector: Error drawing canvas:", e);
    }
  });

  log(`OCR Selector: Canvas captured - Size: ${canvas.width}x${canvas.height}`);
  log(`OCR Selector: Canvas captured, sending to background...`);

  // image -> base64
  const dataUrl = canvas.toDataURL("image/png");

  // Send to OCR
  return await sendToOCR(dataUrl);
}

/**
 * Finds all canvas elements within specified area
 */
function findCanvasesInArea(x, y, width, height) {
  const canvases = document.querySelectorAll("canvas");
  const inArea = [];

  canvases.forEach((canvas) => {
    const rect = canvas.getBoundingClientRect();

    // Check if canvas intersects with selection area
    if (
      rect.right > x &&
      rect.left < x + width &&
      rect.bottom > y &&
      rect.top < y + height
    ) {
      inArea.push(canvas);
    }
  });

  return inArea;
}
