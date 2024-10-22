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

// Helper function to normalize URLs to domain only (removes protocol, www, and trailing slashes)
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, ""); // Remove "www." if present
  } catch (e) {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
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
        .map((line) => extractDomain(line.trim()))
        .filter((line) => line && !line.startsWith("#"));
      console.log("Parsed Unsafe Sites:", unsafeSites);
    }

    if (potentiallyUnsafeResponse.ok) {
      const potentiallyUnsafeText = await potentiallyUnsafeResponse.text();
      potentiallyUnsafeSites = potentiallyUnsafeText
        .split("\n")
        .map((line) => extractDomain(line.trim()))
        .filter((line) => line && !line.startsWith("#"));
      console.log("Parsed Potentially Unsafe Sites:", potentiallyUnsafeSites);
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
        let domain = extractDomain(siteUrl.trim());
        if (!safeSites.includes(domain)) {
          safeSites.push(domain);
        }
      });
      console.log("Parsed Safe Sites:", safeSites);
    }
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
      // Normalize and add domains to the starredSites array
      starredSites = [...new Set(urls.map(extractDomain))];
      // Ensure fmhy.net is always in the starred list
      if (!starredSites.includes("fmhy.net")) {
        starredSites.push("fmhy.net");
      }
      console.log("Parsed Starred Sites:", starredSites);
    }
  } catch (error) {
    console.error("Error fetching starred sites:", error);
  }
}

// Update the Address Bar icon based on the site's status
function updatePageAction(status, tabId) {
  let iconPath = "res/ext_icon_144.png"; // Default extension icon

  if (status === "safe") {
    iconPath = "res/icons/safe.png";
  } else if (status === "unsafe") {
    iconPath = "res/icons/unsafe.png";
  } else if (status === "potentially_unsafe") {
    iconPath = "res/icons/potentially_unsafe.png";
  } else if (status === "starred") {
    iconPath = "res/icons/starred.png";
  }

  // Show the page action (icon in the address bar)
  browser.pageAction.setIcon({
    tabId: tabId,
    path: iconPath,
  });

  // Make the page action icon visible in the address bar
  browser.pageAction.show(tabId);
}

// Check the site status and update the page action icon
function checkSiteAndUpdatePageAction(tabId, url) {
  if (!url) return;

  const currentDomain = extractDomain(url.trim());
  console.log(
    "Checking site status for address bar icon:",
    currentDomain,
    "TabId:",
    tabId
  );

  // Check if the site is starred, safe, unsafe, or potentially unsafe
  let isStarred = starredSites.includes(currentDomain);
  let isSafe = safeSites.includes(currentDomain);
  let isUnsafe = unsafeSites.includes(currentDomain);
  let isPotentiallyUnsafe = potentiallyUnsafeSites.includes(currentDomain);

  // Prioritize starred sites first, then unsafe sites, then potentially unsafe, then safe sites
  if (isStarred) {
    console.log("Updating address bar icon to starred for:", currentDomain);
    updatePageAction("starred", tabId);
  } else if (isUnsafe) {
    console.log("Updating address bar icon to unsafe for:", currentDomain);
    updatePageAction("unsafe", tabId);
  } else if (isPotentiallyUnsafe) {
    console.log(
      "Updating address bar icon to potentially unsafe for:",
      currentDomain
    );
    updatePageAction("potentially_unsafe", tabId);
  } else if (isSafe) {
    console.log("Updating address bar icon to safe for:", currentDomain);
    updatePageAction("safe", tabId);
  } else {
    console.log("No data for this site:", currentDomain);
    updatePageAction("default", tabId);
  }
}

// Listen for messages from the popup to check site status
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background for site:", message.url);

  if (message.action === "checkSiteStatus") {
    const currentDomain = extractDomain(message.url.trim());
    console.log("Checking site status for:", currentDomain);

    let isStarred = starredSites.includes(currentDomain);
    let isSafe = safeSites.includes(currentDomain);
    let isUnsafe = unsafeSites.includes(currentDomain);
    let isPotentiallyUnsafe = potentiallyUnsafeSites.includes(currentDomain);

    // Return appropriate status to the popup
    if (isStarred) {
      sendResponse({ status: "starred", url: currentDomain });
    } else if (isUnsafe) {
      sendResponse({ status: "unsafe", url: currentDomain });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: currentDomain });
    } else if (isSafe) {
      sendResponse({ status: "safe", url: currentDomain });
    } else {
      sendResponse({ status: "no_data", url: currentDomain });
    }
  } else {
    console.error("Unknown action:", message.action);
    sendResponse({ status: "error", url: message.url });
  }

  return true;
});

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkSiteAndUpdatePageAction(tabId, tab.url);
  }
});

// Listen for tab activation
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkSiteAndUpdatePageAction(tab.id, tab.url);
    }
  });
});

// Initialize the extension
async function initializeExtension() {
  // Fetch all necessary lists
  await fetchFilterLists();
  await fetchSafeSites();
  await fetchStarredSites();

  console.log("Extension initialized successfully.");
}

// Initialize everything once the extension is loaded
initializeExtension();
