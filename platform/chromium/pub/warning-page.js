document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const unsafeUrl = urlParams.get("url") || "unknown site";
  document.getElementById("unsafeUrl").textContent = unsafeUrl;
  console.log(`Warning page loaded for URL: ${unsafeUrl}`);

  document.getElementById("goBack").addEventListener("click", () => {
    console.log("User clicked Go Back.");
    window.history.go(-2);
  });

  document.getElementById("proceed").addEventListener("click", () => {
    if (confirm("Are you sure you want to proceed? This site may be unsafe.")) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        console.log(`Sending proceedAnyway message for tab ${tab.id}`);
        chrome.runtime.sendMessage(
          {
            action: "proceedAnyway",
            tabId: tab.id,
          },
          () => {
            console.log("Proceed flag set, navigating to unsafe URL...");
            chrome.tabs.update(tab.id, { url: unsafeUrl });
          }
        );
      });
    }
  });
});
