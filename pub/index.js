document.addEventListener("DOMContentLoaded", function () {
  console.log("Popup loaded, attempting to get site status...");

  const statusIcon = document.getElementById("status-icon");
  const statusMessage = document.getElementById("status-message");
  const errorMessage = document.getElementById("error-message");

  // Query the active tab to get its URL
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length === 0) {
      console.error("No active tab found.");
      statusMessage.textContent = "Error: No active tab found.";
      return;
    }

    const currentUrl = tabs[0].url.trim();

    // Check if the current tab URL contains "fmhy.net"
    if (currentUrl.includes("fmhy.net")) {
      console.log("On fmhy.net, marking as starred.");
      statusIcon.src = "../res/icons/starred.png"; // Update icon to starred
      statusMessage.textContent = `${currentUrl} is starred.`; // Update message
      return; // Stop further execution since we already identified fmhy.net
    }

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
            console.log("Popup: Site is unsafe:", currentUrl);
            statusIcon.src = "../res/icons/unsafe.png"; // Update icon to unsafe
            statusMessage.textContent = `${currentUrl} is unsafe. Be cautious!`; // Update message
            break;

          case "potentially_unsafe":
            console.log("Popup: Site is potentially unsafe:", currentUrl);
            statusIcon.src = "../res/icons/potentially_unsafe.png"; // Update icon to potentially unsafe
            statusMessage.textContent = `${currentUrl} is potentially unsafe. Be cautious!`; // Update message
            break;

          case "safe":
            console.log("Popup: Site is safe:", currentUrl);
            statusIcon.src = "../res/icons/safe.png"; // Update icon to safe
            statusMessage.textContent = `${currentUrl} is safe.`; // Update message
            break;

          case "starred":
            console.log("Popup: Site is starred:", currentUrl);
            statusIcon.src = "../res/icons/starred.png"; // Update icon to starred
            statusMessage.textContent = `${currentUrl} is starred.`; // Update message
            break;

          case "no_data":
            console.log("Popup: No data for this site:", currentUrl);
            statusIcon.src = "../res/ext_icon_144.png"; // Default extension icon
            statusMessage.textContent =
              "This page is not currently in the wiki."; // Update message
            break;

          default:
            console.error("Popup: Unexpected site status:", response.status);
            statusIcon.src = "../res/ext_icon_144.png"; // Default extension icon for any unexpected status
            statusMessage.textContent = "An unknown error occurred."; // Update message for unexpected errors
        }
      }
    );
  });
});
