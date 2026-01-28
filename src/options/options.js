import {
  deleteLanguageFile,
  getDownloadedLangs,
  saveLanguageFile,
} from "../background/languageStore.js";
import { errorLog, log } from "../shared/utils.js";

let currentWhitelist = [];

function showStatus(message, isError = false) {
  const statusElement = document.getElementById("saveStatus");
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.style.color = isError ? "red" : "green";
  setTimeout(() => {
    if (statusElement.textContent === message) statusElement.textContent = "";
  }, 3000);
}

function renderWhitelist() {
  const listElement = document.getElementById("whitelistList");
  if (!listElement) return;
  listElement.textContent = ""; // Safe clear
  if (currentWhitelist.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.style.fontStyle = "italic";
    emptyLi.textContent = "No domains whitelisted.";
    listElement.appendChild(emptyLi);
    return;
  }
  [...currentWhitelist].sort().forEach((domain) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.style.wordBreak = "break-all";
    span.textContent = domain; // Safe text content
    li.appendChild(span);
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.className = "btn-remove";
    btn.onclick = () => {
      currentWhitelist = currentWhitelist.filter((d) => d !== domain);
      renderWhitelist();
      saveWhitelist();
    };
    li.appendChild(btn);
    listElement.appendChild(li);
  });
}

async function saveWhitelist() {
  try {
    await chrome.storage.local.set({ whitelistDomains: currentWhitelist });
    showStatus("Whitelist saved!");
  } catch (error) {
    showStatus("Save error: " + error.message, true);
  }
}

function cleanDomainInput(rawInput) {
  let domain = rawInput.trim().toLowerCase();
  if (!domain) return null;
  if (domain.startsWith("http://")) domain = domain.substring(7);
  if (domain.startsWith("https://")) domain = domain.substring(8);
  const slashIndex = domain.indexOf("/");
  if (slashIndex !== -1) domain = domain.substring(0, slashIndex);
  if (domain.startsWith("www.")) domain = domain.substring(4);
  return domain.includes(".") && !domain.includes(" ") ? domain : null;
}

// --- OCR Functions ---

async function renderOcrLangs() {
  const langList = document.getElementById("langList");
  if (!langList) return;

  try {
    const { ocrLanguages } = await chrome.storage.local.get({
      ocrLanguages: ["eng"],
    });
    const customLangs = await getDownloadedLangs();
    const allAvailable = Array.from(new Set(["eng", ...customLangs])).sort();

    langList.textContent = ""; // Safe clear
    allAvailable.forEach((lang) => {
      const div = document.createElement("div");
      div.className = "lang-item";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.id = `lang-${lang}`;
      chk.checked = ocrLanguages.includes(lang);
      chk.onchange = async () => {
        const { ocrLanguages: current } = await chrome.storage.local.get({
          ocrLanguages: ["eng"],
        });
        let next = chk.checked
          ? [...current, lang]
          : current.filter((l) => l !== lang);
        if (next.length === 0) {
          chk.checked = true;
          return;
        }
        await chrome.storage.local.set({ ocrLanguages: next });
      };

      const label = document.createElement("label");
      label.htmlFor = `lang-${lang}`;
      label.textContent =
        lang.toUpperCase() + (lang === "eng" ? " (Built-in)" : "");

      div.appendChild(chk);
      div.appendChild(label);

      if (lang !== "eng") {
        const del = document.createElement("button");
        del.textContent = "Remove File";
        del.style.fontSize = "10px";
        del.onclick = async () => {
          if (confirm(`Delete data for ${lang.toUpperCase()}?`)) {
            await deleteLanguageFile(lang);
            const { ocrLanguages: current } = await chrome.storage.local.get({
              ocrLanguages: ["eng"],
            });
            await chrome.storage.local.set({
              ocrLanguages: current.filter((l) => l !== lang),
            });
            renderOcrLangs();
          }
        };
        div.appendChild(del);
      }
      langList.appendChild(div);
    });
  } catch (e) {
    langList.textContent = ""; // Safe clear
    const errorP = document.createElement("p");
    errorP.style.color = "red";
    errorP.textContent = "Error loading languages.";
    langList.appendChild(errorP);
  }
}

async function initialize() {
  log("Initializing options page...");
  try {
    const data = await chrome.storage.local.get({ whitelistDomains: [] });
    currentWhitelist = data.whitelistDomains || [];
    renderWhitelist();
  } catch (e) {
    errorLog("Load whitelist error", e);
  }

  const addBtn = document.getElementById("addDomainButton");
  const input = document.getElementById("addDomainInput");
  if (addBtn && input) {
    addBtn.onclick = () => {
      const domain = cleanDomainInput(input.value);
      if (!domain) {
        showStatus("Invalid domain", true);
        return;
      }
      if (currentWhitelist.includes(domain)) {
        showStatus("Already exists", true);
        return;
      }
      currentWhitelist.push(domain);
      input.value = "";
      renderWhitelist();
      saveWhitelist();
    };
  }

  renderOcrLangs();

  const fileInput = document.getElementById("uploadLang");
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById("ocrStatus");
    const langCode = file.name.split(".")[0];
    try {
      status.textContent = "Saving...";
      status.style.color = "blue";
      
      // Save file as-is (gzipped or not)
      // Tesseract.js will auto-detect and decompress if needed
      const buffer = await file.arrayBuffer();
      
      await saveLanguageFile(langCode, buffer);
      status.textContent = `Success: ${langCode.toUpperCase()} added!`;
      status.style.color = "green";
      fileInput.value = "";
      renderOcrLangs();
    } catch (err) {
      status.textContent = "Upload error: " + err.message;
      status.style.color = "red";
    }
  };
}

document.addEventListener("DOMContentLoaded", initialize);
