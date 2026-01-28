// src/background/ocrManager.js

import { createWorker } from "tesseract.js";
import { errorLog, log } from "../shared/utils.js";
import { getLanguageFile } from "./languageStore.js";

export async function performOCR(imageBase64) {
  log("OCR: Starting processing...");
  let worker = null;

  try {
    // 1. Get requested languages
    const settings = await chrome.storage.local.get({
      ocrLanguages: ["eng"],
    });

    const requestedLangs = settings.ocrLanguages;
    log(`OCR: Requested languages: ${requestedLangs.join("+")}`);

    // 2. Prepare language configuration
    // Mix of strings (for bundled langs) and Lang objects (for custom langs)
    const langsToLoad = [];

    for (const lang of requestedLangs) {
      if (lang === "eng") {
        // English is bundled, just add as string
        langsToLoad.push("eng");
      } else {
        try {
          const fileData = await getLanguageFile(lang);
          if (fileData && fileData.byteLength > 0) {
            log(`OCR: Found custom data for ${lang} (${fileData.byteLength} bytes)`);
            // Add as Lang object - Tesseract will auto-detect and decompress gzip
            langsToLoad.push({
              code: lang,
              data: new Uint8Array(fileData)
            });
          } else {
            log(`OCR: Warning - ${lang} not found in IndexedDB, skipping`);
          }
        } catch (e) {
          errorLog(`OCR: Could not load ${lang} from IndexedDB:`, e);
        }
      }
    }

    const langString = langsToLoad
      .map(l => typeof l === 'string' ? l : l.code)
      .join("+");
    
    log(`OCR: Creating worker with languages: ${langString}`);

    // 3. Create worker with all languages at once (the official way)
    // Note: We patched worker.min.js to fix bug where it used l.data instead of l.code
    worker = await createWorker(langsToLoad, 1, {
      workerPath: chrome.runtime.getURL("static/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL(
        "static/tesseract/tesseract-core-simd.wasm.js"
      ),
      langPath: chrome.runtime.getURL("static/tesseract/lang/"),
      workerBlobURL: false,
      cacheMethod: "none",
      gzip: true,
      logger: (m) => {
        if (m.status === "recognizing") {
          log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // 4. Run recognition
    log(`OCR: Running recognition...`);
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBase64);

    log(`OCR Done. Confidence: ${confidence}%`);

    await worker.terminate();
    return text || "";
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {}
    }

    const errorMessage = err?.message || String(err) || "Unknown OCR Error";
    errorLog("OCR Background Error:", errorMessage);
    throw new Error(errorMessage);
  }
}
