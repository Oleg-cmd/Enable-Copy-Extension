// src/background/whitelistManager.js

import {
  log,
  errorLog,
  getRelevantHostname,
  isHostnameWhitelisted,
} from "../shared/utils.js";

let cachedWhitelist = [];
let isWhitelistLoaded = false;

/**
 * Loads the whitelist from chrome.storage.local into the cache.
 * @returns {Promise<void>}
 */
export async function loadWhitelist() {
  try {
    const result = await chrome.storage.local.get({ whitelistDomains: [] });
    cachedWhitelist = result.whitelistDomains || [];
    isWhitelistLoaded = true;
    log("Whitelist loaded/reloaded:", cachedWhitelist);
  } catch (error) {
    errorLog("Failed to load whitelist:", error);
    if (!isWhitelistLoaded) cachedWhitelist = []; // Initialize if first load failed
    isWhitelistLoaded = false;
  }
}

/**
 * Checks if a given URL's hostname is in the cached whitelist.
 * Ensures the whitelist is loaded before checking.
 * @param {string | null | undefined} urlString - The URL to check.
 * @returns {Promise<boolean>} - True if the hostname is whitelisted.
 */
export async function checkUrlAgainstWhitelist(urlString) {
  if (!isWhitelistLoaded) {
    log("Whitelist not loaded yet, loading now before check...");
    await loadWhitelist();
  }
  if (!isWhitelistLoaded) {
    errorLog("Whitelist check failed because loading failed.");
    return false; // Cannot determine if load failed
  }

  const hostname = getRelevantHostname(urlString);
  return isHostnameWhitelisted(hostname, cachedWhitelist);
}

/**
 * Adds a domain to the whitelist cache and saves it to storage.
 * @param {string} domain - The domain name to add (should be pre-processed if needed).
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function addDomainToWhitelist(domain) {
  if (!domain) return { success: false, error: "Domain is empty" };
  if (!isWhitelistLoaded) await loadWhitelist(); // Ensure cache is ready

  const cleanedDomain = domain.trim().toLowerCase(); // Basic cleaning
  if (cleanedDomain === "")
    return { success: false, error: "Domain is empty after trimming" };

  if (!cachedWhitelist.includes(cleanedDomain)) {
    // Create a new array for the update to avoid mutation issues if save fails
    const updatedWhitelist = [...cachedWhitelist, cleanedDomain];
    try {
      await chrome.storage.local.set({ whitelistDomains: updatedWhitelist });
      cachedWhitelist = updatedWhitelist; // Update cache only on successful save
      log(`Added ${cleanedDomain} to whitelist.`);
      return { success: true };
    } catch (error) {
      errorLog("Error saving updated whitelist:", error);
      return { success: false, error: error.message };
    }
  } else {
    log(`Domain ${cleanedDomain} already in whitelist.`);
    return { success: true, message: "Already whitelisted" };
  }
}

/**
 * Removes a domain from the whitelist cache and saves it to storage.
 * @param {string} domain - The domain name to remove.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeDomainFromWhitelist(domain) {
  if (!domain) return { success: false, error: "Domain is empty" };
  if (!isWhitelistLoaded) await loadWhitelist();

  const cleanedDomain = domain.trim().toLowerCase();
  if (!cachedWhitelist.includes(cleanedDomain)) {
    log(`Domain ${cleanedDomain} not found in whitelist for removal.`);
    return { success: true, message: "Domain not found" }; // Considered success
  }

  const updatedWhitelist = cachedWhitelist.filter((d) => d !== cleanedDomain);
  try {
    await chrome.storage.local.set({ whitelistDomains: updatedWhitelist });
    cachedWhitelist = updatedWhitelist; // Update cache on success
    log(`Removed ${cleanedDomain} from whitelist.`);
    return { success: true };
  } catch (error) {
    errorLog("Error saving updated whitelist after removal:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets the current cached whitelist. Ensures it's loaded first.
 * @returns {Promise<string[]>}
 */
export async function getWhitelist() {
  if (!isWhitelistLoaded) {
    await loadWhitelist();
  }
  // Return a copy to prevent external mutation
  return [...cachedWhitelist];
}
