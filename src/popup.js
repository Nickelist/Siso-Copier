// Popup script for Siso Copier (Fallback UI)

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------
function showStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${isError ? "error" : "success"}`;
  status.style.display = "block";

  setTimeout(() => {
    status.style.display = "none";
  }, 3000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendMessageToTab(message) {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found");
  }

  // Check if tab URL is valid (not chrome://, chrome-extension://, etc.)
  if (
    tab.url &&
    (tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://"))
  ) {
    throw new Error("Cannot interact with browser pages");
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          // If content script doesn't exist, try to inject it
          if (
            errorMsg.includes("Receiving end does not exist") ||
            errorMsg.includes("Could not establish connection")
          ) {
            // Try to inject the content script
            chrome.scripting
              .executeScript({
                target: { tabId: tab.id },
                files: ["src/content.js"],
              })
              .then(() => {
                return chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  files: ["src/styles.css"],
                });
              })
              .then(() => {
                // Wait a bit for the script to load, then try again
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, message, (retryResponse) => {
                    if (chrome.runtime.lastError) {
                      reject(
                        new Error("Content script not available on this page")
                      );
                    } else {
                      resolve(retryResponse);
                    }
                  });
                }, 200);
              })
              .catch((injectError) => {
                reject(
                  new Error(
                    "Content script not available: Cannot inject script on this page type"
                  )
                );
              });
          } else {
            reject(new Error(errorMsg));
          }
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // COPY ALL
  const copyAllBtn = document.getElementById("copyAll");
  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", async () => {
      try {
        const tab = await getCurrentTab();
        const title = tab.title || "Untitled Page";
        const response = await sendMessageToTab({
          type: "KH_GET_PAGE_CONTENT",
        });

        if (response && response.success) {
          const content = response.pageContent;
          const combined = `${title}\n\n${content}`;
          const ok = await copyToClipboard(combined);

          if (ok) {
            showStatus("Copied Title & Content");
          } else {
            showStatus("Failed to copy all", true);
          }
        } else {
          showStatus("Failed to extract content", true);
        }
      } catch (error) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes("Cannot interact")) {
          showStatus("Not available on this page", true);
        } else {
          console.error("Error copy all:", error);
          showStatus("Error copying all", true);
        }
      }
    });
  }

  // COPY TITLE
  const copyTitleBtn = document.getElementById("copyTitle");
  if (copyTitleBtn) {
    copyTitleBtn.addEventListener("click", async () => {
      try {
        const tab = await getCurrentTab();
        const title = tab.title || "Untitled Page";
        const success = await copyToClipboard(title);
        if (success) {
          showStatus(`Copied: "${title.substring(0, 20)}..."`);
        } else {
          showStatus("Failed to copy title", true);
        }
      } catch (error) {
        console.error("Error copying title:", error);
        showStatus("Error copying title", true);
      }
    });
  }

  // COPY CONTENT
  const copyContentBtn = document.getElementById("copyContent");
  if (copyContentBtn) {
    copyContentBtn.addEventListener("click", async () => {
      try {
        const response = await sendMessageToTab({
          type: "KH_GET_PAGE_CONTENT",
        });

        if (response && response.success) {
          const copyText = response.pageContent;
          const ok = await copyToClipboard(copyText);
          if (ok) {
            showStatus(`Copied content (${response.wordCount} words)`);
          } else {
            showStatus("Failed to copy content", true);
          }
        } else {
          showStatus("Failed to copy content", true);
        }
      } catch (error) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes("Cannot interact")) {
          showStatus("Not available on this page", true);
        } else {
          showStatus("Error copying content", true);
        }
      }
    });
  }

  // OPEN SETTINGS
  const settingsBtn = document.getElementById("openSettings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("src/options.html"));
      }
    });
  }
});
