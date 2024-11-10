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

      await browserAPI.storage.local.set({
        safeSites,
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

// Fetch all lists based on frequency
async function fetchAllLists() {
  console.log("Fetching all lists...");
  try {
    const { lastFetched } = await browserAPI.storage.local.get("lastFetched");
    const { updateFrequency } = await browserAPI.storage.sync.get({
      updateFrequency: "daily",
    });

    const now = new Date();
    const lastFetchDate = lastFetched ? new Date(lastFetched) : null;
    const diffHours = lastFetchDate
      ? (now - lastFetchDate) / (1000 * 60 * 60)
      : Infinity;

    const hoursThreshold =
      {
        daily: 24,
        weekly: 168,
        monthly: 720,
      }[updateFrequency] || 24;

    if (diffHours < hoursThreshold) {
      console.log("Update frequency threshold not met. Skipping fetch.");
      return;
    }

    await Promise.all([
      fetchFilterLists(),
      fetchSafeSites(),
      fetchStarredSites(),
    ]);
    await browserAPI.storage.local.set({ lastFetched: now.toISOString() });
    console.log("All lists fetched and lastFetched timestamp updated.");
  } catch (error) {
    console.error("Error fetching all lists:", error);
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
  if (!url) {
    updatePageAction("default", tabId);
    return;
  }

  const normalizedUrl = normalizeUrl(url.trim());
  const rootUrl = extractRootUrl(normalizedUrl);

  const isExtensionPage =
    url.includes(browserAPI.runtime.getURL("pub/warning-page.html")) ||
    url.includes(browserAPI.runtime.getURL("pub/settings-page.html")) ||
    url.includes(browserAPI.runtime.getURL("pub/welcome-page.html"));

  if (isExtensionPage) {
    updatePageAction("extension_page", tabId);
    return;
  }

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
async function setupUpdateSchedule() {
  await browserAPI.alarms.clearAll();
  browserAPI.alarms.create("checkUpdate", { periodInMinutes: 60 });
}

browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkUpdate") {
    await fetchAllLists();
  }
});

// Initialize extension
async function initializeExtension() {
  try {
    const storedData = await browserAPI.storage.local.get([
      "unsafeSites",
      "potentiallyUnsafeSites",
      "fmhySites",
      "safeSites",
    ]);

    if (storedData.unsafeSites) {
      unsafeSitesRegex = generateRegexFromList(storedData.unsafeSites);
    } else {
      await fetchFilterLists();
    }

    if (storedData.safeSites) {
      safeSites = storedData.safeSites;
    } else {
      await fetchSafeSites();
    }

    if (storedData.fmhySites) {
      fmhySitesRegex = generateRegexFromList(storedData.fmhySites);
    } else {
      await fetchFilterLists();
    }

    await setupUpdateSchedule();
    console.log("Extension initialized successfully.");
  } catch (error) {
    console.error("Error during extension initialization:", error);
  }
}

// Event Listeners
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    return true;
  }
});

async function openWarningPage(tabId, unsafeUrl) {
  const normalizedUrl = normalizeUrl(unsafeUrl);
  const tabApprovedUrls = approvedUrls.get(tabId) || [];

  if (tabApprovedUrls.includes(normalizedUrl)) {
    console.log(`URL ${unsafeUrl} was already approved for tab ${tabId}`);
    return;
  }

  const { warningPage } = await browserAPI.storage.sync.get({
    warningPage: true,
  });

  if (!warningPage) {
    console.log("Warning page is disabled by the user settings.");
    return;
  }

  const warningPageUrl = browserAPI.runtime.getURL(
    `../pub/warning-page.html?url=${encodeURIComponent(unsafeUrl)}`
  );
  browserAPI.tabs.update(tabId, { url: warningPageUrl });
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "approveSite") {
    const { tabId, url } = message;
    const normalizedUrl = normalizeUrl(url);

    if (tabId && normalizedUrl) {
      let tabApprovedUrls = approvedUrls.get(tabId) || [];
      if (!tabApprovedUrls.includes(normalizedUrl)) {
        tabApprovedUrls.push(normalizedUrl);
        approvedUrls.set(tabId, tabApprovedUrls);
      }
      console.log(`Approval stored for ${url} in tab ${tabId}`);
      sendResponse({ status: "approved" });
    }
  }
  return true;
});

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "settingsUpdated") {
    console.log(
      "Received settingsUpdated message in background script:",
      message.settings
    );

    sendResponse({ status: "Settings updated successfully" });
    return true;
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

browserAPI.tabs.onRemoved.addListener((tabId) => {
  approvedUrls.delete(tabId);
  browserAPI.storage.local.remove(`proceedTab_${tabId}`);
});

initializeExtension();
