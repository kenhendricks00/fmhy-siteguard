const filterListURL =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/main/filterlist-domains.txt";

let unsafeSites = [];
let potentiallyUnsafeSites = [];

// Fetch the filter list
function fetchFilterList() {
  console.log("Fetching filter list...");

  fetch(filterListURL)
    .then((response) => response.text())
    .then((text) => {
      console.log("Filter list fetched successfully!");
      const lines = text.split("\n");
      let isPotentiallyUnsafeSection = false; // Track whether we're in the "potentially unsafe" section

      lines.forEach((line) => {
        // Ignore comments and blank lines
        if (line.startsWith("#")) {
          if (line.includes("not recommended/potentially unsafe")) {
            isPotentiallyUnsafeSection = true;
          }
        } else if (line.trim()) {
          const domain = line.trim(); // Trim whitespace
          if (isPotentiallyUnsafeSection) {
            potentiallyUnsafeSites.push(domain); // Add to potentially unsafe sites
          } else {
            unsafeSites.push(domain); // Add to unsafe sites
          }
        }
      });
      console.log("Parsed Unsafe Sites:", unsafeSites); // Check if unsafe sites are populated
      console.log("Parsed Potentially Unsafe Sites:", potentiallyUnsafeSites); // Check potentially unsafe sites
    })
    .catch((error) => console.error("Error fetching filter list:", error));
}

// Update the toolbar icon based on the site's status
function updateIcon(status, tabId) {
  let iconPath = "res/ext_icon_144.png"; // Default extension icon for unknown sites

  if (status === "safe") {
    iconPath = "res/icons/safe.png"; // Icon for safe sites
  } else if (status === "unsafe") {
    iconPath = "res/icons/unsafe.png"; // Icon for unsafe sites
  } else if (status === "potentially_unsafe") {
    iconPath = "res/icons/potentially_unsafe.png"; // Icon for potentially unsafe sites
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

  // Check if the site is unsafe or potentially unsafe
  let isUnsafe = unsafeSites.some((site) => currentUrl.includes(site));
  let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
    currentUrl.includes(site)
  );

  if (isUnsafe) {
    console.log("Updating toolbar icon to unsafe for:", currentUrl);
    updateIcon("unsafe", tabId); // Update the toolbar icon to unsafe
  } else if (isPotentiallyUnsafe) {
    console.log("Updating toolbar icon to potentially unsafe for:", currentUrl);
    updateIcon("potentially_unsafe", tabId); // Update the toolbar icon to potentially unsafe
  } else {
    console.log("No data for this site:", currentUrl);
    updateIcon("default", tabId); // Use default extension icon for unknown sites
  }
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkSiteStatus") {
    const currentUrl = message.url;
    console.log("Checking site status for popup:", currentUrl);

    // Check if the site is unsafe or potentially unsafe
    let isUnsafe = unsafeSites.some((site) => currentUrl.includes(site));
    let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
      currentUrl.includes(site)
    );

    if (isUnsafe) {
      sendResponse({ status: "unsafe", url: currentUrl });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: currentUrl });
    } else {
      console.log("No data for this site:", currentUrl);
      sendResponse({ status: "no_data", url: currentUrl }); // Return no data status
    }
  }
  return true; // Indicates we will respond asynchronously
});

// Listen for when a tab is updated (e.g., new URL loaded)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkSiteAndUpdateIcon(tabId, tab.url);
  }
});

// Listen for when a tab is activated (e.g., tab switched)
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkSiteAndUpdateIcon(tab.id, tab.url);
    }
  });
});

// Fetch the filter list when the extension is loaded
fetchFilterList();
