// URLs and Constants
const filterListURLUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist.txt";
const filterListURLPotentiallyUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist-plus.txt";
const safeListURL = "https://api.fmhy.net/single-page";
const starredListURL =
  "https://raw.githubusercontent.com/fmhy/bookmarks/refs/heads/main/fmhy_in_bookmarks_starred_only.html";
const fmhyFilterListURL =
  "https://raw.githubusercontent.com/kenhendricks00/FMHY-SafeGuard/refs/heads/main/fmhy-filterlist.txt";
const DEFAULT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

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

    chrome.storage.local.set({
      unsafeFilterCount: unsafeSites.length,
      potentiallyUnsafeFilterCount: potentiallyUnsafeSites.length,
      fmhyFilterCount: fmhySites.length,
      lastUpdated: new Date().toISOString(),
    });

    console.log("Stored FMHY filter count:", fmhySites.length);

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

      chrome.storage.local.set({
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
    default: {
      19: "../res/icons/default_19.png",
      38: "../res/icons/default_38.png",
    },
  };

  const icon = icons[status] || icons["default"];

  chrome.action.setIcon({
    tabId: tabId,
    path: icon,
  });
}

function notifySettingsPage() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: "filterlistUpdated" }, () => {
        if (chrome.runtime.lastError) {
          // Ignore errors for tabs that can't receive messages
        }
      });
    }
  });
}

// Site Status Checking
function checkSiteAndUpdatePageAction(tabId, url) {
  if (!url) {
    updatePageAction("default", tabId);
    return;
  }

  const normalizedUrl = normalizeUrl(url.trim());
  const rootUrl = extractRootUrl(normalizedUrl);

  const isUnsafe =
    unsafeSitesRegex?.test(rootUrl) || unsafeSitesRegex?.test(normalizedUrl);
  const isPotentiallyUnsafe =
    potentiallyUnsafeSitesRegex?.test(rootUrl) ||
    potentiallyUnsafeSitesRegex?.test(normalizedUrl);
  const isFMHY =
    fmhySitesRegex?.test(rootUrl) || fmhySitesRegex?.test(normalizedUrl);
  const isStarred =
    starredSites.includes(rootUrl) || starredSites.includes(normalizedUrl);
  const isSafe =
    safeSites.includes(rootUrl) || safeSites.includes(normalizedUrl);

  const tabApprovedUrls = approvedUrls.get(tabId) || [];
  const isApproved = tabApprovedUrls.includes(normalizedUrl);

  if (isUnsafe && !isApproved) {
    updatePageAction("unsafe", tabId);
    openWarningPage(tabId, url);
  } else if (isPotentiallyUnsafe) {
    updatePageAction("potentially_unsafe", tabId);
  } else if (isFMHY) {
    updatePageAction("fmhy", tabId);
  } else if (isStarred) {
    updatePageAction("starred", tabId);
  } else if (isSafe) {
    updatePageAction("safe", tabId);
  } else {
    updatePageAction("default", tabId);
  }
}

// Update Schedule Management
function shouldUpdate(callback) {
  chrome.storage.local.get("lastUpdated", ({ lastUpdated }) => {
    chrome.storage.sync.get(
      { updateFrequency: "daily" },
      ({ updateFrequency }) => {
        if (!lastUpdated) return callback(true);

        const lastUpdate = new Date(lastUpdated);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

        let needsUpdate = false;
        switch (updateFrequency) {
          case "daily":
            needsUpdate = diffHours >= 24;
            break;
          case "weekly":
            needsUpdate = diffHours >= 168;
            break;
          case "monthly":
            needsUpdate = diffHours >= 720;
            break;
        }
        callback(needsUpdate);
      }
    );
  });
}

function setupUpdateSchedule() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create("checkUpdate", {
      periodInMinutes: 60,
    });
  });
}

// Event Listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkSiteStatus") {
    const normalizedUrl = normalizeUrl(message.url.trim());
    const rootUrl = extractRootUrl(normalizedUrl);

    let isUnsafe =
      unsafeSitesRegex?.test(rootUrl) || unsafeSitesRegex?.test(normalizedUrl);
    let isPotentiallyUnsafe =
      potentiallyUnsafeSitesRegex?.test(rootUrl) ||
      potentiallyUnsafeSitesRegex?.test(normalizedUrl);
    let isFMHY =
      fmhySitesRegex?.test(rootUrl) || fmhySitesRegex?.test(normalizedUrl);
    let isStarred =
      starredSites.includes(rootUrl) || starredSites.includes(normalizedUrl);
    let isSafe =
      safeSites.includes(rootUrl) || safeSites.includes(normalizedUrl);

    let status = "no_data";
    if (isFMHY) {
      status = "fmhy";
    } else if (isStarred) {
      status = "starred";
    } else if (isUnsafe) {
      status = "unsafe";
    } else if (isPotentiallyUnsafe) {
      status = "potentially_unsafe";
    } else if (isSafe) {
      status = "safe";
    }

    sendResponse({ status: status });
    return true; // Indicates asynchronous response handling
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.type === "settingsUpdated") {
    // Process the updated settings
    console.log("Settings updated:", message.settings);

    // Send a response back
    sendResponse({ success: true });
  } else {
    // Handle other message types
    console.log("Unknown message type:", message.type);
  }

  return true; // Indicates that we will send a response asynchronously
});

function openWarningPage(tabId, unsafeUrl) {
  const tabApprovedUrls = approvedUrls.get(tabId) || [];
  if (tabApprovedUrls.includes(normalizeUrl(unsafeUrl))) {
    console.log(`URL ${unsafeUrl} was already approved for tab ${tabId}`);
    return;
  }

  chrome.storage.sync.get({ warningPage: true }, ({ warningPage }) => {
    if (!warningPage) {
      console.log("Warning page is disabled by the user settings.");
      return;
    }

    const warningPageUrl = chrome.runtime.getURL(
      `../pub/warning-page.html?url=${encodeURIComponent(unsafeUrl)}`
    );
    chrome.tabs.update(tabId, { url: warningPageUrl });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkSiteAndUpdatePageAction(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkSiteAndUpdatePageAction(tab.id, tab.url);
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkUpdate") {
    shouldUpdate((needsUpdate) => {
      if (needsUpdate) {
        fetchFilterLists();
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  approvedUrls.delete(tabId);
  chrome.storage.local.remove(`proceedTab_${tabId}`);
});

// Initialize extension
function initializeExtension() {
  try {
    Promise.all([
      fetchFilterLists(),
      fetchSafeSites(),
      fetchStarredSites(),
    ]).then(() => {
      setupUpdateSchedule();
      console.log("Extension initialized successfully.");
    });
  } catch (error) {
    console.error("Error during extension initialization:", error);
  }
}

initializeExtension();
