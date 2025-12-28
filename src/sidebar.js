// Sidebar script for the Keyword Highlighter extension

// Load user color preference and apply to buttons
async function loadUserColor() {
  try {
    const result = await chrome.storage.sync.get({
      khColor: "rgba(59, 130, 246, 0.6)",
      khTransparency: 60,
    });
    const color = result.khColor;
    const transparency = result.khTransparency || 60;
    const alpha = transparency / 100;

    // Extract RGB values from rgba string
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);

      // Apply CSS custom properties to buttons with transparency
      const style = document.createElement("style");
      style.textContent = `
        .btn {
          background: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
          border-color: rgba(${r}, ${g}, ${b}, ${alpha * 0.5}) !important;
        }
        .btn::before {
          background: linear-gradient(135deg, rgba(${r}, ${g}, ${b}, ${
        alpha * 0.3
      }) 0%, rgba(${r}, ${g}, ${b}, ${alpha * 0.2}) 100%) !important;
        }
        .btn::after {
          background: linear-gradient(90deg, transparent, rgba(${r}, ${g}, ${b}, ${
        alpha * 0.5
      }), transparent) !important;
        }
        .btn:hover {
          background: rgba(${r}, ${g}, ${b}, ${Math.min(
        alpha + 0.1,
        1
      )}) !important;
          border-color: rgba(${r}, ${g}, ${b}, ${Math.min(
        alpha * 0.8,
        1
      )}) !important;
        }
        .btn:active {
          background: rgba(${r}, ${g}, ${b}, ${Math.min(
        alpha + 0.2,
        1
      )}) !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error("Failed to load user color:", error);
  }
}

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
                // If injection fails (e.g., on restricted pages), reject with a clear message
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

// Helper to save content to history
async function saveToHistory(tab, content, html = null) {
  if (!tab || !tab.url) return;

  const key = `kh_highlights_${tab.url}`;
  // Fetch existing data to merge or create new
  const existing = await chrome.storage.local.get([key]);
  const data = existing[key] || {
    url: tab.url,
    title: tab.title,
    terms: [],
    lastUpdated: Date.now(),
  };

  data.storedContent = content;
  if (html) {
    data.storedHTML = html;
  }
  data.lastUpdated = Date.now();

  await chrome.storage.local.set({ [key]: data });

  // Update global history index
  const histRes = await chrome.storage.local.get(["kh_global_history"]);
  let globalHistory = histRes.kh_global_history || [];
  // Remove old entry if exists
  globalHistory = globalHistory.filter((h) => h.url !== tab.url);
  // Add new
  globalHistory.unshift({
    url: tab.url,
    title: tab.title || "Untitled",
    lastUpdated: Date.now(),
    highlightCount: data.terms ? data.terms.length : 0,
    storedContent: content,
  });
  await chrome.storage.local.set({ kh_global_history: globalHistory });
}

// Copy All (Title + Content)
document.getElementById("copyAll").addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();
    const title = tab.title || "Untitled Page";
    const response = await sendMessageToTab({ type: "KH_GET_PAGE_CONTENT" });

    if (response && response.success) {
      const content = response.pageContent;
      const combined = `${title}\n\n${content}`;
      const ok = await copyToClipboard(combined);

      if (ok) {
        showStatus("Copied Title & Content");
        // Save original content to history (not combined, to avoid double title in reader)
        await saveToHistory(tab, content, response.pageHTML);
      } else {
        showStatus("Failed to copy all", true);
      }
    } else {
      showStatus("Failed to extract content", true);
    }
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (
      errorMsg.includes("Cannot interact") ||
      errorMsg.includes("Content script not available")
    ) {
      showStatus("This action is not available on this page type", true);
    } else {
      console.error("Error copy all:", error);
      showStatus("Error copying all", true);
    }
  }
});

// Copy page title (title only)
document.getElementById("copyTitle").addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();
    const title = tab.title || "Untitled Page";
    const copyText = title;

    const success = await copyToClipboard(copyText);
    if (success) {
      showStatus(`Copied: "${title}"`);
    } else {
      showStatus("Failed to copy title", true);
    }
  } catch (error) {
    console.error("Error copying title:", error);
    showStatus("Error copying title", true);
  }
});

// Copy page content (request from content script, then write here to avoid NotAllowedError)
document.getElementById("copyContent").addEventListener("click", async () => {
  try {
    const response = await sendMessageToTab({ type: "KH_GET_PAGE_CONTENT" });

    if (response && response.success) {
      const copyText = response.pageContent;
      const ok = await copyToClipboard(copyText);
      if (ok) {
        showStatus(`Copied page content (${response.wordCount} words)`);

        // Manually save this content to history storage so it appears in Options
        const tab = await getCurrentTab();
        await saveToHistory(tab, copyText, response.pageHTML);
      } else {
        showStatus("Failed to copy content", true);
      }
    } else {
      showStatus("Failed to copy content", true);
    }
  } catch (error) {
    // Provide user-friendly error messages
    const errorMsg = error.message || String(error);
    if (
      errorMsg.includes("Cannot interact") ||
      errorMsg.includes("Content script not available") ||
      errorMsg.includes("Receiving end does not exist") ||
      errorMsg.includes("Could not establish connection")
    ) {
      showStatus("This action is not available on this page type", true);
    } else {
      console.error("Error copying content:", error);
      showStatus("Error copying content", true);
    }
  }
});

// Open settings
document.getElementById("openSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Open history
document.getElementById("openHistory").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/options.html#history"),
  });
});

// Navigation functions
const navSection = document.querySelector(".nav-section");
const navCounter = document.getElementById("navCounter");
const navPrev = document.getElementById("navPrev");
const navNext = document.getElementById("navNext");

let navUIInterval = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

async function updateNavUI() {
  try {
    // Check if current tab is a restricted page before attempting
    const tab = await getCurrentTab();
    if (
      tab &&
      tab.url &&
      (tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://"))
    ) {
      // Restricted page - hide nav and stop interval
      if (navSection) navSection.style.display = "none";
      if (navUIInterval) {
        clearInterval(navUIInterval);
        navUIInterval = null;
      }
      return;
    }

    const response = await sendMessageToTab({ type: "KH_GET_NAV_INFO" });
    if (response && response.ok) {
      consecutiveErrors = 0; // Reset error count on success
      if (navSection) {
        if (response.hasHighlights) {
          navSection.style.display = "block";
          if (navCounter)
            navCounter.textContent = `${response.currentIndex + 1} of ${
              response.total
            }`;
          if (navPrev) navPrev.disabled = false;
          if (navNext) navNext.disabled = false;
        } else {
          navSection.style.display = "none";
        }
      }
    }
  } catch (error) {
    consecutiveErrors++;
    const errorMsg = error.message || String(error);
    // Only log error if it's not a restricted page error and we haven't exceeded the limit
    if (
      !errorMsg.includes("Cannot interact") &&
      !errorMsg.includes("Content script not available") &&
      !errorMsg.includes("Receiving end does not exist") &&
      consecutiveErrors <= MAX_CONSECUTIVE_ERRORS
    ) {
      console.error("Error updating nav UI:", error);
    }
    if (navSection) navSection.style.display = "none";

    // Stop interval after too many consecutive errors
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && navUIInterval) {
      clearInterval(navUIInterval);
      navUIInterval = null;
    }
  }
}

if (navPrev && navNext) {
  navPrev.addEventListener("click", async () => {
    try {
      const response = await sendMessageToTab({ type: "KH_NAV_PREV" });
      if (response && response.ok) {
        updateNavUI();
      }
    } catch (error) {
      console.error("Error navigating previous:", error);
    }
  });

  navNext.addEventListener("click", async () => {
    try {
      const response = await sendMessageToTab({ type: "KH_NAV_NEXT" });
      if (response && response.ok) {
        updateNavUI();
      }
    } catch (error) {
      console.error("Error navigating next:", error);
    }
  });
}

// Apply dark mode
function applyDarkMode(mode) {
  document.body.classList.remove("dark-mode", "auto-dark-mode");

  if (mode === "dark") {
    document.body.classList.add("dark-mode");
  } else if (mode === "auto") {
    document.body.classList.add("auto-dark-mode");
    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.body.classList.add("dark-mode");
    }
  }
}

// Load dark mode preference
async function loadDarkMode() {
  try {
    const result = await chrome.storage.sync.get({ khDarkMode: "auto" });
    applyDarkMode(result.khDarkMode);

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        if (result.khDarkMode === "auto") {
          applyDarkMode("auto");
        }
      });
    }
  } catch (error) {
    console.error("Error loading dark mode:", error);
  }
}

// Load user color preference when sidebar loads
document.addEventListener("DOMContentLoaded", () => {
  loadUserColor();
  loadDarkMode();
  if (navSection) {
    updateNavUI();
    // Update nav UI periodically, but only if we're on a valid page
    navUIInterval = setInterval(updateNavUI, 1000);

    // Also listen for tab changes to restart interval if needed
    chrome.tabs.onActivated.addListener(() => {
      if (!navUIInterval) {
        navUIInterval = setInterval(updateNavUI, 1000);
        consecutiveErrors = 0; // Reset error count
      }
      updateNavUI();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete") {
        if (!navUIInterval) {
          navUIInterval = setInterval(updateNavUI, 1000);
          consecutiveErrors = 0; // Reset error count
        }
        updateNavUI();
      }
    });
  }

  // --- SISO SMART AI LOGIC ---
  const aiSummarizeBtn = document.getElementById("aiSummarize");
  const aiExplainBtn = document.getElementById("aiExplain");
  const aiResult = document.getElementById("aiResult");

  if (aiSummarizeBtn) {
    aiSummarizeBtn.addEventListener("click", async () => {
      await handleAiAction("summarize");
    });
  }

  if (aiExplainBtn) {
    aiExplainBtn.addEventListener("click", async () => {
      await handleAiAction("explain");
    });
  }

  async function handleAiAction(action) {
    // 1. Get Settings
    const settings = await chrome.storage.sync.get({
      aiProvider: "gemini",
      aiApiKey: "",
      aiModel: "",
      aiLanguage: "english",
    });

    // Check session storage for key if not in sync
    if (!settings.aiApiKey) {
      const session = await chrome.storage.session.get("aiApiKey");
      if (session.aiApiKey) {
        settings.aiApiKey = session.aiApiKey;
      }
    }

    if (
      !settings.aiApiKey &&
      settings.aiProvider !== "nano" &&
      settings.aiProvider !== "lmstudio"
    ) {
      showStatus("Please set your AI API Key in Settings first", true);
      setTimeout(() => chrome.runtime.openOptionsPage(), 2000);
      return;
    }

    // 2. Get Content
    let textToProcess = "";
    try {
      if (action === "summarize") {
        showStatus("Extracting page content...");
        const response = await sendMessageToTab({
          type: "KH_GET_PAGE_CONTENT",
        });
        if (response && response.success) {
          textToProcess = response.pageContent;
          // Truncate if too long (approx 12k chars is safe for most standard models)
          if (textToProcess.length > 12000) {
            textToProcess =
              textToProcess.substring(0, 12000) + "... (truncated)";
          }
        } else {
          throw new Error("Could not extract page content");
        }
      } else if (action === "explain") {
        showStatus("Getting selected text...");
        // For explain, we need the selected text.
        // We can reuse KH_HIGHLIGHT logic or a new KH_GET_SELECTION command.
        // Let's assume sendMessageToTab with a script exec is easiest or existing command.
        // Actually background handles 'highlight-selected' using executeScript.
        // We can do the same here using scripting API if we have permissions, or ask background.
        // sidebar.js has permission to executeScript in sendMessageToTab fallback, but direct is better.

        // Simpler: Ask content script for selection
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        const selectionResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString(),
        });
        textToProcess = selectionResult[0].result;

        if (!textToProcess || !textToProcess.trim()) {
          showStatus("No text selected to explain", true);
          return;
        }

        if (textToProcess.length > 2000) {
          textToProcess = textToProcess.substring(0, 2000);
        }
      }
    } catch (e) {
      console.error(e);
      showStatus("Failed to get content: " + e.message, true);
      return;
    }

    // 3. UI Loading
    if (aiResult) {
      aiResult.style.display = "block";
      aiResult.textContent = "Thinking...";
      aiResult.scrollIntoView({ behavior: "smooth" });
    }

    // 4. Construct Prompt
    const lang = settings.aiLanguage || "English";
    let systemPrompt = "";
    let userPrompt = "";

    if (action === "summarize") {
      systemPrompt = `You are a helpful assistant. Summarize the following text in ${lang}. Use bullet points and keep it concise.`;
      userPrompt = textToProcess;
    } else {
      systemPrompt = `You are a helpful teacher. Explain the following text in simple terms in ${lang}.`;
      userPrompt = textToProcess;
    }

    // 5. Call API
    try {
      let resultText = "";
      if (settings.aiProvider === "openai") {
        resultText = await callOpenAI(settings, systemPrompt, userPrompt);
      } else if (settings.aiProvider === "gemini") {
        resultText = await callGemini(settings, systemPrompt, userPrompt);
      } else if (settings.aiProvider === "openrouter") {
        resultText = await callOpenRouter(settings, systemPrompt, userPrompt);
      } else if (settings.aiProvider === "lmstudio") {
        resultText = await callLMStudio(settings, systemPrompt, userPrompt);
      } else if (settings.aiProvider === "fal") {
        resultText = await callFal(settings, systemPrompt, userPrompt);
      } else if (settings.aiProvider === "nano") {
        resultText = await callNano(settings, systemPrompt, userPrompt);
      }

      // 6. Show Result
      if (aiResult) {
        // Simple markdown parsing (bold/italic/bullets)
        let formatted = resultText
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/## (.*?)\n/g, "<h4>$1</h4>")
          .replace(/- (.*?)\n/g, "• $1<br>");

        aiResult.innerHTML = formatted;
        showStatus("Done!", false);
      }
    } catch (apiError) {
      console.error(apiError);
      if (aiResult) {
        aiResult.textContent = "Error: " + apiError.message;
        aiResult.style.color = "red";
      }
      showStatus("AI Request Failed", true);
    }
  }

  async function callOpenAI(settings, system, user) {
    const model = settings.aiModel || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.aiApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API Error");
    }
    return data.choices[0].message.content;
  }

  async function callGemini(settings, system, user) {
    const model = settings.aiModel || "gemini-1.5-flash";
    const apiKey = settings.aiApiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${system}\n\nInput Text:\n${user}` }],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API Error");
    }
    return data.candidates[0].content.parts[0].text;
  }

  async function callOpenRouter(settings, system, user) {
    const model = settings.aiModel || "anthropic/claude-3-haiku";
    const baseUrl = settings.aiBaseUrl || "https://openrouter.ai/api/v1";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.aiApiKey}`,
        "HTTP-Referer": "https://siso-copier.extension",
        "X-Title": "Siso Copier",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenRouter API Error");
    }
    return data.choices[0].message.content;
  }

  async function callLMStudio(settings, system, user) {
    const model = settings.aiModel || "local-model";
    let baseUrl = settings.aiBaseUrl || "http://localhost:1234/v1";
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.aiApiKey
          ? { Authorization: `Bearer ${settings.aiApiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.error?.message || "LM Studio Error (Is it running?)"
      );
    }
    return data.choices[0].message.content;
  }

  async function callFal(settings, system, user) {
    const model = settings.aiModel || "fal-ai/lzlv";
    const url = `https://fal.run/${model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${settings.aiApiKey}`,
      },
      body: JSON.stringify({
        prompt: `${system}\n\n${user}`,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Fal.ai Error");
    }
    return data.output || data.text || JSON.stringify(data);
  }

  async function callNano(settings, system, user) {
    if (!window.ai || !window.ai.languageModel) {
      throw new Error(
        "Chrome Built-in AI not found. Enable in chrome://flags or check device compatibility."
      );
    }

    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available === "no") {
        throw new Error(
          "Chrome AI is installed but not available (check download status)."
        );
      }

      const session = await window.ai.languageModel.create({
        systemPrompt: system,
      });

      const result = await session.prompt(user);
      session.destroy();
      return result;
    } catch (e) {
      throw new Error("Nano Error: " + e.message);
    }
  }
});
