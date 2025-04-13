// src/shared/utils.js
export const STATE = Object.freeze({
  DISABLED: "disabled",
  STANDARD_ACTIVE: "standard_active",
  FORCE_ACTIVE: "force_active",
  UNKNOWN: "unknown",
});

// Determine if running in development mode (basic check)
// A more robust way might involve environment variables set by Webpack mode
const isDevModeShared = process.env.NODE_ENV !== "production";

export function log(...args) {
  if (isDevModeShared) {
    console.log("EnableCopyExtension:", ...args);
  }
}

export function errorLog(...args) {
  // Always log errors, but maybe add more detail in dev?
  console.error("EnableCopyExtension ERROR:", ...args);
}

// Basic IP Address Regex (v4 and simplified v6) - use this if 'net' isn't available
const basicIpRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^\[?[a-fA-F0-9:]+\]?$/;
function isIP(str) {
  return basicIpRegex.test(str);
}

export function getRelevantHostname(urlString) {
  if (!urlString || typeof urlString !== "string") return null; // Added type check
  try {
    // Add a default protocol if missing, required by URL constructor for hostnames
    let urlToParse = urlString;
    if (
      !urlToParse.startsWith("http://") &&
      !urlToParse.startsWith("https://")
    ) {
      // Simple check: if it looks like a domain, add http://
      // This isn't perfect but covers many cases. Avoid adding to about:, chrome:, etc.
      if (urlToParse.includes(".") && !urlToParse.includes(":")) {
        urlToParse = "http://" + urlToParse;
      } else {
        // If it contains ':' or no '.', it's likely not a standard hostname URL
        log(
          `getRelevantHostname: Skipping protocol addition for potentially non-http URL: ${urlString}`
        );
        return null; // Treat as non-parseable for hostname extraction
      }
    }

    const url = new URL(urlToParse);
    let hostname = url.hostname; // Get hostname (should be lowercase already)

    // Check for null, empty hostname, or IP addresses (which we might want to ignore or handle differently)
    if (!hostname || hostname === "" || isIP(hostname)) {
      // Added IP check
      log(
        `getRelevantHostname: Invalid or IP hostname found: ${hostname} from ${urlString}`
      );
      return null;
    }

    // Convert to lowercase just in case and remove 'www.'
    hostname = hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Final check - ensure it still looks like a valid domain structure after cleaning
    if (!hostname.includes(".")) {
      log(
        `getRelevantHostname: Hostname invalid after cleaning: ${hostname} from ${urlString}`
      );
      return null;
    }

    // log(`getRelevantHostname: Parsed ${urlString} to ${hostname}`); // Optional success log
    return hostname;
  } catch (e) {
    // Catch errors from new URL() constructor for invalid inputs
    errorLog(`Utils: Could not parse URL '${urlString}' to get hostname:`, e);
    return null;
  }
}

export function isHostnameWhitelisted(hostnameToCheck, whitelist) {
  if (!hostnameToCheck || !Array.isArray(whitelist) || whitelist.length === 0) {
    return false;
  }
  // Ensure whitelist domains are also processed (e.g., lowercase, no www.) if needed,
  // assuming they are stored correctly processed.
  return whitelist.some(
    (whitelistedDomain) =>
      hostnameToCheck === whitelistedDomain ||
      hostnameToCheck.endsWith("." + whitelistedDomain)
  );
}
