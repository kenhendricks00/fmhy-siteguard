const filterListURL =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/main/filterlist-domains.txt";

const safeListURLs = [
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/adblockvpnguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/ai.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/android-iosguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/audiopiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/devtools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/downloadpiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/edupiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/file-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/gaming-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/gamingpiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/img-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/internet-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/linuxguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/miscguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/non-english.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/nsfwpiracy.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/readingpiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/social-media-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/storage.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/system-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/text-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/torrentpiracyguide.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/video-tools.md",
  "https://raw.githubusercontent.com/fmhy/edit/refs/heads/main/docs/videopiracyguide.md",
];

let unsafeSites = [];
let potentiallyUnsafeSites = [];
let safeSites = [];

// Helper function to extract URLs from markdown text
function extractUrlsFromMarkdown(markdown) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return markdown.match(urlRegex) || [];
}

// Fetch the filter list
function fetchFilterList() {
  console.log("Fetching filter list...");

  return fetch(filterListURL)
    .then((response) => response.text())
    .then((text) => {
      console.log("Filter list fetched successfully!");
      const lines = text.split("\n");
      let isPotentiallyUnsafeSection = false;

      lines.forEach((line) => {
        if (line.startsWith("#")) {
          if (line.includes("not recommended/potentially unsafe")) {
            isPotentiallyUnsafeSection = true;
          }
        } else if (line.trim()) {
          const domain = line.trim();
          if (isPotentiallyUnsafeSection) {
            potentiallyUnsafeSites.push(domain);
          } else {
            unsafeSites.push(domain);
          }
        }
      });
      console.log("Parsed Unsafe Sites:", unsafeSites);
      console.log("Parsed Potentially Unsafe Sites:", potentiallyUnsafeSites);
    })
    .catch((error) => console.error("Error fetching filter list:", error));
}

// Fetch the safe sites
async function fetchSafeSites() {
  console.log("Fetching safe sites...");
  for (let url of safeListURLs) {
    try {
      let response = await fetch(url);
      if (response.ok) {
        let markdown = await response.text();
        let urls = extractUrlsFromMarkdown(markdown);
        urls.forEach((siteUrl) => {
          // Extract hostname for consistency in matching
          let hostname = new URL(siteUrl.trim()).hostname.replace("www.", "");
          if (!safeSites.includes(hostname)) {
            safeSites.push(hostname);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching safe site list:", error);
    }
  }
  console.log("Parsed Safe Sites:", safeSites);
}

// Update the toolbar icon based on the site's status
function updateIcon(status, tabId) {
  let iconPath = "res/ext_icon_144.png"; // Default extension icon

  if (status === "safe") {
    iconPath = "res/icons/safe.png";
  } else if (status === "unsafe") {
    iconPath = "res/icons/unsafe.png";
  } else if (status === "potentially_unsafe") {
    iconPath = "res/icons/potentially_unsafe.png";
  }

  browser.browserAction.setIcon({
    path: iconPath,
    tabId: tabId,
  });
}

// Check the site status for a given tab and URL
function checkSiteAndUpdateIcon(tabId, url) {
  if (!url) return;

  const currentUrl = new URL(url).hostname.replace("www.", "");
  console.log("Checking site status for toolbar icon:", currentUrl);

  // Check if the site is safe, unsafe, or potentially unsafe
  let isSafe = safeSites.some((site) => currentUrl === site);
  let isUnsafe = unsafeSites.some((site) => currentUrl.includes(site));
  let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
    currentUrl.includes(site)
  );

  // Prioritize safe sites first
  if (isSafe) {
    console.log("Updating toolbar icon to safe for:", currentUrl);
    updateIcon("safe", tabId);
  } else if (isUnsafe) {
    console.log("Updating toolbar icon to unsafe for:", currentUrl);
    updateIcon("unsafe", tabId);
  } else if (isPotentiallyUnsafe) {
    console.log("Updating toolbar icon to potentially unsafe for:", currentUrl);
    updateIcon("potentially_unsafe", tabId);
  } else {
    console.log("No data for this site:", currentUrl);
    updateIcon("default", tabId);
  }
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkSiteStatus") {
    const currentUrl = message.url;
    console.log("Checking site status for popup:", currentUrl);

    let isSafe = safeSites.some((site) => currentUrl.includes(site));
    let isUnsafe = unsafeSites.some((site) => currentUrl.includes(site));
    let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
      currentUrl.includes(site)
    );

    if (isSafe) {
      sendResponse({ status: "safe", url: currentUrl });
    } else if (isUnsafe) {
      sendResponse({ status: "unsafe", url: currentUrl });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: currentUrl });
    } else {
      console.log("No data for this site:", currentUrl);
      sendResponse({ status: "no_data", url: currentUrl });
    }
  }
  return true;
});

// Initialize the extension
async function initializeExtension() {
  // Fetch all necessary lists
  await fetchFilterList();
  await fetchSafeSites();

  // Listen for tab updates after lists are fetched
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      checkSiteAndUpdateIcon(tabId, tab.url);
    }
  });

  // Listen for tab activation after lists are fetched
  browser.tabs.onActivated.addListener((activeInfo) => {
    browser.tabs.get(activeInfo.tabId, (tab) => {
      if (tab.url) {
        checkSiteAndUpdateIcon(tab.id, tab.url);
      }
    });
  });

  console.log("Extension initialized successfully.");
}

// Initialize everything once the extension is loaded
initializeExtension();
