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

// Helper: Convert HTML to simple Markdown
function convertToMarkdown(html) {
  if (!html) return "";
  let text = html;

  // Remove scripts, styles, and comments
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "");
  text = text.replace(/<!--[\s\S]*?-->/gim, "");

  // Headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gim, "\n# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gim, "\n## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gim, "\n### $1\n");

  // Links: <a href="url">text</a> -> [text](url)
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gim, "[$2]($1)");

  // Lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gim, "\n- $1");
  text = text.replace(/<ul[^>]*>/gim, "\n");
  text = text.replace(/<\/ul>/gim, "\n");

  // Bold/Italic
  text = text.replace(/<(b|strong)>(.*?)<\/\1>/gim, "**$2**");
  text = text.replace(/<(i|em)>(.*?)<\/\1>/gim, "*$2*");

  // Paragraphs and breaks
  text = text.replace(/<p[^>]*>/gim, "\n");
  text = text.replace(/<\/p>/gim, "\n");
  text = text.replace(/<br\s*\/?>/gim, "\n");
  text = text.replace(/<hr\s*\/?>/gim, "\n---\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Clean up whitespace: remove multiple newlines, trim lines
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  // Decode common entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  return text.trim();
}

// Helper: Get formatted content
function getFormattedContent(response) {
  const formatSelector = document.getElementById("copyFormat");
  const format = formatSelector ? formatSelector.value : "text";

  if (format === "html") {
    return { text: response.pageHTML || response.pageContent, type: "HTML" };
  } else if (format === "markdown") {
    return {
      text: convertToMarkdown(response.pageHTML || response.pageContent),
      type: "Markdown",
    };
  } else {
    return { text: response.pageContent, type: "Text" };
  }
}

// Copy All (Title + Content)
document.getElementById("copyAll").addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();
    const title = tab.title || "Untitled Page";
    const response = await sendMessageToTab({ type: "KH_GET_PAGE_CONTENT" });

    if (response && response.success) {
      const { text, type } = getFormattedContent(response);

      // Prefix title for Text/Markdown, wrap for HTML
      let combined;
      if (type === "HTML") {
        combined = `<h1>${title}</h1>\n${text}`;
      } else if (type === "Markdown") {
        combined = `# ${title}\n\n${text}`;
      } else {
        combined = `${title}\n\n${text}`;
      }

      const ok = await copyToClipboard(combined);

      if (ok) {
        showStatus(`Copied All as ${type}`);
        // Save original plain text/HTML for history/reader consistency
        await saveToHistory(tab, response.pageContent, response.pageHTML);
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
      showStatus("Page protected or unavailable", true);
    } else {
      console.error("Error copy all:", error);
      showStatus("Error copying all", true);
    }
  }
});

// Copy page title (Format independent mostly, but let's respect logic if needed in future)
document.getElementById("copyTitle").addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();
    const title = tab.title || "Untitled Page";
    // Title is just text usually
    const success = await copyToClipboard(title);
    if (success) {
      showStatus(`Copied Title`);
    } else {
      showStatus("Failed to copy title", true);
    }
  } catch (error) {
    console.error("Error copying title:", error);
    showStatus("Error copying title", true);
  }
});

// Copy page content
document.getElementById("copyContent").addEventListener("click", async () => {
  try {
    const response = await sendMessageToTab({ type: "KH_GET_PAGE_CONTENT" });

    if (response && response.success) {
      const { text, type } = getFormattedContent(response);
      const ok = await copyToClipboard(text);
      if (ok) {
        showStatus(`Copied Content as ${type}`);

        const tab = await getCurrentTab();
        await saveToHistory(tab, response.pageContent, response.pageHTML);
      } else {
        showStatus("Failed to copy content", true);
      }
    } else {
      showStatus("Failed to copy content", true);
    }
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (
      errorMsg.includes("Cannot interact") ||
      errorMsg.includes("Content script not available")
    ) {
      showStatus("Page protected or unavailable", true);
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

  // Tab Switching Logic
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      // Add active to current
      tab.classList.add("active");
      const targetId = `tab-${tab.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });
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
  const aiKeyInsightsBtn = document.getElementById("aiKeyInsights");
  const aiQuizBtn = document.getElementById("aiQuiz");

  const aiExplainBtn = document.getElementById("aiExplain");

  const aiRewriteBtn = document.getElementById("aiRewrite");
  const rewriteTone = document.getElementById("rewriteTone");
  const rewriteCustomInput = document.getElementById("rewriteCustomInput");

  const aiChatInput = document.getElementById("aiChatInput");
  const aiChatSubmit = document.getElementById("aiChatSubmit");

  const aiResult = document.getElementById("aiResult");

  if (rewriteTone) {
    rewriteTone.addEventListener("change", () => {
      if (rewriteCustomInput) {
        rewriteCustomInput.style.display =
          rewriteTone.value === "custom" ? "block" : "none";
      }
    });
  }

  if (aiSummarizeBtn) {
    aiSummarizeBtn.addEventListener("click", () => handleAiAction("summarize"));
  }
  if (aiKeyInsightsBtn) {
    aiKeyInsightsBtn.addEventListener("click", () =>
      handleAiAction("key_insights")
    );
  }
  if (aiQuizBtn) {
    aiQuizBtn.addEventListener("click", () => handleAiAction("quiz"));
  }

  if (aiExplainBtn) {
    aiExplainBtn.addEventListener("click", () => handleAiAction("explain"));
  }

  if (aiRewriteBtn) {
    aiRewriteBtn.addEventListener("click", () => {
      const tone = rewriteTone ? rewriteTone.value : "professional";
      const customPersona = rewriteCustomInput ? rewriteCustomInput.value : "";
      handleAiAction("rewrite", { tone, customPersona });
    });
  }

  if (aiChatSubmit && aiChatInput) {
    const chatHandler = () => {
      const query = aiChatInput.value.trim();
      if (query) handleAiAction("chat", { query });
    };
    aiChatSubmit.addEventListener("click", chatHandler);
    aiChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") chatHandler();
    });
  }

  const toggleInspectorBtn = document.getElementById("toggleInspector");
  if (toggleInspectorBtn) {
    toggleInspectorBtn.addEventListener("click", async () => {
      showStatus("Toggle Inspector Mode...");
      const response = await sendMessageToTab({ type: "KH_TOGGLE_INSPECTOR" });
      if (response && response.success) {
        const state = response.isActive
          ? "Active (Click to Remove)"
          : "Inactive";
        showStatus(`Inspector: ${state}`, false);
        toggleInspectorBtn.style.border = response.isActive
          ? "2px solid #0d9488"
          : "none";
      }
    });
  }

  async function handleAiAction(action, metadata = {}) {
    // 1. Get Settings
    const settings = await chrome.storage.sync.get({
      aiProvider: "gemini",
      aiApiKey: "",
      aiModel: "",
      aiLanguage: "english",
      customSystemPrompt: "",
    });

    // Check session storage
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
    const isSelectionAction = ["explain", "rewrite", "chat"].includes(action);

    try {
      if (!isSelectionAction) {
        // Page Actions (Summarize, Insights, Quiz)
        showStatus("Extracting page content...");
        const response = await sendMessageToTab({
          type: "KH_GET_PAGE_CONTENT",
        });
        if (response && response.success) {
          textToProcess = response.pageContent;
          if (textToProcess.length > 15000) {
            textToProcess =
              textToProcess.substring(0, 15000) + "... (truncated)";
          }
        } else {
          throw new Error("Could not extract page content");
        }
      } else {
        // Selection Actions
        showStatus("Getting selected text...");
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
          // Fallback to clipboard if selection is empty? Or just error.
          showStatus("No text selected to process", true);
          return;
        }

        if (textToProcess.length > 3000) {
          textToProcess = textToProcess.substring(0, 3000);
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
      aiResult.innerHTML = "<div class='pulsing-loader'>Thinking...</div>"; // We can add CSS for this later or just text
      aiResult.scrollIntoView({ behavior: "smooth" });
    }

    // 4. Construct Prompt
    const lang = settings.aiLanguage || "English";
    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "summarize":
        systemPrompt = `You are a professional research assistant. Summarize the text in ${lang}. Use bullet points. Highlight main arguments. Keep it concise.`;
        userPrompt = textToProcess;
        break;
      case "key_insights":
        systemPrompt = `Extract the hard facts from the text in ${lang}.
            Output Format:
            - **Key Stats**: (Numbers, percentages, revenue)
            - **Dates/Events**: (Timeline of important dates)
            - **Action Items**: (What needs to be done?)
            If a category is empty, skip it. Be extremely direct.`;
        userPrompt = textToProcess;
        break;
      case "quiz":
        systemPrompt = `Generate 3 multiple-choice questions based on the text in ${lang}.
            Format:
            **Q1:** [Question]
            - A) [Option]
            - B) [Option]
            - C) [Option]
            **Answer:** [Correct Letter]
            (Repeat for Q2, Q3)`;
        userPrompt = textToProcess;
        break;
      case "explain":
        systemPrompt = `Explain this selected text in ${lang} as if to a 12-year-old. Use an analogy if helpful. Define technical terms.`;
        userPrompt = textToProcess;
        break;
      case "rewrite":
        let rewriteInstruction = metadata.tone || "professional";
        if (metadata.tone === "custom" && metadata.customPersona) {
          rewriteInstruction = `in the style of: ${metadata.customPersona}`;
        }

        systemPrompt = `Rewrite the selected text to be **${rewriteInstruction}**. Maintain usage of ${lang}. Output ONLY the rewritten text, nothing else.`;
        userPrompt = textToProcess;
        break;
      case "chat":
        systemPrompt = `You are a knowledgeable assistant.
        
        CONTEXT from user selection:
        """${textToProcess}"""
        
        INSTRUCTIONS:
        1. Answer the user's question based on the context above.
        2. CRITICAL: If the answer is NOT in the context, you MUST use your own general knowledge to answer. DO NOT refuse to answer. DO NOT say "The text does not mention...". Just answer contentfully.
        3. Be brief and direct.`;
        userPrompt = metadata.query;
        break;
    }

    // Append Custom System Prompt if it exists
    if (
      settings.customSystemPrompt &&
      settings.customSystemPrompt.trim() !== ""
    ) {
      systemPrompt += `\n\nIMPORTANT SYSTEM INSTRUCTION: ${settings.customSystemPrompt}`;
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
        // Basic Markdown to HTML
        let formatted = resultText
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>");

        // Cleanup extra breaks
        formatted = formatted.replace(/(<br>\s*){3,}/g, "<br><br>");

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
