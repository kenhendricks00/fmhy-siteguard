document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup loaded, preparing to check site status...");

  const statusIcon = document.getElementById("status-icon");
  const statusMessage = document.getElementById("status-message");
  const errorMessage = document.getElementById("error-message");

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // URLs of known extension pages
  const warningPageUrl = browserAPI.runtime.getURL("pub/warning-page.html");
  const settingsPageUrl = browserAPI.runtime.getURL("pub/settings-page.html");
  const welcomePageUrl = browserAPI.runtime.getURL("pub/welcome-page.html");

  // Apply theme based on settings
  async function applyTheme() {
    try {
      const { theme } = await browserAPI.storage.sync.get("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      document.body.setAttribute(
        "data-theme",
        theme || (prefersDark ? "dark" : "light")
      );
    } catch (error) {
      console.error("Error applying theme:", error);
    }
  }
  await applyTheme();

  try {
    const [activeTab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab || !activeTab.url) {
      throw new Error("No active tab found or URL is unavailable.");
    }

    const currentUrl = activeTab.url;

    // Check if the URL is an extension page by checking if it starts with known extension page URLs
    if (
      currentUrl.startsWith(warningPageUrl) ||
      currentUrl === settingsPageUrl ||
      currentUrl === welcomePageUrl
    ) {
      handleStatusUpdate("extension_page", currentUrl);
      return; // Skip further processing since it's an internal page
    }

    // Extract the root URL for display
    const rootUrl = extractRootUrl(currentUrl);

    // Send a message to the background script to check the site's status
    const response = await browserAPI.runtime.sendMessage({
      action: "checkSiteStatus",
      url: currentUrl,
    });

    if (!response || !response.status) {
      throw new Error(
        "Failed to retrieve site status from the background script."
      );
    }

    handleStatusUpdate(response.status, rootUrl);
  } catch (error) {
    console.error("Error while checking site status:", error);
    errorMessage.textContent = `Error: ${error.message}`;
    updateUI("error", "An error occurred while retrieving the site status.");
  }

  /**
   * Extracts the root URL from a full URL.
   * @param {string} url - The full URL to extract the root from.
   * @returns {string} - The root URL.
   */
  function extractRootUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (error) {
      console.warn("Failed to extract root URL:", error);
      return url; // Fallback to full URL if extraction fails
    }
  }

  /**
   * Updates the UI based on the site status
   * @param {string} status - The status of the site (e.g., "safe", "unsafe")
   * @param {string} displayUrl - The URL or root domain to display in the message
   */
  function handleStatusUpdate(status, displayUrl) {
    let message;

    switch (status) {
      case "unsafe":
        message = `${displayUrl} is flagged as <strong>unsafe</strong>. Be cautious when interacting with this site.`;
        break;
      case "potentially_unsafe":
        message = `${displayUrl} is <strong>potentially unsafe</strong>. Proceed with caution.`;
        break;
      case "fmhy":
        message = `${displayUrl} is an <strong>FMHY</strong> related site. Proceed confidently.`;
        break;
      case "safe":
        message = `${displayUrl} is <strong>safe</strong> to browse.`;
        break;
      case "starred":
        message = `${displayUrl} is a <strong>starred</strong> site.`;
        break;
      case "extension_page":
        // Set specific messages for each known extension page
        if (displayUrl.startsWith(warningPageUrl)) {
          message =
            "You are on the <strong>Warning Page</strong>. This page warns you about potentially unsafe sites.";
        } else if (displayUrl === settingsPageUrl) {
          message =
            "This is the <strong>Settings Page</strong> of the extension. Customize your preferences here.";
        } else if (displayUrl === welcomePageUrl) {
          message =
            "Welcome to <strong>FMHY SafeGuard</strong>! Explore the extension's features and get started.";
        } else {
          message = "This is an <strong>extension page</strong>.";
        }
        break;
      case "no_data":
        message = `No data available for <strong>${displayUrl}</strong>.`;
        break;
      default:
        message = `An unknown status was received for <strong>${displayUrl}</strong>.`;
    }

    updateUI(status, message);
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
      extension_page: "../res/ext_icon_144.png",
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
    browserAPI.runtime.openOptionsPage();
  });
});
