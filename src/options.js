function toRgba(hex, alpha = 0.9) {
  const v = hex.replace("#", "");
  const bigint = parseInt(v, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function $(id) {
  return document.getElementById(id);
}

// Convert rgba to hex
function rgbaToHex(rgba) {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
  if (!match) return "#3B82F6";
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

// Default color palette
const DEFAULT_COLORS = [
  "rgba(59, 130, 246, 0.6)", // Blue
  "rgba(236, 72, 153, 0.6)", // Pink
  "rgba(34, 197, 94, 0.6)", // Green
  "rgba(251, 191, 36, 0.6)", // Yellow
  "rgba(168, 85, 247, 0.6)", // Purple
  "rgba(239, 68, 68, 0.6)", // Red
  "rgba(20, 184, 166, 0.6)", // Teal
  "rgba(249, 115, 22, 0.6)", // Orange
];

// Render color palette
let currentPaletteColors = [];

function renderColorPalette(colors) {
  const container = $("colorPaletteContainer");
  if (!container) return;

  // Store reference to current colors
  currentPaletteColors = colors;

  container.innerHTML = "";

  colors.forEach((color, index) => {
    const hex = rgbaToHex(color);
    const item = document.createElement("div");
    item.className = "palette-item";
    item.style.backgroundColor = color;
    item.dataset.index = index;

    // Check mark for active selection matching could be added here
    item.addEventListener("click", () => {
      // Set as active color
      const [h] = hexToHsl(hex);
      $("colorSlider").value = h;
      $("colorPicker").value = hex;
      updatePreview(hex);
      updateButtonColors(hex);
    });

    container.appendChild(item);
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

// Detect system theme changes
function setupThemeListener() {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", (e) => {
      const mode =
        document.querySelector('input[name="themeMode"]:checked')?.value ||
        "auto";
      if (mode === "auto") {
        applyDarkMode("auto");
      }
    });
  }
}

// Color Preview updater
const updatePreview = (hex) => {
  const preview = document.getElementById("colorPreview");
  const transparency = parseInt($("transparency").value) || 60;
  const alpha = transparency / 100;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  // Update border color too
  preview.style.borderColor = `rgba(${r}, ${g}, ${b}, ${Math.min(
    alpha + 0.2,
    1
  )})`;
};

async function load() {
  chrome.storage.sync.get(
    {
      khColor: "rgba(59, 130, 246, 0.6)",
      khTransparency: 60,
      khCaseSensitive: false,
      khWholeWord: false,
      khUseRegex: false,
      khMultiColorMode: false,
      khColorPalette: DEFAULT_COLORS,
      khDarkMode: "auto",
      khPersistHighlights: true,
      khIncludeSelectors: "",
      khExcludeSelectors: "",
      copyTitleShortcut: "Ctrl+Shift+T",
      copyContentShortcut: "Ctrl+Shift+E",
    },
    (prefs) => {
      // derive hex from rgba best-effort (defaults to your specified color)
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(prefs.khColor || "");
      const hex = match
        ? `#${Number(match[1]).toString(16).padStart(2, "0")}${Number(match[2])
            .toString(16)
            .padStart(2, "0")}${Number(match[3]).toString(16).padStart(2, "0")}`
        : "#8FF353";

      // Sync both slider and picker
      const [h] = hexToHsl(hex);
      $("colorSlider").value = h;
      $("colorPicker").value = hex;
      updatePreview(hex);

      $("caseSensitive").checked = !!prefs.khCaseSensitive;
      $("wholeWord").checked = !!prefs.khWholeWord;
      $("multiColorMode").checked = !!prefs.khMultiColorMode;
      $("persistHighlights").checked = prefs.khPersistHighlights !== false; // Default to true
      $("useRegex").checked = !!prefs.khUseRegex;
      $("includeSelectors").value = prefs.khIncludeSelectors || "";
      $("excludeSelectors").value = prefs.khExcludeSelectors || "";
      $("enableReaderImages").checked = prefs.enableReaderImages !== false; // Default to true

      // Load dark mode setting
      const darkMode = prefs.khDarkMode || "auto";
      if (darkMode === "dark") {
        $("darkModeDark").checked = true;
      } else if (darkMode === "light") {
        $("darkModeLight").checked = true;
      } else {
        $("darkModeAuto").checked = true;
      }
      applyDarkMode(darkMode);

      // Load transparency
      $("transparency").value = prefs.khTransparency || 60;

      // Load shortcuts
      $("copyTitleShortcut").value = prefs.copyTitleShortcut || "Ctrl+Shift+T";
      $("copyContentShortcut").value =
        prefs.copyContentShortcut || "Ctrl+Shift+E";

      // Load AI Settings
      $("aiProvider").value = prefs.aiProvider || "gemini";
      $("aiProvider").value = prefs.aiProvider || "gemini";
      $("aiModel").value = prefs.aiModel || "";
      $("aiBaseUrl").value = prefs.aiBaseUrl || "";
      $("aiLanguage").value = prefs.aiLanguage || "english";
      $("aiCustomPrompt").value = prefs.customSystemPrompt || "";

      // Handle API Key (Check Session first, then Sync)
      if (prefs.aiApiKey) {
        // It's in Sync
        $("aiApiKey").value = prefs.aiApiKey;
        $("aiSessionOnly").checked = false;
      } else {
        // Check session
        chrome.storage.session.get("aiApiKey", (sessionRes) => {
          if (sessionRes.aiApiKey) {
            $("aiApiKey").value = sessionRes.aiApiKey;
            $("aiSessionOnly").checked = true;
          }
        });
      }

      // Trigger visibility update
      updateAiSettingsVisibility();

      // Render color palette
      const palette = prefs.khColorPalette || DEFAULT_COLORS;
      currentPaletteColors = [...palette];
      renderColorPalette(currentPaletteColors);

      // Show/hide palette based on multi-color mode
      togglePaletteVisibility();

      // Apply current color to buttons
      updateButtonColors(hex);
    }
  );
}

function getPaletteColors() {
  // Use stored reference if available, otherwise read from DOM
  if (currentPaletteColors.length > 0) {
    return currentPaletteColors;
  }
  return DEFAULT_COLORS;
}

function togglePaletteVisibility() {
  const paletteRow = $("paletteSection");
  if (paletteRow) {
    paletteRow.style.display = $("multiColorMode").checked ? "block" : "none";
  }
}

function save() {
  const hex = $("colorPicker").value || "#3B82F6";
  const transparency = parseInt($("transparency").value) || 60;
  const alpha = transparency / 100;

  const themeMode =
    document.querySelector('input[name="themeMode"]:checked')?.value || "auto";

  const prefs = {
    khColor: toRgba(hex, alpha),
    khTransparency: transparency,
    khCaseSensitive: $("caseSensitive").checked,
    khWholeWord: $("wholeWord").checked,
    khUseRegex: $("useRegex").checked,
    khMultiColorMode: $("multiColorMode").checked,
    khColorPalette: getPaletteColors(),
    khDarkMode: themeMode,
    khPersistHighlights: $("persistHighlights").checked,
    khIncludeSelectors: $("includeSelectors").value || "",
    khExcludeSelectors: $("excludeSelectors").value || "",
    enableReaderImages: $("enableReaderImages").checked, // Save Image Action preference
    copyTitleShortcut: $("copyTitleShortcut").value,
    copyContentShortcut: $("copyContentShortcut").value,
    // Save AI Settings
    aiProvider: $("aiProvider").value,
    aiModel: $("aiModel").value,
    aiBaseUrl: $("aiBaseUrl").value,
    aiLanguage: $("aiLanguage").value,
    customSystemPrompt: $("aiCustomPrompt").value,
  };

  // API Key Handling
  const apiKey = $("aiApiKey").value;
  const isSessionOnly = $("aiSessionOnly").checked;

  if (isSessionOnly) {
    // Save to Session, Clear from Sync
    chrome.storage.session.set({ aiApiKey: apiKey });
    prefs.aiApiKey = ""; // Clear from sync
  } else {
    // Save to Sync
    prefs.aiApiKey = apiKey;
    // Optional: Clear from session to avoid confusion?
    // Actually, keeping strictly to one source is better
    chrome.storage.session.remove("aiApiKey");
  }
  chrome.storage.sync.set(prefs, () => {
    const status = $("status");
    status.textContent = "Settings Saved";
    status.classList.add("visible");

    setTimeout(() => {
      status.classList.remove("visible");
    }, 2000);

    // Update button colors immediately
    updateButtonColors(hex);
    // Apply dark mode immediately
    applyDarkMode(themeMode);
  });
}

// Update button colors dynamically
function updateButtonColors(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const transparency = parseInt($("transparency").value) || 60;
  const alpha = transparency / 100;

  // Remove existing dynamic styles
  const existingStyle = document.getElementById("dynamic-button-styles");
  if (existingStyle) {
    existingStyle.remove();
  }

  // Apply new styles with transparency
  const style = document.createElement("style");
  style.id = "dynamic-button-styles";
  style.textContent = `
    .btn {
      background: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
      border-color: rgba(${r}, ${g}, ${b}, ${alpha * 0.5}) !important;
    }
    .btn:hover {
      background: rgba(${r}, ${g}, ${b}, ${Math.min(
    alpha + 0.1,
    1
  )}) !important;
    }
    .btn:active {
      background: rgba(${r}, ${g}, ${b}, ${Math.min(
    alpha + 0.2,
    1
  )}) !important;
    }
    .nav-item.active {
      background: rgba(${r}, ${g}, ${b}, 0.15) !important;
      color: rgba(${r}, ${g}, ${b}, 1) !important;
    }
    .nav-item:hover {
      color: rgba(${r}, ${g}, ${b}, 1) !important;
    }
    input[type="range"]::-webkit-slider-thumb {
      background: rgba(${r}, ${g}, ${b}, 1) !important;
    }
    .change-shortcut-btn {
      background: rgba(${r}, ${g}, ${b}, ${alpha}) !important;
      border-color: rgba(${r}, ${g}, ${b}, ${alpha * 0.7}) !important;
    }
    .change-shortcut-btn:hover {
      background: rgba(${r}, ${g}, ${b}, ${Math.min(
    alpha + 0.1,
    1
  )}) !important;
    }
  `;
  document.head.appendChild(style);
}

// Color slider functionality
function updateColorFromSlider() {
  const hue = $("colorSlider").value;
  const hex = hslToHex(hue, 100, 50);
  $("colorPicker").value = hex;
  updatePreview(hex);
  // Update button colors in real-time
  updateButtonColors(hex.toUpperCase());
}

// Keyboard shortcut recording
let isRecording = false;
let currentAction = null;

function startRecording(action) {
  isRecording = true;
  currentAction = action;
  const btn = document.querySelector(`[data-action="${action}"]`);
  btn.textContent = "Press keys...";
  btn.style.background = "rgba(255, 193, 7, 0.8)";
}

function stopRecording() {
  isRecording = false;
  currentAction = null;
  document.querySelectorAll(".change-shortcut-btn").forEach((btn) => {
    btn.textContent = "Edit";
    // Force re-render of button color
    const hex = $("colorPicker").value || "#3B82F6";
    updateButtonColors(hex);
  });
}

function recordKeyCombo(e) {
  if (!isRecording) return;

  e.preventDefault();
  e.stopPropagation();

  const keys = [];
  if (e.ctrlKey) keys.push("Ctrl");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");
  if (e.metaKey) keys.push("Meta");

  // Add the main key
  if (
    e.key &&
    e.key !== "Control" &&
    e.key !== "Alt" &&
    e.key !== "Shift" &&
    e.key !== "Meta"
  ) {
    keys.push(e.key);
  }

  if (keys.length > 0) {
    const combo = keys.join("+");
    $(`${currentAction}Shortcut`).value = combo;
    stopRecording();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  load();
  setupThemeListener();
  $("save").addEventListener("click", save);

  // Tab Switching Logic
  const tabs = document.querySelectorAll(".nav-item");
  const contents = document.querySelectorAll(".tab-content");

  function switchTab(tabId) {
    tabs.forEach((t) => t.classList.remove("active"));
    contents.forEach((c) => c.classList.remove("active"));

    const targetTab = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const targetContent = document.getElementById(tabId);

    if (targetTab && targetContent) {
      targetTab.classList.add("active");
      targetContent.classList.add("active");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab");
      switchTab(targetId);
    });
  });

  // Hash-based navigation
  if (window.location.hash) {
    const tabId = window.location.hash.substring(1);
    switchTab(tabId);
  }

  // Theme mode change listeners
  document.querySelectorAll('input[name="themeMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const mode = radio.value;
      applyDarkMode(mode);
    });
  });

  // Color slider event
  $("colorSlider").addEventListener("input", updateColorFromSlider);

  // Color picker sync
  $("colorPicker").addEventListener("input", (e) => {
    const hex = e.target.value;
    const [h] = hexToHsl(hex);
    $("colorSlider").value = h;
    updatePreview(hex);
    updateButtonColors(hex);
  });

  // Transparency slider event
  $("transparency").addEventListener("input", () => {
    const hex = $("colorPicker").value || "#3B82F6";
    updateButtonColors(hex);
    updatePreview(hex);
    // Update palette colors with new transparency
    if (currentPaletteColors.length > 0) {
      const transparency = parseInt($("transparency").value) || 60;
      const alpha = transparency / 100;
      currentPaletteColors = currentPaletteColors.map((color) => {
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
        if (match) {
          const r = match[1];
          const g = match[2];
          const b = match[3];
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
      });
      renderColorPalette(currentPaletteColors);
    }
  });

  // Multi-color mode toggle
  $("multiColorMode").addEventListener("change", () => {
    togglePaletteVisibility();
  });

  // Keyboard shortcut buttons
  document.querySelectorAll(".change-shortcut-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      startRecording(action);
    });
  });

  // Global key recording
  document.addEventListener("keydown", recordKeyCombo);
  document.addEventListener("click", (e) => {
    if (isRecording && !e.target.classList.contains("change-shortcut-btn")) {
      stopRecording();
    }
  });

  // History Logic Integration
  const historySearch = $("historySearch");
  const clearHistoryBtn = $("clearHistoryBtn");
  const exportBtn = $("exportBtn");

  // Add Select All Checkbox to UI if not present (simplified approach: add button or assume header)
  // For now, we'll just add checkboxes to items. A "Select All" button could be added to the toolbar.

  if (historySearch) {
    historySearch.addEventListener("input", (e) =>
      filterHistory(e.target.value)
    );
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", async () => {
      const selected = getSelectedItems();
      if (selected.length > 0) {
        showConfirmModal(
          `Delete ${selected.length} selected items?`,
          async () => {
            for (const url of selected) {
              await deleteHistoryItem(url, false);
            }
            loadHistory();
          }
        );
      } else {
        showConfirmModal(
          "Are you sure you want to clear ALL history? This cannot be undone.",
          async () => {
            await clearAllHistory();
          }
        );
      }
    });

    // Event-driven update for button text
    $("historyList").addEventListener("change", (e) => {
      if (e.target.classList.contains("history-checkbox")) {
        updateClearButtonText();
      }
    });
  }

  function updateClearButtonText() {
    const count = getSelectedItems().length;
    if (count > 0) clearHistoryBtn.textContent = `Delete (${count})`;
    else clearHistoryBtn.textContent = "Clear All";
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const format = $("exportFormat").value;
      exportData(format);
    });
  }

  // Initial history load
  loadHistory();

  // AI Provider Change Listener
  const aiProviderSelect = $("aiProvider");
  if (aiProviderSelect) {
    aiProviderSelect.addEventListener("change", updateAiSettingsVisibility);
  }
});

function updateAiSettingsVisibility() {
  const provider = $("aiProvider").value;
  const baseUrlGroup = document.getElementById("baseUrlGroup");
  const apiKeyInput = $("aiApiKey");
  const apiKeyRow = apiKeyInput.closest(".form-row");
  const modelInput = $("aiModel");

  // Defaults
  if (apiKeyRow) apiKeyRow.style.display = "block";
  if (baseUrlGroup) baseUrlGroup.style.display = "none";

  if (provider === "openrouter") {
    if (baseUrlGroup) {
      baseUrlGroup.style.display = "block";
      if (!$("aiBaseUrl").value)
        $("aiBaseUrl").value = "https://openrouter.ai/api/v1";
    }
  } else if (provider === "lmstudio") {
    if (baseUrlGroup) {
      baseUrlGroup.style.display = "block";
      if (!$("aiBaseUrl").value)
        $("aiBaseUrl").value = "http://localhost:1234/v1";
    }
    // LM Studio often doesn't need a key, but we leave it accessible just in case
  } else if (provider === "nano") {
    if (apiKeyRow) apiKeyRow.style.display = "none";
    modelInput.placeholder = "Not used (Managed by Chrome)";
  } else if (provider === "fal") {
    modelInput.placeholder = "fal-ai/lzlv (Default)";
  } else {
    modelInput.placeholder = "gemini-1.5-flash / gpt-4o-mini";
  }
}

// Custom Confirm Modal
function showConfirmModal(message, onConfirm) {
  // Remove if exists
  const existing = document.getElementById("confirm-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "confirm-modal";
  modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.2s;
    `;

  const card = document.createElement("div");
  // Default to Light Mode (White/Glass)
  card.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        color: #1f2937;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        max-width: 400px;
        width: 90%;
        text-align: center;
        border: 1px solid rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
    `;

  // Dark Mode Override
  if (document.body.classList.contains("dark-mode")) {
    card.style.background = "#1f2937"; // Dark Slate
    card.style.color = "#ffffff";
    card.style.border = "1px solid rgba(255,255,255,0.1)";
  }

  const msgEl = document.createElement("p");
  msgEl.textContent = message;
  msgEl.style.cssText =
    "margin-bottom: 24px; font-size: 16px; line-height: 1.5; font-weight: 500;";

  const btnGroup = document.createElement("div");
  btnGroup.style.cssText = "display: flex; justify-content: center; gap: 12px;";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "btn";
  // Grey background to ensure white text is visible in Light Mode
  cancelBtn.style.cssText =
    "background: #6b7280 !important; color: white !important; border: none !important; font-weight: 500 !important;";
  cancelBtn.onmouseover = () =>
    (cancelBtn.style.backgroundColor = "#4b5563 !important");
  cancelBtn.onmouseout = () =>
    (cancelBtn.style.backgroundColor = "#6b7280 !important");
  cancelBtn.onclick = () => closeModal();

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Delete";
  confirmBtn.className = "btn";
  // Red background for Danger action
  confirmBtn.style.cssText =
    "background: #ef4444 !important; color: white !important; border: none !important; font-weight: 600 !important;";
  confirmBtn.onmouseover = () =>
    (confirmBtn.style.backgroundColor = "#dc2626 !important");
  confirmBtn.onmouseout = () =>
    (confirmBtn.style.backgroundColor = "#ef4444 !important");
  confirmBtn.onclick = () => {
    onConfirm();
    closeModal();
  };

  function closeModal() {
    modal.style.opacity = 0;
    setTimeout(() => modal.remove(), 200);
    document.removeEventListener("keydown", handleKeydown);
  }

  // Keyboard support
  function handleKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
      closeModal();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  }
  document.addEventListener("keydown", handleKeydown);

  // Close on click outside
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(confirmBtn);
  card.appendChild(msgEl);
  card.appendChild(btnGroup);
  modal.appendChild(card);

  document.body.appendChild(modal);
  requestAnimationFrame(() => (modal.style.opacity = 1));
  setTimeout(() => confirmBtn.focus(), 50);
}

// --- History Functions ---

let allHistoryItems = [];

async function loadHistory() {
  try {
    const result = await chrome.storage.local.get(["kh_global_history"]);
    allHistoryItems = result.kh_global_history || [];
    allHistoryItems.sort((a, b) => b.lastUpdated - a.lastUpdated);
    // Respect current filter
    const searchInput = $("historySearch");
    if (searchInput && searchInput.value) {
      filterHistory(searchInput.value);
    } else {
      renderHistory(allHistoryItems);
    }
  } catch (error) {
    console.error("Error loading history:", error);
  }
}

async function renderHistory(items) {
  const container = $("historyList");
  if (!container) return;

  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <p>No highlights yet</p>
      </div>
    `;
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "form-group";
    card.style.marginBottom = "16px";
    card.style.position = "relative";
    card.style.padding = "20px";
    card.style.cursor = "default";

    let date = "Unknown Date";
    try {
      if (item.lastUpdated) {
        const d = new Date(item.lastUpdated);
        if (!isNaN(d.getTime())) {
          date = d.toLocaleDateString();
        }
      }
    } catch (e) {
      console.warn("Invalid date for item:", item);
    }
    let domain = "unknown";
    try {
      domain = new URL(item.url).hostname.replace("www.", "");
    } catch (e) {}

    // Fetch detailed highlights for preview
    const key = `kh_highlights_${item.url}`;
    const data = await chrome.storage.local.get([key]);
    const details = data[key];

    let contentPreview = "";
    if (details) {
      // If we have stored page content, show a snippet
      if (item.storedContent) {
        contentPreview += `<div>${item.storedContent.substring(0, 300)}${
          item.storedContent.length > 300 ? "..." : ""
        }</div>`;
      } else {
        // Fallback to searching highlights if no stored content
        // But usually we rely on storedContent for the "content"
      }
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <input type="checkbox" class="history-checkbox" data-url="${
            item.url
          }" style="width: 18px; height: 18px; cursor: pointer;">
          <a href="#" class="history-item-link" data-url="${
            item.url
          }" style="font-weight: 600; color: var(--text); text-decoration: none; font-size: 16px; display: block;">
            ${item.title || "Untitled Page"}
          </a>
        </div>
        <button class="delete-history-btn" style="background: none; border: none; cursor: pointer; color: var(--danger); opacity: 0.6; padding: 4px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
        </button>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); display: flex; gap: 12px; margin-bottom: 12px; margin-left: 30px;">
        <span>${domain}</span>
        <span>${date}</span>
      </div>
      <div class="history-content-preview" style="margin-left: 30px;">
        ${contentPreview || "<em>No preview content available</em>"}
      </div>
    `;

    // Add delete functionality
    const delBtn = card.querySelector(".delete-history-btn");
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showConfirmModal("Delete this history item?", () => {
        deleteHistoryItem(item.url);
      });
    });

    container.appendChild(card);
  }
}

function getSelectedItems() {
  const checkboxes = document.querySelectorAll(".history-checkbox:checked");
  return Array.from(checkboxes).map((cb) => cb.dataset.url);
}

function filterHistory(query) {
  if (!query) {
    renderHistory(allHistoryItems);
    return;
  }
  const lowerQuery = query.toLowerCase();
  const filtered = allHistoryItems.filter(
    (item) =>
      (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
      (item.url && item.url.toLowerCase().includes(lowerQuery))
  );
  renderHistory(filtered);
}

async function deleteHistoryItem(url, reload = true) {
  // Confirmation handled by caller (showConfirmModal)
  try {
    allHistoryItems = allHistoryItems.filter((item) => item.url !== url);
    await chrome.storage.local.set({ kh_global_history: allHistoryItems });
    await chrome.storage.local.remove(`kh_highlights_${url}`);
    if (reload) filterHistory($("historySearch").value);
  } catch (error) {
    console.error("Delete failed:", error);
  }
}

async function clearAllHistory() {
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = ["kh_global_history"];
    Object.keys(allData).forEach((key) => {
      if (key.startsWith("kh_highlights_")) keysToRemove.push(key);
    });
    await chrome.storage.local.remove(keysToRemove);
    allHistoryItems = [];
    renderHistory([]);
  } catch (error) {
    console.error("Clear failed:", error);
  }
}

async function exportData(format) {
  try {
    const selectedUrls = getSelectedItems();
    let items = allHistoryItems;

    // Filter by selection if any are selected
    if (selectedUrls.length > 0) {
      items = allHistoryItems.filter((item) => selectedUrls.includes(item.url));
    }
    let content = "";
    let mimeType = "text/plain";
    let extension = "txt";

    if (items.length === 0) {
      alert("No history to export!");
      return;
    }

    if (format === "json") {
      const fullData = [];
      for (const item of items) {
        const key = `kh_highlights_${item.url}`;
        const data = await chrome.storage.local.get([key]);
        fullData.push({ ...item, details: data[key] });
      }
      content = JSON.stringify(fullData, null, 2);
      mimeType = "application/json";
      extension = "json";
    } else if (format === "csv") {
      content = "Title,URL,Date,Highlights,Notes\n";
      for (const item of items) {
        const key = `kh_highlights_${item.url}`;
        const data = await chrome.storage.local.get([key]);
        const details = data[key];
        const terms = details && details.terms ? details.terms.join("; ") : "";
        const date = new Date(item.lastUpdated).toLocaleDateString();
        // Escape quotes for CSV
        const safeTitle = (item.title || "").replace(/"/g, '""');
        content += `"${safeTitle}","${item.url}","${date}","${terms}",""\n`;
      }
      mimeType = "text/csv";
      extension = "csv";
    } else if (format === "md") {
      content = "# Siso Copier Highlights\n\n";

      // Helper to convert HTML to Markdown
      function htmlToMarkdown(html) {
        if (!html) return "";
        const temp = document.createElement("div");
        temp.innerHTML = html;

        // Clean up
        temp.querySelectorAll("script, style").forEach((el) => el.remove());

        let md = "";

        // Process nodes
        function process(node) {
          if (node.nodeType === 3) {
            // Text
            return node.textContent;
          }
          if (node.nodeType !== 1) return "";

          let result = "";
          let childContent = "";
          node.childNodes.forEach((child) => (childContent += process(child)));

          const tag = node.tagName.toLowerCase();

          switch (tag) {
            case "h1":
              return `\n# ${childContent}\n\n`;
            case "h2":
              return `\n## ${childContent}\n\n`;
            case "h3":
              return `\n### ${childContent}\n\n`;
            case "h4":
              return `\n#### ${childContent}\n\n`;
            case "p":
              return `${childContent}\n\n`;
            case "strong":
            case "b":
              return `**${childContent}**`;
            case "em":
            case "i":
              return `_${childContent}_`;
            case "a":
              return `[${childContent}](${node.getAttribute("href")})`;
            case "img":
              const alt = node.getAttribute("alt") || "image";
              const src = node.getAttribute("src");
              return `\n![${alt}](${src})\n\n`;
            case "ul":
              return `\n${childContent}\n`;
            case "ol":
              return `\n${childContent}\n`;
            case "li":
              return `- ${childContent}\n`;
            case "blockquote":
              return `\n> ${childContent.replace(/\n/g, "\n> ")}\n\n`;
            case "br":
              return `\n`;
            case "div":
              return `${childContent}\n`;
            default:
              return childContent;
          }
        }

        return process(temp).trim();
      }

      for (const item of items) {
        content += `## [${item.title}](${item.url})\n`;
        content += `*Date: ${new Date(
          item.lastUpdated
        ).toLocaleDateString()}*\n\n`;

        const key = `kh_highlights_${item.url}`;
        const data = await chrome.storage.local.get([key]);
        const details = data[key];

        if (details && details.terms) {
          content += "**Highlights:**\n";
          details.terms.forEach((t) => (content += `- ${t}\n`));
          content += "\n";
        }

        if (details && details.storedHTML) {
          content += "**Content:**\n\n";
          content += htmlToMarkdown(details.storedHTML);
          content += "\n\n";
        } else if (item.storedContent) {
          content += "**Content Summary:**\n";
          content += `> ${item.storedContent.replace(/\n/g, "\n> ")}\n\n`;
        }
        content += "---\n\n";
      }
      mimeType = "text/markdown";
      extension = "md";
    } else {
      // txt
      for (const item of items) {
        content += `Title: ${item.title}\nURL: ${item.url}\nDate: ${new Date(
          item.lastUpdated
        ).toLocaleDateString()}\n`;
        const key = `kh_highlights_${item.url}`;
        const data = await chrome.storage.local.get([key]);
        const details = data[key];
        if (details && details.terms) {
          content += `Highlights: ${details.terms.join(", ")}\n`;
        }
        content += `\n----------------------------------------\n\n`;
      }
      extension = "txt";
    }

    // Download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `siso-export-${new Date()
      .toISOString()
      .slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    alert("Export failed: " + error.message);
  }
}

// Auto-refresh listener
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (
    namespace === "local" &&
    (changes.kh_global_history ||
      Object.keys(changes).some((k) => k.startsWith("kh_highlights_")))
  ) {
    loadHistory();
  }
});

// ----------------------------------------------------------------------------
// READER MODE UI
// ----------------------------------------------------------------------------
function openReaderMode(item, htmlContent) {
  // Remove existing modal if any
  const existing = document.getElementById("reader-modal");
  if (existing) existing.remove();

  // Check user preference for images
  const enableImages =
    document.getElementById("enableReaderImages")?.checked ?? true;

  const modal = document.createElement("div");
  modal.id = "reader-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 10000;
    overflow-y: auto; /* Allow scrolling on the modal itself */
    opacity: 0;
    transition: opacity 0.2s ease-out;
    backdrop-filter: blur(2px);
    -webkit-overflow-scrolling: touch;
  `;

  // Wrapper to center the content vertically/horizontally but allow scrolling
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
      min-height: 100%;
      display: flex;
      justify-content: center;
      align-items: flex-start; /* Start from top so long content scrolls naturally */
      padding: 40px 20px;
      box-sizing: border-box;
  `;

  // Reader Content Card
  const container = document.createElement("div");
  container.className = "reader-container";
  container.style.cssText = `
    background: #fdfdfd;
    color: #333;
    width: 100%;
    max-width: 800px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    position: relative;
    border-radius: 8px; /* Slight radius */
    font-family: "Charter", "Iowan Old Style", "Sitka Text", Palatino, serif;
    font-size: 19px;
    line-height: 1.8;
    margin: auto; /* Helps centering if needed */
  `;

  // Click outside to close (check if target is wrapper or modal)
  modal.addEventListener("click", (e) => {
    // If clicking the backdrop (wrapper or modal)
    if (e.target === modal || e.target === wrapper) {
      closeModal();
    }
  });

  function closeModal() {
    modal.style.opacity = 0;
    setTimeout(() => modal.remove(), 200);
    document.body.style.overflow = ""; // Restore scrolling
  }

  // Dark mode adjustment
  if (document.body.classList.contains("dark-mode")) {
    container.style.background = "#1a1a1a";
    container.style.color = "#e5e5e5";
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.style.cssText = `
    padding: 60px 80px;
  `;
  // Responsive padding
  if (window.innerWidth < 600) {
    contentWrapper.style.padding = "40px 20px";
  }

  // Header with meta info
  const date = new Date(item.lastUpdated).toLocaleDateString();
  const domain = new URL(item.url || "http://example.com").hostname.replace(
    "www.",
    ""
  );

  const header = `
    <div style="margin-bottom: 50px; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 30px;">
        <h1 style="font-size: 34px; font-weight: 800; margin-bottom: 16px; line-height: 1.25; letter-spacing: -0.02em;">${
          item.title || "Untitled"
        }</h1>
        <div style="font-family: -apple-system, sans-serif; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
            ${domain} • ${date}
        </div>
        <a href="${
          item.url
        }" target="_blank" style="font-family: -apple-system, sans-serif; font-size: 14px; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 16px; font-weight: 500;">
            View Original Page 
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>
        </a>
    </div>
  `;

  // Clean HTML
  const body = `
    <div class="reader-body">
        ${htmlContent}
    </div>
    <style>
        .reader-body { font-size: 20px; line-height: 1.8; color: inherit; }
        .reader-body img { 
            max-width: 100%; 
            height: auto; 
            border-radius: 8px; 
            margin: 40px auto; 
            display: block; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            position: relative;
        }
        .reader-body p { margin-bottom: 2em; }
        .reader-body > div:not([class]) { margin-bottom: 1.5em; }
        
        .reader-body h1, .reader-body h2, .reader-body h3, .reader-body h4 { 
            font-family: -apple-system, sans-serif; 
            font-weight: 800; 
            margin-top: 2.5em; 
            margin-bottom: 0.8em; 
            line-height: 1.3;
            letter-spacing: -0.02em;
            color: inherit;
        }
        .reader-body blockquote { 
            border-left: 4px solid var(--primary); 
            padding: 24px 32px; 
            font-style: italic; 
            font-size: 1.1em;
            color: var(--text-secondary); 
            margin: 40px 0; 
            background: rgba(59, 130, 246, 0.04);
            border-radius: 0 12px 12px 0;
        }
        .reader-body a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
        .reader-body ul, .reader-body ol { margin-bottom: 2em; padding-left: 1.5em; }
        .reader-body li { margin-bottom: 0.8em; padding-left: 0.5em; }

        /* Action Button */
        .img-action-btn {
            position: absolute;
            background: rgba(0,0,0,0.85);
            color: white;
            border: none;
            border-radius: 100px;
            padding: 10px 18px;
            font-size: 13px;
            font-family: -apple-system, sans-serif;
            font-weight: 600;
            cursor: pointer;
            pointer-events: none;
            opacity: 0;
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            z-index: 10001;
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            gap: 8px;
            transform: translateY(4px);
        }
        .img-action-btn.visible {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
    </style>
  `;

  contentWrapper.innerHTML = header + body;

  // Close Button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close (Esc)";
  closeBtn.style.cssText = `
    position: absolute;
    top: 24px;
    right: 24px;
    background: rgba(0,0,0,0.05);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 28px;
    line-height: 1;
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 100;
  `;
  closeBtn.onmouseover = () => (closeBtn.style.background = "rgba(0,0,0,0.1)");
  closeBtn.onmouseout = () => (closeBtn.style.background = "rgba(0,0,0,0.05)");
  closeBtn.onclick = closeModal;

  // ESC to close
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  });

  container.appendChild(closeBtn);
  container.appendChild(contentWrapper);
  wrapper.appendChild(container); // Add container to wrapper
  modal.appendChild(wrapper); // Add wrapper to modal
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden"; // Prevent background scrolling

  // Image Interaction Logic (Only if enabled)
  if (enableImages) {
    const imgs = contentWrapper.querySelectorAll("img");

    const actionBtn = document.createElement("button");
    actionBtn.className = "img-action-btn";
    actionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg> Copy Image`;
    container.appendChild(actionBtn);

    let currentImg = null;

    imgs.forEach((img) => {
      img.addEventListener("mouseenter", () => {
        currentImg = img;
        actionBtn.style.top = img.offsetTop + 16 + "px";
        actionBtn.style.left =
          img.offsetLeft + img.offsetWidth - actionBtn.offsetWidth - 16 + "px";

        // If button hasn't been rendered yet, offsetWidth might be 0, so approximate or wait
        if (actionBtn.offsetWidth === 0) {
          actionBtn.style.left = img.offsetLeft + img.offsetWidth - 140 + "px";
        }

        actionBtn.classList.add("visible");
      });
    });

    container.addEventListener("mousemove", (e) => {
      if (!e.target.closest("img") && !e.target.closest(".img-action-btn")) {
        actionBtn.classList.remove("visible");
      }
    });

    actionBtn.addEventListener("click", async (e) => {
      if (!currentImg) return;
      e.stopPropagation();

      const originalText = actionBtn.innerHTML;
      actionBtn.innerHTML = "Downloading...";

      try {
        // Need to handle CORS if possible, or just open in new tab
        // Extensions have some privileges but CORS still applies to fetch()
        // Try fetch first
        const response = await fetch(currentImg.src);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);

        actionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg> Copied!`;
      } catch (err) {
        console.warn("Direct copy failed, opening in new tab", err);
        window.open(currentImg.src, "_blank");
        actionBtn.innerHTML = "Opened Tab";
      }

      setTimeout(() => (actionBtn.innerHTML = originalText), 2000);
    });
  } // end if enableImages

  // Animation
  requestAnimationFrame(() => {
    modal.style.opacity = 1;
  });
}

// Add event listener delegation for history links
document.addEventListener("click", async (e) => {
  // Traverse up to find link if clicked on child
  const link = e.target.closest(".history-item-link");
  if (link) {
    e.preventDefault();
    const url = link.dataset.url;

    // Fetch full data including storedHTML
    const key = `kh_highlights_${url}`;
    const data = await chrome.storage.local.get([key]);
    const details = data[key];

    const title = link.textContent.trim();
    const lastUpdated = Date.now();

    if (details && details.storedHTML) {
      openReaderMode(
        {
          title: details.title || title,
          url: details.url || url,
          lastUpdated: details.lastUpdated || lastUpdated,
        },
        details.storedHTML
      );
    } else if (details && details.storedContent) {
      openReaderMode(
        {
          title: details.title || title,
          url: details.url || url,
          lastUpdated: details.lastUpdated || lastUpdated,
        },
        `<p>${details.storedContent.replace(/\n/g, "<br>")}</p>`
      );
    } else {
      window.open(url, "_blank");
    }
  }
});
