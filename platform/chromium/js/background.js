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

// Helper function to normalize URLs (removes trailing slashes)
function normalizeUrl(url) {
  return url.replace(/\/+$/, ""); // Remove trailing slash only, no www. removal
}

// Helper function to extract root domain from URL
function extractRootUrl(url) {
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.hostname}`; // Extract protocol and hostname
}

// Function to generate a regex from a list of domains/URLs
function generateRegexFromList(list) {
  const escapedList = list.map((domain) =>
    domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`(${escapedList.join("|")})`, "i");
}

// Helper function to extract URLs from filter lists (ignoring comments and empty lines)
function extractUrlsFromFilterList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("!")) // Ignore comments
    .map((line) => normalizeUrl(line));
}

// Fetch the unsafe and potentially unsafe filter lists and generate regex
async function fetchFilterLists() {
  console.log("Fetching filter lists...");

  try {
    const [unsafeResponse, potentiallyUnsafeResponse] = await Promise.all([
      fetch(filterListURLUnsafe),
      fetch(filterListURLPotentiallyUnsafe),
    ]);

    if (unsafeResponse.ok) {
      const unsafeText = await unsafeResponse.text();
      const unsafeSites = extractUrlsFromFilterList(unsafeText);
      unsafeSitesRegex = generateRegexFromList(unsafeSites);
      console.log("Generated Unsafe Sites Regex:", unsafeSitesRegex);
    } else {
      console.error("Failed to fetch unsafe sites:", unsafeResponse.status);
    }

    if (potentiallyUnsafeResponse.ok) {
      const potentiallyUnsafeText = await potentiallyUnsafeResponse.text();
      const potentiallyUnsafeSites = extractUrlsFromFilterList(
        potentiallyUnsafeText
      );
      potentiallyUnsafeSitesRegex = generateRegexFromList(
        potentiallyUnsafeSites
      );
      console.log(
        "Generated Potentially Unsafe Sites Regex:",
        potentiallyUnsafeSitesRegex
      );
    } else {
      console.error(
        "Failed to fetch potentially unsafe sites:",
        potentiallyUnsafeResponse.status
      );
    }
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
    } else {
      console.error("Failed to fetch safe sites:", response.status);
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
      starredSites = [...new Set(urls.map(normalizeUrl))];

      // Ensure fmhy.net is always in the starred list
      if (!starredSites.includes("https://fmhy.net")) {
        starredSites.push("https://fmhy.net");
      }

      console.log("Parsed Starred Sites:", starredSites);
    } else {
      console.error("Failed to fetch starred sites:", response.status);
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

// Listen for messages from the popup to check site status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background for site:", message.url);

  if (message.action === "checkSiteStatus") {
    const normalizedUrl = normalizeUrl(message.url.trim());
    const rootUrl = normalizeUrl(extractRootUrl(normalizedUrl));
    console.log("Checking site status for:", rootUrl);

    let isUnsafe =
      unsafeSitesRegex?.test(rootUrl) || unsafeSitesRegex?.test(normalizedUrl);
    let isPotentiallyUnsafe =
      potentiallyUnsafeSitesRegex?.test(rootUrl) ||
      potentiallyUnsafeSitesRegex?.test(normalizedUrl);
    let isStarred =
      starredSites.includes(rootUrl) || starredSites.includes(normalizedUrl);
    let isSafe =
      safeSites.includes(rootUrl) || safeSites.includes(normalizedUrl);

    // Return appropriate status to the popup
    if (isStarred) {
      sendResponse({ status: "starred", url: rootUrl });
    } else if (isUnsafe) {
      sendResponse({ status: "unsafe", url: rootUrl });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: rootUrl });
    } else if (isSafe) {
      sendResponse({ status: "safe", url: rootUrl });
    } else {
      sendResponse({ status: "no_data", url: rootUrl });
    }
  } else {
    console.error("Unknown action:", message.action);
    sendResponse({ status: "error", url: message.url });
  }

  return true;
});

// Check the site status using regex for unsafe/potentially unsafe and arrays for safe/starred
function checkSiteAndUpdatePageAction(tabId, url) {
  if (!url) return;

  const normalizedUrl = normalizeUrl(url.trim());
  const rootUrl = normalizeUrl(extractRootUrl(url.trim()));
  console.log("Checking site status for:", normalizedUrl, "TabId:", tabId);

  let isUnsafe =
    unsafeSitesRegex?.test(rootUrl) || unsafeSitesRegex?.test(normalizedUrl);
  let isPotentiallyUnsafe =
    potentiallyUnsafeSitesRegex?.test(rootUrl) ||
    potentiallyUnsafeSitesRegex?.test(normalizedUrl);
  let isStarred =
    starredSites.includes(rootUrl) || starredSites.includes(normalizedUrl);
  let isSafe = safeSites.includes(rootUrl) || safeSites.includes(normalizedUrl);

  if (isStarred) {
    updatePageAction("starred", tabId);
  } else if (isSafe) {
    updatePageAction("safe", tabId);
  } else if (isUnsafe) {
    updatePageAction("unsafe", tabId);
  } else if (isPotentiallyUnsafe) {
    updatePageAction("potentially_unsafe", tabId);
  } else {
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
