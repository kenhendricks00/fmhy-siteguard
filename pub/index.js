document.addEventListener("DOMContentLoaded", function () {
  console.log("Popup loaded, attempting to get site status...");

  const statusIcon = document.getElementById("status-icon");
  const statusMessage = document.getElementById("status-message");

  // Helper function to normalize URLs (removes trailing slashes)
  function normalizeUrl(url) {
    return url.replace(/\/+$/, ""); // Remove trailing slash if exists
  }

  // Query the active tab to get its URL
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length === 0) {
      console.error("No active tab found.");
      statusMessage.textContent = "Error: No active tab found.";
      return;
    }

    const currentUrl = normalizeUrl(tabs[0].url.trim());

    console.log(
      "Sending message to background to check site status for:",
      currentUrl
    );

    // Send a message to the background script to check the site's status
    browser.runtime.sendMessage(
      { action: "checkSiteStatus", url: currentUrl },
      function (response) {
        if (!response) {
          console.error("No response from background script.");
          statusMessage.textContent = "Error: Could not retrieve site status.";
          return;
        }

        // Update popup based on the received site status
        switch (response.status) {
          case "unsafe":
            statusIcon.src = "../res/icons/unsafe.png"; // Update icon to unsafe
            statusMessage.textContent = `${currentUrl} is unsafe. Be cautious!`;
            break;

          case "potentially_unsafe":
            statusIcon.src = "../res/icons/potentially_unsafe.png"; // Update icon to potentially unsafe
            statusMessage.textContent = `${currentUrl} is potentially unsafe. Be cautious!`;
            break;

          case "safe":
            statusIcon.src = "../res/icons/safe.png"; // Update icon to safe
            statusMessage.textContent = `${currentUrl} is safe.`;
            break;

          case "starred":
            statusIcon.src = "../res/icons/starred.png"; // Update icon to starred
            statusMessage.textContent = `${currentUrl} is starred.`;
            break;

          case "no_data":
            statusIcon.src = "../res/ext_icon_144.png"; // Default extension icon
            statusMessage.textContent =
              "This page is not currently in the wiki.";
            break;

          default:
            statusIcon.src = "../res/ext_icon_144.png"; // Default extension icon
            statusMessage.textContent = "An unknown error occurred.";
        }
      }
    );
  });
});
