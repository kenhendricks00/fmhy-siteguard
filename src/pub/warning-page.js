document.addEventListener("DOMContentLoaded", () => {
  // Cross-browser compatibility shim
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const urlParams = new URLSearchParams(window.location.search);
  const unsafeUrl = urlParams.get("url") || "unknown site";
  document.getElementById("unsafeUrl").textContent = unsafeUrl;
  console.log(`Warning page loaded for URL: ${unsafeUrl}`);

  // "Go Back" button functionality to return to the previous page
  document.getElementById("goBack").addEventListener("click", () => {
    console.log("User clicked Go Back.");
    // Go back twice to skip over the warning page
    window.history.go(-2);
  });

  // "Proceed" button functionality to continue to the unsafe URL
  document.getElementById("proceed").addEventListener("click", async () => {
    if (confirm("Are you sure you want to proceed? This site may be unsafe.")) {
      const [currentTab] = await browserAPI.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (currentTab && currentTab.id) {
        console.log(
          `Sending approveSite message for tab ${currentTab.id} and URL ${unsafeUrl}`
        );

        // Send approval message to the background script
        await browserAPI.runtime.sendMessage({
          action: "approveSite",
          tabId: currentTab.id,
          url: unsafeUrl,
        });

        console.log("Approval stored, navigating to the unsafe URL...");
        // Redirect to the approved unsafe URL
        await browserAPI.tabs.update(currentTab.id, { url: unsafeUrl });
      }
    }
  });
});
