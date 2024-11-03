document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded, preparing to check site status...");

  const statusIcon = document.getElementById("status-icon");
  const statusMessage = document.getElementById("status-message");
  const errorMessage = document.getElementById("error-message");

  // Helper function to normalize URLs (removes trailing slashes, query parameters, and fragments)
  const normalizeUrl = (url) => {
    const urlObj = new URL(url);
    urlObj.search = ""; // Remove query parameters
    urlObj.hash = ""; // Remove fragments
    return urlObj.href.replace(/\/+$/, ""); // Remove trailing slash only
  };

  // Helper function to extract the root domain from a URL
  function extractRootDomain(url) {
    let urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  }

  // Function to apply theme based on settings
  function applyTheme() {
    chrome.storage.sync.get("theme", ({ theme }) => {
      if (theme === "dark") {
        document.body.setAttribute("data-theme", "dark");
      } else if (theme === "light") {
        document.body.setAttribute("data-theme", "light");
      } else {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.body.setAttribute(
          "data-theme",
          prefersDark ? "dark" : "light"
        );
      }
    });
  }

  // Apply theme on load
  applyTheme();

  // Get the active tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs[0] || !tabs[0].url) {
      handleError("No active tab found or URL is unavailable.");
      return;
    }

    const currentUrl = normalizeUrl(tabs[0].url);
    const rootDomain = extractRootDomain(currentUrl);
    console.log(`Active tab URL: ${currentUrl}, Root domain: ${rootDomain}`);

    // Send a message to the background script to check the site's status
    chrome.runtime.sendMessage(
      { action: "checkSiteStatus", url: currentUrl },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.status) {
          handleError(
            "Failed to retrieve site status from the background script."
          );
          return;
        }

        // Determine if the root domain or the full URL is marked as safe/starred
        chrome.runtime.sendMessage(
          { action: "checkSiteStatus", url: rootDomain },
          (isRootDomainMarked) => {
            if (chrome.runtime.lastError || !isRootDomainMarked) {
              handleError("Failed to check root domain status.");
              return;
            }

            if (
              isRootDomainMarked.status === response.status &&
              response.status !== "no_data"
            ) {
              // If both the root domain and the current URL share the same status, show the root domain in the message
              handleStatusUpdate(response.status, rootDomain);
            } else {
              // Otherwise, show the current URL in the message
              handleStatusUpdate(response.status, currentUrl);
            }
          }
        );
      }
    );
  });

  function handleError(message) {
    console.error(message);
    errorMessage.textContent = `Error: ${message}`;
    updateUI("error", "An error occurred while retrieving the site status.");
  }

  /**
   * Updates the UI based on the site status
   * @param {string} status - The status of the site (e.g., "safe", "unsafe")
   * @param {string} displayUrl - The URL or root domain to display in the message
   */
  function handleStatusUpdate(status, displayUrl) {
    switch (status) {
      case "unsafe":
        updateUI(
          "unsafe",
          `${displayUrl} is flagged as <strong>unsafe</strong>. Be cautious when interacting with this site.`
        );
        break;
      case "potentially_unsafe":
        updateUI(
          "potentially_unsafe",
          `${displayUrl} is <strong>potentially unsafe</strong>. Proceed with caution.`
        );
        break;
      case "fmhy":
        updateUI(
          "fmhy",
          `${displayUrl} is an <strong>FMHY</strong> related site. Proceed confidently.`
        );
        break;
      case "safe":
        updateUI("safe", `${displayUrl} is <strong>safe</strong> to browse.`);
        break;
      case "starred":
        updateUI(
          "starred",
          `${displayUrl} is a <strong>starred</strong> site.`
        );
        break;
      case "no_data":
        updateUI(
          "no_data",
          `No data available for <strong>${displayUrl}</strong>.`
        );
        break;
      default:
        updateUI(
          "unknown",
          `An unknown status was received for <strong>${displayUrl}</strong>.`
        );
    }
  }

  /**
   * Updates the UI with the appropriate icon, message, and effects.
   * @param {string} status - The status of the site (e.g., "safe", "unsafe").
   * @param {string} message - The message to display to the user.
   */
  function updateUI(status, message) {
    const icons = {
      unsafe: "../res/icons/unsafe.png",
      potentially_unsafe: "../res/icons/potentially_unsafe.png",
      fmhy: "../res/icons/fmhy.png",
      safe: "../res/icons/safe.png",
      starred: "../res/icons/starred.png",
      no_data: "../res/ext_icon_144.png",
      error: "../res/icons/error.png",
      unknown: "../res/ext_icon_144.png",
    };

    // Update the icon and message
    statusIcon.src = icons[status] || icons["unknown"];
    statusMessage.innerHTML = message || "An unknown error occurred.";

    // Add a small animation when the status changes
    statusIcon.classList.add("active");
    setTimeout(() => statusIcon.classList.remove("active"), 300);

    console.log(`UI updated: ${message}`);
  }

  // Add settings button functionality
  document.getElementById("settingsButton").addEventListener("click", () => {
    // Open the settings page in a new tab
    chrome.runtime.openOptionsPage();
  });
});
