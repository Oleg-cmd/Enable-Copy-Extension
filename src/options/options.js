// src/options/options.js

// --- Imports ---
// Import utilities if needed (e.g., for logging)
import { log, errorLog } from "../shared/utils.js"; // Adjust path if needed

// --- DOM Elements ---
const listElement = document.getElementById("whitelistList");
const inputElement = document.getElementById("addDomainInput");
const addButton = document.getElementById("addDomainButton");
const statusElement = document.getElementById("saveStatus");

// Check if elements exist
if (!listElement || !inputElement || !addButton || !statusElement) {
  errorLog(
    "Options page: One or more essential DOM elements not found. Check options.html IDs."
  );
  // Optionally display an error message to the user on the page itself
}

// --- State ---
let currentWhitelist = [];

// --- Functions ---

/**
 * Displays a temporary status message on the options page.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - True to display the message as an error (e.g., red color).
 */
function showStatus(message, isError = false) {
  if (!statusElement) return;
  log(`Options Status: ${message} (Error: ${isError})`);
  statusElement.textContent = message;
  statusElement.style.color = isError ? "red" : "green";
  // Clear the message after a delay
  setTimeout(() => {
    if (statusElement.textContent === message) {
      // Avoid clearing a newer message
      statusElement.textContent = "";
    }
  }, 3000); // Show for 3 seconds
}

/**
 * Renders the current whitelist array to the HTML list element.
 */
function renderWhitelist() {
  if (!listElement) return;
  log("Rendering whitelist:", currentWhitelist);
  listElement.innerHTML = ""; // Clear previous list

  if (currentWhitelist.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No domains whitelisted yet.";
    li.style.fontStyle = "italic";
    listElement.appendChild(li);
    return;
  }

  // Sort for consistent display
  const sortedWhitelist = [...currentWhitelist].sort();

  sortedWhitelist.forEach((domain) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = domain;
    span.style.wordBreak = "break-all"; // Prevent long domains from overflowing

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.dataset.domain = domain; // Store domain in data attribute for easy access
    removeButton.addEventListener("click", handleRemove);

    li.appendChild(span);
    li.appendChild(removeButton);
    listElement.appendChild(li);
  });
}

/**
 * Saves the current state of the `currentWhitelist` array to chrome.storage.local.
 */
async function saveWhitelist() {
  log("Attempting to save whitelist:", currentWhitelist);
  try {
    // Use await for cleaner async handling with storage.local
    await chrome.storage.local.set({ whitelistDomains: currentWhitelist });
    log("Whitelist saved successfully.");
    showStatus("Whitelist saved!");
    // No need to re-render here unless save modifies the array, which it shouldn't
  } catch (error) {
    errorLog("Error saving whitelist:", error);
    showStatus(`Error saving list: ${error.message}`, true);
  }
}

/**
 * Processes and validates the domain input value.
 * @param {string} rawInput - The raw value from the input field.
 * @returns {string|null} - The cleaned domain name (lowercase, no protocol/path, no www.) or null if invalid.
 */
function cleanDomainInput(rawInput) {
  let domain = rawInput.trim().toLowerCase();
  if (!domain) return null;

  // Remove protocol if present
  if (domain.startsWith("http://")) domain = domain.substring(7);
  if (domain.startsWith("https://")) domain = domain.substring(8);

  // Remove path if present
  const slashIndex = domain.indexOf("/");
  if (slashIndex !== -1) {
    domain = domain.substring(0, slashIndex);
  }

  // Remove 'www.' prefix
  if (domain.startsWith("www.")) {
    domain = domain.substring(4);
  }

  // Basic validation: must contain a dot and no spaces, not be empty
  if (
    domain.indexOf(".") === -1 ||
    domain.indexOf(" ") !== -1 ||
    domain === ""
  ) {
    log(
      `Invalid domain format after cleaning: ${domain} (Original: ${rawInput})`
    );
    return null; // Invalid format
  }

  return domain;
}

/**
 * Handles the click event for the "Add Domain" button or Enter key press.
 */
function handleAdd() {
  if (!inputElement || !addButton) return;
  log("Handle Add triggered.");
  const originalValue = inputElement.value;
  const domainToAdd = cleanDomainInput(originalValue);

  if (!domainToAdd) {
    showStatus(
      `Invalid domain format: "${originalValue}". Use format like 'example.com'`,
      true
    );
    return;
  }

  if (currentWhitelist.includes(domainToAdd)) {
    showStatus(`Domain "${domainToAdd}" is already whitelisted.`, true);
  } else {
    log(`Adding domain: ${domainToAdd}`);
    // Add to the local array first
    currentWhitelist.push(domainToAdd);
    // Re-render the list immediately for responsiveness
    renderWhitelist();
    // Clear the input field
    inputElement.value = "";
    // Save the updated list to storage
    saveWhitelist(); // This function now shows status on success/failure
  }
}

/**
 * Handles the click event for a "Remove" button next to a domain.
 * @param {Event} event - The click event object.
 */
function handleRemove(event) {
  const button = event.target;
  const domainToRemove = button.dataset.domain; // Get domain from data attribute

  if (!domainToRemove) {
    errorLog(
      "Remove handler: Could not find domain to remove in button dataset."
    );
    return;
  }

  log(`Attempting to remove domain: ${domainToRemove}`);
  // Filter out the domain from the local array
  currentWhitelist = currentWhitelist.filter((d) => d !== domainToRemove);
  // Re-render the list immediately
  renderWhitelist();
  // Save the updated list to storage
  saveWhitelist();
}

// --- Initialization ---

/**
 * Loads the whitelist from storage and initializes the options page UI.
 */
async function initializeOptionsPage() {
  log("Initializing options page...");
  if (!listElement) {
    // Check if list element exists before proceeding
    errorLog("Cannot initialize options page: listElement not found.");
    return;
  }

  listElement.innerHTML = "<li>Loading whitelist...</li>"; // Initial loading message

  try {
    const data = await chrome.storage.local.get({ whitelistDomains: [] });
    if (chrome.runtime.lastError) {
      // Check for runtime errors after storage access
      throw new Error(chrome.runtime.lastError.message);
    }
    currentWhitelist = data.whitelistDomains || [];
    log("Whitelist loaded:", currentWhitelist);
    renderWhitelist(); // Render the loaded list

    // Add event listeners only after ensuring elements exist and list is loaded
    if (addButton && inputElement) {
      addButton.addEventListener("click", handleAdd);
      inputElement.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
          handleAdd();
        }
      });
      log("Add button and input listeners attached.");
    } else {
      errorLog(
        "Could not attach listeners: Add button or input element missing."
      );
    }
  } catch (error) {
    errorLog("Error loading whitelist:", error);
    listElement.innerHTML = `<li>Error loading whitelist: ${error.message}</li>`;
    listElement.style.color = "red";
    // Disable add functionality if loading failed?
    if (addButton) addButton.disabled = true;
    if (inputElement) inputElement.disabled = true;
  }
}

// Start initialization when the DOM is ready
document.addEventListener("DOMContentLoaded", initializeOptionsPage);
