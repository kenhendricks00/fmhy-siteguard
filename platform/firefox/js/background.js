const filterListURLUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist.txt";
const filterListURLPotentiallyUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist-plus.txt";
const safeListURL = "https://api.fmhy.net/single-page";
const starredListURL =
  "https://raw.githubusercontent.com/fmhy/bookmarks/refs/heads/main/fmhy_in_bookmarks_starred_only.html";
const proceedTabs = {};
const approvedUrls = new Map(); // Map to store approved URLs per tab

let unsafeSitesRegex = null;
let potentiallyUnsafeSitesRegex = null;
let safeSites = [];
let starredSites = ["https://fmhy.net", "https://fmhy.pages.dev"];

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

// Helper function to normalize URLs (adds protocol if missing, removes trailing slashes, query parameters, and fragments)
function normalizeUrl(url) {
  if (!url) {
    console.warn("Received null or undefined URL.");
    return null;
  }

  try {
    // Check if the URL starts with "http" or "https", if not, prepend "https://"
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const urlObj = new URL(url);
    urlObj.search = ""; // Remove query parameters
    urlObj.hash = ""; // Remove fragments
    return urlObj.href.replace(/\/+$/, ""); // Remove trailing slash only
  } catch (error) {
    console.warn(`Invalid URL skipped: ${url}`);
    return null; // Return null for invalid URLs
  }
}

// Helper function to extract root domain from URL
function extractRootUrl(url) {
  if (!url) {
    console.warn("Received null or undefined URL for root extraction.");
    return null;
  }

  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`; // Extract protocol and hostname
  } catch (error) {
    console.warn(`Failed to extract root URL from: ${url}`);
    return null;
  }
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
    .map((line) => normalizeUrl(line))
    .filter((url) => url !== null); // Filter out null values from invalid URLs
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

      // Ensure fmhy.pages.dev is always in the starred list
      if (!starredSites.includes("https://fmhy.pages.dev")) {
        starredSites.push("https://fmhy.pages.dev");
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
      19: "../res/icons/default_19.png",
      38: "../res/icons/default_38.png", // Fallback to a known good icon
    },
  };

  let icon = icons[status] || icons["default"]; // Fallback to default icon

  // Set the icon for the current tab with different sizes
  browser.action.setIcon(
    {
      tabId: tabId,
      path: {
        19: icon[19], // 19x19 icon
        38: icon[38], // 38x38 icon
      },
    },
    () => {
      if (browser.runtime.lastError) {
        console.error("Error setting icon:", browser.runtime.lastError.message);
      }
    }
  );
}

// Listen for messages from the popup to check site status
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background for site:", message.url);

  if (message.action === "proceedAnyway") {
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    if (tabId) {
      browser.storage.local.set({ [`proceedTab_${tabId}`]: true }, () => {
        console.log(`Proceed flag set for tab ${tabId}`);
        sendResponse({ status: "ok" });
      });
    } else {
      console.warn("No tab ID found for proceedAnyway action.");
      sendResponse({ status: "error", message: "No tab ID" });
    }
    return true; // Asynchronous message handling
  }

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

function openWarningPage(tabId, unsafeUrl) {
  // Check if this URL was already approved for this tab
  const tabApprovedUrls = approvedUrls.get(tabId) || [];
  if (tabApprovedUrls.includes(normalizeUrl(unsafeUrl))) {
    console.log(`URL ${unsafeUrl} was already approved for tab ${tabId}`);
    return; // Skip warning page if URL was approved
  }

  const warningPageUrl = browser.runtime.getURL(
    `../pub/warning-page.html?url=${encodeURIComponent(unsafeUrl)}`
  );
  browser.tabs.update(tabId, { url: warningPageUrl });
}

// Check and update site status, skip warning if proceed flag is set
// Modified checkSiteAndUpdatePageAction function
function checkSiteAndUpdatePageAction(tabId, url) {
  if (!url) {
    console.error(`Received null or undefined URL for tab ${tabId}`);
    updatePageAction("default", tabId);
    return;
  }

  console.log(`Checking site status for tab ${tabId}: ${url}`);
  const normalizedUrl = normalizeUrl(url.trim());
  if (!normalizedUrl) {
    console.error(`Failed to normalize URL for tab ${tabId}: ${url}`);
    updatePageAction("default", tabId);
    return;
  }

  const rootUrl = extractRootUrl(normalizedUrl);
  if (!rootUrl) {
    console.error(`Failed to extract root URL for tab ${tabId}: ${url}`);
    updatePageAction("default", tabId);
    return;
  }

  let isUnsafe =
    unsafeSitesRegex?.test(rootUrl) || unsafeSitesRegex?.test(normalizedUrl);
  let isPotentiallyUnsafe =
    potentiallyUnsafeSitesRegex?.test(rootUrl) ||
    potentiallyUnsafeSitesRegex?.test(normalizedUrl);
  let isStarred =
    starredSites.includes(rootUrl) || starredSites.includes(normalizedUrl);
  let isSafe = safeSites.includes(rootUrl) || safeSites.includes(normalizedUrl);

  // Check if this URL was already approved for this tab
  const tabApprovedUrls = approvedUrls.get(tabId) || [];
  const isApproved = tabApprovedUrls.includes(normalizedUrl);

  if (isUnsafe) {
    if (isApproved) {
      console.log(`Tab ${tabId} has approved unsafe URL. Skipping warning.`);
      updatePageAction("unsafe", tabId);
    } else {
      console.log(`Tab ${tabId} is unsafe. Triggering warning page.`);
      updatePageAction("unsafe", tabId);
      openWarningPage(tabId, url);
    }
  } else if (isPotentiallyUnsafe) {
    console.log(`Tab ${tabId} is potentially unsafe.`);
    updatePageAction("potentially_unsafe", tabId);
  } else if (isStarred) {
    console.log(`Tab ${tabId} is a starred site.`);
    updatePageAction("starred", tabId);
  } else if (isSafe) {
    console.log(`Tab ${tabId} is a safe site.`);
    updatePageAction("safe", tabId);
  } else {
    console.log(`Tab ${tabId} has no data. Using default icon.`);
    updatePageAction("default", tabId);
  }
}

// Clean up approved URLs when tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  approvedUrls.delete(tabId);
  browser.storage.local.remove(`proceedTab_${tabId}`, () => {
    console.log(`Proceed flag and approved URLs removed for tab ${tabId}`);
  });
});

// Modified runtime message listener for proceedAnyway
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "proceedAnyway") {
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    if (tabId) {
      // Get the URL from the warning page's query parameters
      const url = new URL(sender.tab.url).searchParams.get("url");
      if (url) {
        // Add the URL to the approved list for this tab
        const normalizedUrl = normalizeUrl(url);
        const tabApprovedUrls = approvedUrls.get(tabId) || [];
        if (!tabApprovedUrls.includes(normalizedUrl)) {
          tabApprovedUrls.push(normalizedUrl);
          approvedUrls.set(tabId, tabApprovedUrls);
        }
      }

      browser.storage.local.set({ [`proceedTab_${tabId}`]: true }, () => {
        console.log(`Proceed flag set for tab ${tabId}`);
        sendResponse({ status: "ok" });
      });
    } else {
      console.warn("No tab ID found for proceedAnyway action.");
      sendResponse({ status: "error", message: "No tab ID" });
    }
    return true;
  }
});

// Listen for tab updates and check site status
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url) {
    checkSiteAndUpdatePageAction(tabId, tab.url);
  }
});

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log(`Tab updated: ${tab.url}`);
    checkSiteAndUpdatePageAction(tabId, tab.url);
  } else if (changeInfo.status === "loading" && !tab.url) {
    console.log(`Tab loading with no URL: setting default icon`);
    updatePageAction("default", tabId);
  }
});

// Listen for tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      console.log(`Tab activated: ${tab.url}`);
      checkSiteAndUpdatePageAction(tab.id, tab.url);
    } else {
      console.log(`Tab activated with no URL: default icon`);
      updatePageAction("default", tab.id); // Use default icon for tabs without a URL
    }
  });
});

// Clean up the proceed flag when the tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.remove(`proceedTab_${tabId}`, () => {
    console.log(`Proceed flag removed for tab ${tabId}`);
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
