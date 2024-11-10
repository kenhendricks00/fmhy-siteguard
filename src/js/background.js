// Cross-browser compatibility shim
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// URLs and Constants
const filterListURLUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist.txt";
const filterListURLPotentiallyUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist-plus.txt";
const safeListURL = "https://api.fmhy.net/single-page";
const starredListURL =
  "https://raw.githubusercontent.com/fmhy/bookmarks/refs/heads/main/fmhy_in_bookmarks_starred_only.html";
const fmhyFilterListURL =
  "https://raw.githubusercontent.com/fmhy/FMHY-SafeGuard/refs/heads/main/fmhy-filterlist.txt";

// State Variables
let unsafeSitesRegex = null;
let potentiallyUnsafeSitesRegex = null;
let fmhySitesRegex = null;
let safeSites = [];
let starredSites = [];
const approvedUrls = new Map(); // Map to store approved URLs per tab

// Helper Functions
function extractUrlsFromMarkdown(markdown) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return markdown.match(urlRegex) || [];
}

function extractUrlsFromBookmarks(html) {
  const urlRegex = /<A HREF="(https?:\/\/[^\s"]+)"/g;
  let matches;
  const urls = [];
  while ((matches = urlRegex.exec(html)) !== null) {
    urls.push(matches[1]);
  }
  return urls;
}

function normalizeUrl(url) {
  if (!url) {
    console.warn("Received null or undefined URL.");
    return null;
  }

  try {
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const urlObj = new URL(url);
    urlObj.search = "";
    urlObj.hash = "";
    return urlObj.href.replace(/\/+$/, "");
  } catch (error) {
    console.warn(`Invalid URL skipped: ${url}`);
    return null;
  }
}

function extractRootUrl(url) {
  if (!url) {
    console.warn("Received null or undefined URL for root extraction.");
    return null;
  }

  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (error) {
    console.warn(`Failed to extract root URL from: ${url}`);
    return null;
  }
}

function generateRegexFromList(list) {
  const escapedList = list.map((domain) =>
    domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`(${escapedList.join("|")})`, "i");
}

function extractUrlsFromFilterList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("!"))
    .map((line) => normalizeUrl(line))
    .filter((url) => url !== null);
}

// Fetch and Update Functions
async function fetchFilterLists() {
  console.log("Fetching filter lists...");
  try {
    const [unsafeResponse, potentiallyUnsafeResponse, fmhyResponse] =
      await Promise.all([
        fetch(filterListURLUnsafe),
        fetch(filterListURLPotentiallyUnsafe),
        fetch(fmhyFilterListURL),
      ]);

    let unsafeSites = [];
    let potentiallyUnsafeSites = [];
    let fmhySites = [];

    if (unsafeResponse.ok) {
      const unsafeText = await unsafeResponse.text();
      unsafeSites = extractUrlsFromFilterList(unsafeText);
      unsafeSitesRegex = generateRegexFromList(unsafeSites);
    }

    if (potentiallyUnsafeResponse.ok) {
      const potentiallyUnsafeText = await potentiallyUnsafeResponse.text();
      potentiallyUnsafeSites = extractUrlsFromFilterList(potentiallyUnsafeText);
      potentiallyUnsafeSitesRegex = generateRegexFromList(
        potentiallyUnsafeSites
      );
    }

    if (fmhyResponse.ok) {
      const fmhyText = await fmhyResponse.text();
      fmhySites = extractUrlsFromFilterList(fmhyText);
      fmhySitesRegex = generateRegexFromList(fmhySites);
    }

    await browserAPI.storage.local.set({
      unsafeSites,
      potentiallyUnsafeSites,
      fmhySites,
      unsafeFilterCount: unsafeSites.length,
      potentiallyUnsafeFilterCount: potentiallyUnsafeSites.length,
      fmhyFilterCount: fmhySites.length,
      lastUpdated: new Date().toISOString(),
    });

    console.log("Filter lists fetched and stored successfully.");

    notifySettingsPage();
  } catch (error) {
    console.error("Error fetching filter lists:", error);
  }
}

async function fetchSafeSites() {
  console.log("Fetching safe sites...");
  try {
    const response = await fetch(safeListURL);
    if (response.ok) {
      const markdown = await response.text();
      const urls = extractUrlsFromMarkdown(markdown);
      safeSites = [...new Set(urls.map((url) => normalizeUrl(url.trim())))];

      await browserAPI.storage.local.set({
        safeSiteCount: safeSites.length,
      });

      console.log("Stored safe site count:", safeSites.length);
    }
  } catch (error) {
    console.error("Error fetching safe sites:", error);
  }
}

async function fetchStarredSites() {
  console.log("Fetching starred sites...");
  try {
    const response = await fetch(starredListURL);
    if (response.ok) {
      const html = await response.text();
      const urls = extractUrlsFromBookmarks(html);
      starredSites = [...new Set([...urls.map(normalizeUrl), ...starredSites])];
    }
  } catch (error) {
    console.error("Error fetching starred sites:", error);
  }
}

// UI Update Functions
function updatePageAction(status, tabId) {
  const icons = {
    safe: {
      19: "../res/icons/safe_19.png",
      38: "../res/icons/safe_38.png",
    },
    unsafe: {
      19: "../res/icons/unsafe_19.png",
      38: "../res/icons/unsafe_38.png",
    },
    potentially_unsafe: {
      19: "../res/icons/potentially_unsafe_19.png",
      38: "../res/icons/potentially_unsafe_38.png",
    },
    starred: {
      19: "../res/icons/starred_19.png",
      38: "../res/icons/starred_38.png",
    },
    fmhy: {
      19: "../res/icons/fmhy_19.png",
      38: "../res/icons/fmhy_38.png",
    },
    extension_page: {
      19: "../res/ext_icon_144.png",
      38: "../res/ext_icon_144.png",
    },
    default: {
      19: "../res/icons/default_19.png",
      38: "../res/icons/default_38.png",
    },
  };

  const icon = icons[status] || icons["default"];

  browserAPI.action.setIcon({
    tabId: tabId,
    path: icon,
  });
}

async function notifySettingsPage() {
  const tabs = await browserAPI.tabs.query({});
  for (const tab of tabs) {
    try {
      await browserAPI.tabs.sendMessage(tab.id, { type: "filterlistUpdated" });
    } catch (e) {
      // Ignore errors for tabs that can't receive messages
    }
  }
}

// Site Status Checking
function checkSiteAndUpdatePageAction(tabId, url) {
  console.log(
    `checkSiteAndUpdatePageAction: Checking status for ${url} on tab ${tabId}`
  );

  if (!url) {
    updatePageAction("default", tabId);
    return;
  }

  const normalizedUrl = normalizeUrl(url.trim());
  const rootUrl = extractRootUrl(normalizedUrl);

  // Detect if the URL is an internal extension page
  const warningPageUrl = browserAPI.runtime.getURL("pub/warning-page.html");
  if (url.startsWith(warningPageUrl)) {
    // Skip if already on the warning page to avoid looping
    updatePageAction("extension_page", tabId);
    return;
  }

  // Check if the full URL is starred or has a specific status
  let status = getStatusFromLists(normalizedUrl);
  let matchedUrl = normalizedUrl;

  // If no specific match for the full URL, check the root URL
  if (status === "no_data") {
    status = getStatusFromLists(rootUrl);
    matchedUrl = rootUrl;
  }

  // Apply the correct icon status to the tab
  updatePageAction(status, tabId);

  // Handle unsafe sites that need warning page redirection if not approved
  if (status === "unsafe" && !approvedUrls.get(tabId)?.includes(rootUrl)) {
    openWarningPage(tabId, rootUrl);
  }
}

// Update Schedule Management
async function shouldUpdate() {
  try {
    const { lastUpdated } = await browserAPI.storage.local.get("lastUpdated");
    const { updateFrequency = "daily" } = await browserAPI.storage.sync.get({
      updateFrequency: "daily",
    });

    if (!lastUpdated) return true;

    const lastUpdate = new Date(lastUpdated);
    const now = new Date();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

    if (updateFrequency === "daily") {
      return diffHours >= 24;
    } else if (updateFrequency === "weekly") {
      return diffHours >= 168;
    } else if (updateFrequency === "monthly") {
      return diffHours >= 720;
    }
    return false;
  } catch (error) {
    console.error("Error checking update schedule:", error);
    return false;
  }
}

async function setupUpdateSchedule() {
  await browserAPI.alarms.clearAll();

  // Get the user's preferred update frequency from storage
  const { updateFrequency } = await browserAPI.storage.sync.get({
    updateFrequency: "daily",
  });

  // Determine period in minutes based on selected frequency
  let periodInMinutes;
  switch (updateFrequency) {
    case "weekly":
      periodInMinutes = 10080; // 7 days in minutes
      break;
    case "monthly":
      periodInMinutes = 43200; // 30 days in minutes
      break;
    default:
      periodInMinutes = 1440; // 24 hours in minutes for daily updates
  }

  // Create the alarm based on calculated period
  browserAPI.alarms.create("checkUpdate", {
    periodInMinutes: periodInMinutes,
  });
}

// Event Listeners
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkSiteStatus") {
    const { url, rootUrl } = message;

    // Attempt to match with the full URL first (for specific paths)
    let status = getStatusFromLists(url);
    let matchedUrl = url;

    // If no specific match, try the root URL
    if (status === "no_data") {
      status = getStatusFromLists(rootUrl);
      matchedUrl = rootUrl;
    }

    sendResponse({ status, matchedUrl });
    return true;
  }
});

function getStatusFromLists(url) {
  if (unsafeSitesRegex?.test(url)) return "unsafe";
  if (potentiallyUnsafeSitesRegex?.test(url)) return "potentially_unsafe";
  if (fmhySitesRegex?.test(url)) return "fmhy";
  if (starredSites.includes(url)) return "starred";
  if (safeSites.includes(url)) return "safe";
  return "no_data";
}

async function openWarningPage(tabId, unsafeUrl) {
  const normalizedUrl = normalizeUrl(unsafeUrl);
  const tabApprovedUrls = approvedUrls.get(tabId) || [];

  // Check if URL has already been approved for this tab to avoid loop
  if (tabApprovedUrls.includes(normalizedUrl)) {
    console.log(`URL ${unsafeUrl} was already approved for tab ${tabId}`);
    return;
  }

  // Fetch the warning page setting
  const { warningPage } = await browserAPI.storage.sync.get({
    warningPage: true,
  });

  if (!warningPage) {
    console.log("Warning page is disabled by the user settings.");
    return;
  }

  // Add temporary approval to avoid repeated redirection
  tabApprovedUrls.push(normalizedUrl);
  approvedUrls.set(tabId, tabApprovedUrls);

  // Redirect to the warning page if it is enabled in settings
  const warningPageUrl = browserAPI.runtime.getURL(
    `../pub/warning-page.html?url=${encodeURIComponent(unsafeUrl)}`
  );
  browserAPI.tabs.update(tabId, { url: warningPageUrl });
}

// Add listener for approval from the warning page
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "approveSite") {
    const { tabId, url } = message;
    const rootUrl = extractRootUrl(url);

    // Fetch existing approved URLs from storage
    browserAPI.storage.local.get("approvedUrls", (result) => {
      const approvedUrls = result.approvedUrls || [];

      // Add the root URL if not already approved
      if (!approvedUrls.includes(rootUrl)) {
        approvedUrls.push(rootUrl);
        browserAPI.storage.local.set({ approvedUrls });
        console.log(`approveSite: ${rootUrl} approved globally.`);
      }

      // Set the toolbar icon to "unsafe" immediately
      updatePageAction("unsafe", tabId);
      sendResponse({ status: "approved" });
    });
  }
  return true;
});

// Listen for settings updates from the settings page
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "settingsUpdated") {
    setupUpdateSchedule(); // Adjust update schedule based on new settings
    sendResponse({ status: "Settings updated successfully" });
    return true; // Indicates asynchronous response handling
  }
});

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkSiteAndUpdatePageAction(tabId, tab.url);
  }
});

browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browserAPI.tabs.get(activeInfo.tabId);
  if (tab.url) {
    checkSiteAndUpdatePageAction(tab.id, tab.url);
  }
});

browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkUpdate") {
    const needsUpdate = await shouldUpdate();
    if (needsUpdate) {
      await fetchFilterLists();
    }
  }
});

browserAPI.tabs.onRemoved.addListener((tabId) => {
  approvedUrls.delete(tabId);
  browserAPI.storage.local.remove(`proceedTab_${tabId}`);
});

// Initialize extension
async function initializeExtension() {
  try {
    const {
      unsafeFilterCount,
      potentiallyUnsafeFilterCount,
      fmhyFilterCount,
      unsafeSites,
      potentiallyUnsafeSites,
      fmhySites,
    } = await browserAPI.storage.local.get([
      "unsafeFilterCount",
      "potentiallyUnsafeFilterCount",
      "fmhyFilterCount",
      "unsafeSites",
      "potentiallyUnsafeSites",
      "fmhySites",
    ]);

    // Check if data is available in storage and load it into memory
    if (unsafeSites && potentiallyUnsafeSites && fmhySites) {
      unsafeSitesRegex = generateRegexFromList(unsafeSites);
      potentiallyUnsafeSitesRegex = generateRegexFromList(
        potentiallyUnsafeSites
      );
      fmhySitesRegex = generateRegexFromList(fmhySites);
      console.log("Loaded filter lists from storage.");
    } else {
      // If data isn't in storage, fetch it
      await fetchFilterLists();
    }

    // Fetch safe and starred sites, and set up the update schedule
    await fetchSafeSites();
    await fetchStarredSites();
    await setupUpdateSchedule();

    console.log("Extension initialized successfully.");
  } catch (error) {
    console.error("Error during extension initialization:", error);
  }
}

initializeExtension();
