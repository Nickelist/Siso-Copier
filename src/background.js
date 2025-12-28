// MV3 service worker: creates context menu items and relays actions to the active tab
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "kh-highlight",
    title: "Highlight '%s' on page",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "kh-clear",
    title: "Clear highlights",
    contexts: ["all"],
  });

  // Initialize side panel on install for better compatibility
  if (chrome.sidePanel && chrome.sidePanel.setOptions) {
    try {
      await chrome.sidePanel.setOptions({
        path: "src/sidebar.html",
        enabled: true,
      });
    } catch (err) {
      console.warn("Error setting side panel options:", err);
    }
  } else {
    console.warn("Side panel API not available.");
  }

  // Allow clicking the extension icon to open the side panel (Chrome 116+)
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  // Ensure we have a valid tab object
  if (!tab || !tab.windowId) {
    console.error("Invalid tab object:", tab);
    return;
  }

  // Check if sidePanel API is available
  if (!chrome.sidePanel) {
    console.error("Side panel API not available");
    return;
  }

  // Check if URL is valid for side panels (chrome:// and chrome-extension:// pages don't support side panels)
  if (
    tab.url &&
    (tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://"))
  ) {
    return;
  }

  try {
    // Open side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });

    // Ensure options are set
    if (chrome.sidePanel.setOptions) {
      await chrome.sidePanel.setOptions({
        path: "src/sidebar.html",
        enabled: true,
      });
    }
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
});

// Handle Chrome Commands API keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.id) return;

  try {
    switch (command) {
      case "copy-title":
        await chrome.tabs.sendMessage(tab.id, { type: "KH_COPY_TITLE" });
        break;
      case "copy-content":
        await chrome.tabs.sendMessage(tab.id, { type: "KH_COPY_CONTENT" });
        break;
      case "nav-next":
        await chrome.tabs.sendMessage(tab.id, { type: "KH_NAV_NEXT" });
        break;
      case "nav-prev":
        await chrome.tabs.sendMessage(tab.id, { type: "KH_NAV_PREV" });
        break;
    }
  } catch (error) {
    // Try to inject the content script if it's not loaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });
      // Retry after a short delay
      setTimeout(async () => {
        try {
          switch (command) {
            case "nav-next":
              await chrome.tabs.sendMessage(tab.id, { type: "KH_NAV_NEXT" });
              break;
            case "nav-prev":
              await chrome.tabs.sendMessage(tab.id, { type: "KH_NAV_PREV" });
              break;
          }
        } catch (retryError) {}
      }, 100);
    } catch (injectError) {}
  }
});
