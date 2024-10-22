const filterListURLUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist.txt";
const filterListURLPotentiallyUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist-plus.txt";
const safeListURL = "https://api.fmhy.net/single-page";
const starredListURL =
  "https://raw.githubusercontent.com/fmhy/bookmarks/refs/heads/main/fmhy_in_bookmarks_starred_only.html";

let unsafeSites = [];
let potentiallyUnsafeSites = [];
let safeSites = [];
let starredSites = ["https://fmhy.net"];

// Helper function to extract URLs from markdown text
function extractUrlsFromMarkdown(markdown) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return markdown.match(urlRegex) || [];
}

// Helper function to extract URLs from HTML bookmarks
function extractUrlsFromBookmarks(html) {
  const urlRegex = /<A HREF="(https?:\/\/[^\s"]+)"/g;
  let matches;
  const urls = [];
  while ((matches = urlRegex.exec(html)) !== null) {
    urls.push(matches[1]);
  }
  return urls;
}

// Helper function to normalize URLs (removes trailing slashes and "www.")
function normalizeUrl(url) {
  return url.replace(/\/+$/, "").replace(/^https?:\/\/www\./, "https://"); // Remove trailing slash if exists and "www." if present
}

// New helper function to extract root domain from URL
function extractRootUrl(url) {
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.hostname}`; // Extract protocol and hostname
}

// Fetch the unsafe and potentially unsafe filter lists
async function fetchFilterLists() {
  console.log("Fetching filter lists...");

  try {
    const [unsafeResponse, potentiallyUnsafeResponse] = await Promise.all([
      fetch(filterListURLUnsafe),
      fetch(filterListURLPotentiallyUnsafe),
    ]);

    if (unsafeResponse.ok) {
      const unsafeText = await unsafeResponse.text();
      unsafeSites = unsafeText
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    }

    if (potentiallyUnsafeResponse.ok) {
      const potentiallyUnsafeText = await potentiallyUnsafeResponse.text();
      potentiallyUnsafeSites = potentiallyUnsafeText
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    }

    console.log("Parsed Unsafe Sites:", unsafeSites);
    console.log("Parsed Potentially Unsafe Sites:", potentiallyUnsafeSites);
  } catch (error) {
    console.error("Error fetching filter lists:", error);
  }
}

// Fetch the safe sites
async function fetchSafeSites() {
  console.log("Fetching safe sites...");
  try {
    const response = await fetch(safeListURL);
    if (response.ok) {
      const markdown = await response.text();
      const urls = extractUrlsFromMarkdown(markdown);
      urls.forEach((siteUrl) => {
        let fullUrl = normalizeUrl(siteUrl.trim());
        if (!safeSites.includes(fullUrl)) {
          safeSites.push(fullUrl);
        }
      });
    }
    console.log("Parsed Safe Sites:", safeSites);
  } catch (error) {
    console.error("Error fetching safe sites:", error);
  }
}

// Fetch the starred sites
async function fetchStarredSites() {
  console.log("Fetching starred sites...");
  try {
    const response = await fetch(starredListURL);
    if (response.ok) {
      const html = await response.text();
      const urls = extractUrlsFromBookmarks(html);

      // Normalize and add URLs to the starredSites array
      starredSites = [...new Set(urls.map(normalizeUrl))];

      // Ensure fmhy.net is always in the starred list
      if (!starredSites.includes("https://fmhy.net")) {
        starredSites.push("https://fmhy.net");
      }

      console.log("Parsed Starred Sites:", starredSites);
    }
  } catch (error) {
    console.error("Error fetching starred sites:", error);
  }
}

// Update the Address Bar icon based on the site's status
function updatePageAction(status, tabId) {
  // Define paths for different icon sizes
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
    default: {
      19: "../res/ext_icon_144.png",
      38: "../res/ext_icon_144.png", // fallback to a known good icon
    },
  };

  let icon = icons[status] || icons["default"];

  // Set the icon for the current tab with different sizes
  chrome.action.setIcon(
    {
      tabId: tabId,
      path: {
        19: icon[19], // 19x19 icon
        38: icon[38], // 38x38 icon
      },
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Error setting icon:", chrome.runtime.lastError.message);
      }
    }
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background for site:", message.url);

  if (message.action === "checkSiteStatus") {
    const currentUrl = normalizeUrl(message.url.trim());
    const rootUrl = extractRootUrl(currentUrl);
    console.log("Checking site status for:", currentUrl);

    let isStarred = starredSites.some(
      (site) =>
        normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
    );
    let isSafe = safeSites.some(
      (site) =>
        normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
    );
    let isUnsafe = unsafeSites.some(
      (site) =>
        normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
    );
    let isPotentiallyUnsafe = potentiallyUnsafeSites.some(
      (site) =>
        normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
    );

    // Return appropriate status to the popup
    if (isStarred) {
      sendResponse({ status: "starred", url: rootUrl });
    } else if (isSafe) {
      sendResponse({ status: "safe", url: rootUrl });
    } else if (isUnsafe) {
      sendResponse({ status: "unsafe", url: rootUrl });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: rootUrl });
    } else {
      sendResponse({ status: "no_data", url: rootUrl });
    }
  } else {
    console.error("Unknown action:", message.action);
    sendResponse({ status: "error", url: message.url });
  }

  return true;
});

// Check the site status and update the page action icon
function checkSiteAndUpdatePageAction(tabId, url) {
  if (!url) return;

  const currentUrl = normalizeUrl(url.trim());
  const rootUrl = extractRootUrl(currentUrl);
  console.log(
    "Checking site status for address bar icon:",
    currentUrl,
    "TabId:",
    tabId
  );

  // Check if the site is starred, safe, unsafe, or potentially unsafe
  let isStarred = starredSites.some(
    (site) =>
      normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
  );

  let isSafe = safeSites.some(
    (site) =>
      normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
  );

  let isUnsafe = unsafeSites.some(
    (site) =>
      normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
  );

  let isPotentiallyUnsafe = potentiallyUnsafeSites.some(
    (site) =>
      normalizeUrl(site) === rootUrl || normalizeUrl(site) === currentUrl
  );

  // Prioritize starred sites first, then safe sites
  if (isStarred) {
    console.log("Updating address bar icon to starred for:", currentUrl);
    updatePageAction("starred", tabId);
  } else if (isSafe) {
    console.log("Updating address bar icon to safe for:", currentUrl);
    updatePageAction("safe", tabId);
  } else if (isUnsafe) {
    console.log("Updating address bar icon to unsafe for:", currentUrl);
    updatePageAction("unsafe", tabId);
  } else if (isPotentiallyUnsafe) {
    console.log(
      "Updating address bar icon to potentially unsafe for:",
      currentUrl
    );
    updatePageAction("potentially_unsafe", tabId);
  } else {
    console.log("No data for this site:", currentUrl);
    updatePageAction("default", tabId);
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkSiteAndUpdatePageAction(tabId, tab.url);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkSiteAndUpdatePageAction(tab.id, tab.url);
    }
  });
});

// Initialize the extension
async function initializeExtension() {
  await fetchFilterLists();
  await fetchSafeSites();
  await fetchStarredSites();

  console.log("Extension initialized successfully.");
}

initializeExtension();
