document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup loaded, attempting to get site status...");

    const statusIcon = document.getElementById('status-icon');
    const statusMessage = document.getElementById('status-message');
    const errorMessage = document.getElementById('error-message');

    // Query the active tab to get its URL
    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            console.error("No active tab found.");
            statusMessage.textContent = "Error: No active tab found.";
            return;
        }

        const currentUrl = new URL(tabs[0].url).hostname.replace('www.', '');
        console.log("Sending message to background to check site status for:", currentUrl);

        // Send a message to the background script to check the site's status
        browser.runtime.sendMessage({action: "checkSiteStatus", url: tabs[0].url}, function(response) {
            if (!response) {
                console.error("No response from background script.");
                statusMessage.textContent = "Error: Could not retrieve site status.";
                return;
            }

            if (response.status === "unsafe") {
                console.log("Popup: Site is unsafe:", currentUrl);
                // Update popup for unsafe site
                statusIcon.src = '../res/icons/unsafe.png';  // Update icon to unsafe
                statusMessage.textContent = `${currentUrl} is unsafe. Be cautious!`;  // Update message
            } else if (response.status === "potentially_unsafe") {
                console.log("Popup: Site is potentially unsafe:", currentUrl);
                // Update popup for potentially unsafe site
                statusIcon.src = '../res/icons/potentially_unsafe.png';  // Update icon to potentially unsafe
                statusMessage.textContent = `${currentUrl} is potentially unsafe. Be cautious!`;  // Update message
            } else if (response.status === "safe") {
                console.log("Popup: Site is safe:", currentUrl);
                // Update popup for safe site
                statusIcon.src = '../res/icons/safe.png';  // Update icon to safe
                statusMessage.textContent = `${currentUrl} is safe.`;  // Update message
            } else if (response.status === "no_data") {
                console.log("Popup: No data for this site:", currentUrl);
                // Update popup for no data
                statusIcon.src = '../res/ext_icon_144.png';  // Default extension icon
                statusMessage.textContent = "There is no data for this site yet.";  // Update message for no data
            }
        });
    });
});
