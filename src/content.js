// ============================================================================
// SISO COPIER - CONTENT SCRIPT
// ============================================================================
// Utilities to manage highlighting selected keywords across the page
// ============================================================================

// ----------------------------------------------------------------------------
// CONSTANTS & CONFIGURATION
// ----------------------------------------------------------------------------
const KH_CLASS = "kh-mark";
const KH_DATA_GROUP = "data-kh-group";
const KH_DATA_INDEX = "data-kh-index";

// ----------------------------------------------------------------------------
// STATE MANAGEMENT
// ----------------------------------------------------------------------------
// Track active highlight groups with their colors
const activeHighlightGroups = new Map();

// Track all highlights in order for navigation
let allHighlights = [];
let currentHighlightIndex = -1;

// Track saved highlight terms for persistence
let savedHighlightTerms = [];

// Performance optimization: debouncing and batching
let highlightDebounceTimer = null;
const HIGHLIGHT_DEBOUNCE_MS = 150;
let isHighlighting = false;
let pendingHighlightQueue = [];

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

// ----------------------------------------------------------------------------
// EXTENSION CONTEXT MANAGEMENT
// ----------------------------------------------------------------------------
// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id !== undefined;
  } catch (error) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// STORAGE & PREFERENCES MANAGEMENT
// ----------------------------------------------------------------------------
// Read user prefs from storage (color & case sensitivity)
async function getPrefs() {
  if (!isExtensionContextValid()) {
    // Return default prefs if extension context is invalid
    return {
      khColor: "rgba(59, 130, 246, 0.6)",
      khTransparency: 60,
      khCaseSensitive: false,
      khWholeWord: false,
      khUseRegex: false,
      khColorPalette: DEFAULT_COLORS,
      khMultiColorMode: false,
      khPersistHighlights: true,
      khIncludeSelectors: "",
      khExcludeSelectors: "",
    };
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(
        {
          khColor: "rgba(59, 130, 246, 0.6)",
          khTransparency: 60,
          khCaseSensitive: false,
          khWholeWord: false,
          khUseRegex: false,
          khColorPalette: DEFAULT_COLORS,
          khMultiColorMode: false,
          khPersistHighlights: true,
          khIncludeSelectors: "",
          khExcludeSelectors: "",
        },
        (prefs) => {
          if (chrome.runtime.lastError) {
            // Extension context invalidated, return defaults
            resolve({
              khColor: "rgba(59, 130, 246, 0.6)",
              khTransparency: 60,
              khCaseSensitive: false,
              khWholeWord: false,
              khUseRegex: false,
              khColorPalette: DEFAULT_COLORS,
              khMultiColorMode: false,
              khPersistHighlights: true,
              khIncludeSelectors: "",
              khExcludeSelectors: "",
            });
            return;
          }
          // Apply transparency to the color if it's not already set
          if (prefs.khTransparency !== undefined) {
            const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(
              prefs.khColor || ""
            );
            if (match) {
              const r = match[1];
              const g = match[2];
              const b = match[3];
              const alpha = prefs.khTransparency / 100;
              prefs.khColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
          }
          resolve(prefs);
        }
      );
    } catch (error) {
      // Extension context invalidated
      resolve({
        khColor: "rgba(59, 130, 246, 0.6)",
        khTransparency: 60,
        khCaseSensitive: false,
        khWholeWord: false,
        khUseRegex: false,
        khColorPalette: DEFAULT_COLORS,
        khMultiColorMode: false,
        khPersistHighlights: true,
        khIncludeSelectors: "",
        khExcludeSelectors: "",
      });
    }
  });
}

// Save highlights for current page
async function saveHighlightsForPage() {
  try {
    if (!isExtensionContextValid()) {
      return; // Extension context invalidated, can't save
    }

    const prefs = await getPrefs();
    if (!prefs.khPersistHighlights) return;

    const pageUrl = window.location.href;
    const pageTitle = document.title;

    // Collect all highlight terms
    const highlightData = {
      url: pageUrl,
      title: pageTitle,
      timestamp: Date.now(),
      terms: [],
      colorAssignments: {},
    };

    // Save terms from active groups
    for (const [term, data] of activeHighlightGroups.entries()) {
      highlightData.terms.push(term);
      highlightData.colorAssignments[term] = data.color;
    }

    // If no groups but we have highlights, try to reconstruct from saved terms
    if (highlightData.terms.length === 0 && savedHighlightTerms.length > 0) {
      highlightData.terms = savedHighlightTerms;
    }

    // Save to storage using page URL as key
    const storageKey = `kh_highlights_${pageUrl}`;
    await chrome.storage.local.set({ [storageKey]: highlightData });

    // --- UPDATE GLOBAL HISTORY ---
    const historyResult = await chrome.storage.local.get(["kh_global_history"]);
    let globalHistory = historyResult.kh_global_history || [];

    // Remove existing entry for this URL if present
    globalHistory = globalHistory.filter((item) => item.url !== pageUrl);

    // Add new entry
    globalHistory.push({
      url: pageUrl,
      title: pageTitle,
      lastUpdated: Date.now(),
      highlightCount: highlightData.terms.length,
    });

    // Limit history size (optional, say 1000 items)
    if (globalHistory.length > 1000) {
      globalHistory.sort((a, b) => b.lastUpdated - a.lastUpdated);
      globalHistory = globalHistory.slice(0, 1000);
    }

    await chrome.storage.local.set({ kh_global_history: globalHistory });
    // -----------------------------
  } catch (error) {
    // Silently handle extension context invalidated errors
    if (
      !error.message ||
      !error.message.includes("Extension context invalidated")
    ) {
      console.error("Error saving highlights:", error);
    }
  }
}

// Restore highlights for current page
async function restoreHighlightsForPage() {
  try {
    if (!isExtensionContextValid()) {
      return; // Extension context invalidated, can't restore
    }

    const prefs = await getPrefs();
    if (!prefs.khPersistHighlights) return;

    const pageUrl = window.location.href;
    const storageKey = `kh_highlights_${pageUrl}`;

    const result = await chrome.storage.local.get([storageKey]);

    if (chrome.runtime.lastError) {
      // Extension context invalidated
      return;
    }

    const highlightData = result[storageKey];

    if (
      !highlightData ||
      !highlightData.terms ||
      highlightData.terms.length === 0
    ) {
      return;
    }

    // Restore color assignments
    if (highlightData.colorAssignments) {
      for (const [term, color] of Object.entries(
        highlightData.colorAssignments
      )) {
        activeHighlightGroups.set(term, { color, count: 0 });
      }
    }

    // Restore saved terms
    savedHighlightTerms = highlightData.terms || [];

    // Wait a bit for page to fully load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => restoreHighlights(), 500);
      });
    } else {
      setTimeout(() => restoreHighlights(), 500);
    }
  } catch (error) {
    // Silently handle extension context invalidated errors
    if (
      !error.message ||
      !error.message.includes("Extension context invalidated")
    ) {
      console.error("Error restoring highlights:", error);
    }
  }
}

// Restore highlights by re-highlighting saved terms
async function restoreHighlights() {
  if (savedHighlightTerms.length === 0) return;

  const prefs = await getPrefs();
  const useMultiColor = prefs.khMultiColorMode;

  // Don't clear existing, just add highlights
  for (const term of savedHighlightTerms) {
    if (term && term.trim()) {
      await highlightAll(term, false); // false = don't clear existing
    }
  }

  // Navigate to first highlight if available
  if (allHighlights.length > 0) {
    currentHighlightIndex = 0;
    navigateToHighlight(0, false);
    createNavigationUI();
  }
}

// Clear saved highlights for current page
async function clearSavedHighlightsForPage() {
  try {
    if (!isExtensionContextValid()) {
      savedHighlightTerms = [];
      return; // Extension context invalidated, just clear local state
    }

    const pageUrl = window.location.href;
    const storageKey = `kh_highlights_${pageUrl}`;
    await chrome.storage.local.remove([storageKey]);
    savedHighlightTerms = [];
  } catch (error) {
    // Silently handle extension context invalidated errors
    savedHighlightTerms = [];
    if (
      !error.message ||
      !error.message.includes("Extension context invalidated")
    ) {
      console.error("Error clearing saved highlights:", error);
    }
  }
}

// ----------------------------------------------------------------------------
// COLOR MANAGEMENT & MULTI-COLOR MODE
// ----------------------------------------------------------------------------
// Get color for a specific search term
async function getColorForTerm(term) {
  const prefs = await getPrefs();
  if (!prefs.khMultiColorMode) {
    return prefs.khColor;
  }

  // Check if we already have a color for this term
  if (activeHighlightGroups.has(term)) {
    return activeHighlightGroups.get(term).color;
  }

  // Find next available color from palette
  const palette = prefs.khColorPalette || DEFAULT_COLORS;
  const usedColors = Array.from(activeHighlightGroups.values()).map(
    (g) => g.color
  );
  const availableColor =
    palette.find((c) => !usedColors.includes(c)) ||
    palette[activeHighlightGroups.size % palette.length];

  // Apply transparency if needed
  let finalColor = availableColor;
  if (prefs.khTransparency !== undefined) {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(availableColor);
    if (match) {
      const r = match[1];
      const g = match[2];
      const b = match[3];
      const alpha = prefs.khTransparency / 100;
      finalColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // Store the color assignment
  activeHighlightGroups.set(term, { color: finalColor, count: 0 });

  return finalColor;
}

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(term, caseSensitive, wholeWord, useRegex = false) {
  if (!term || !term.trim()) {
    return null;
  }

  const trimmedTerm = term.trim();

  // If regex mode is enabled, try to use the term as-is
  if (useRegex) {
    try {
      // Validate regex pattern
      new RegExp(trimmedTerm);
      // If valid, build regex with optional word boundaries
      const boundary = wholeWord ? "\\b" : "";
      const flags = caseSensitive ? "g" : "gi";
      // Only add word boundaries if whole word is enabled and the pattern doesn't already have anchors
      if (
        wholeWord &&
        !trimmedTerm.startsWith("^") &&
        !trimmedTerm.startsWith("\\b")
      ) {
        return new RegExp(`${boundary}${trimmedTerm}${boundary}`, flags);
      }
      return new RegExp(trimmedTerm, flags);
    } catch (error) {
      console.warn("Invalid regex pattern:", trimmedTerm, error);
      // Fall back to literal search if regex is invalid
      const escaped = escapeRegExp(trimmedTerm);
      const boundary = wholeWord ? "\\b" : "";
      const flags = caseSensitive ? "g" : "gi";
      return new RegExp(`${boundary}${escaped}${boundary}`, flags);
    }
  }

  // Normal literal search
  const escaped = escapeRegExp(trimmedTerm);
  const boundary = wholeWord ? "\\b" : "";
  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(`${boundary}${escaped}${boundary}`, flags);
}

function isEditable(node) {
  if (!node) return false;
  const el = node.nodeType === 3 ? node.parentElement : node;
  if (!el) return false;
  const tag = el.tagName;
  if (!tag) return false;
  return (
    el.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

// Parse CSS selectors from string (one per line)
function parseSelectors(selectorString) {
  if (!selectorString || !selectorString.trim()) return [];
  return selectorString
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Check if element matches any of the include selectors
function matchesIncludeSelectors(element, includeSelectors) {
  if (!includeSelectors || includeSelectors.length === 0) return true;

  for (const selector of includeSelectors) {
    try {
      if (element.matches && element.matches(selector)) return true;
      if (element.closest && element.closest(selector)) return true;
    } catch (e) {
      console.warn("Invalid include selector:", selector, e);
    }
  }
  return false;
}

// Check if element matches any of the exclude selectors
function matchesExcludeSelectors(element, excludeSelectors) {
  if (!excludeSelectors || excludeSelectors.length === 0) return false;

  for (const selector of excludeSelectors) {
    try {
      if (element.matches && element.matches(selector)) return true;
      if (element.closest && element.closest(selector)) return true;
    } catch (e) {
      console.warn("Invalid exclude selector:", selector, e);
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// DOM TRAVERSAL & CONTENT FILTERING
// ----------------------------------------------------------------------------
// Optimized text node collection with early exit and batching
function textNodesUnder(
  el,
  includeSelectors = [],
  excludeSelectors = [],
  maxNodes = 5000
) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue || !node.nodeValue.trim())
        return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (isEditable(parent)) return NodeFilter.FILTER_REJECT;
      // avoid inside script/style/noscript
      const t = parent.tagName;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT"].includes(t))
        return NodeFilter.FILTER_REJECT;
      // skip inside our own marks
      if (parent.classList && parent.classList.contains(KH_CLASS))
        return NodeFilter.FILTER_REJECT;

      // Check include selectors
      if (
        includeSelectors.length > 0 &&
        !matchesIncludeSelectors(parent, includeSelectors)
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      // Check exclude selectors
      if (
        excludeSelectors.length > 0 &&
        matchesExcludeSelectors(parent, excludeSelectors)
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const list = [];
  let n;
  let count = 0;
  // Limit nodes for very large pages to prevent performance issues
  while ((n = walker.nextNode()) && count < maxNodes) {
    list.push(n);
    count++;
  }
  return list;
}

// ----------------------------------------------------------------------------
// HIGHLIGHTING CORE FUNCTIONS
// ----------------------------------------------------------------------------
// Debounced highlight function for performance
async function debouncedHighlight(
  term,
  clearExisting = false,
  delay = HIGHLIGHT_DEBOUNCE_MS
) {
  return new Promise((resolve) => {
    // Clear existing debounce timer
    if (highlightDebounceTimer) {
      clearTimeout(highlightDebounceTimer);
    }

    // Add to queue
    pendingHighlightQueue.push({ term, clearExisting, resolve });

    // Set new debounce timer
    highlightDebounceTimer = setTimeout(async () => {
      if (isHighlighting) {
        // If already highlighting, wait a bit more
        highlightDebounceTimer = setTimeout(async () => {
          await processHighlightQueue();
        }, delay);
        return;
      }

      await processHighlightQueue();
    }, delay);
  });
}

// Process the highlight queue
async function processHighlightQueue() {
  if (pendingHighlightQueue.length === 0 || isHighlighting) return;

  isHighlighting = true;
  const queue = [...pendingHighlightQueue];
  pendingHighlightQueue = [];
  highlightDebounceTimer = null;

  try {
    // Process items in queue (typically just one, but handle multiple)
    for (const item of queue) {
      try {
        const result = await highlightAll(item.term, item.clearExisting);
        if (item.resolve) item.resolve(result);
      } catch (error) {
        console.error("Error processing highlight:", error);
        if (item.resolve) item.resolve({ count: 0, error: error.message });
      }
    }
  } finally {
    isHighlighting = false;

    // If more items were added while processing, process them
    if (pendingHighlightQueue.length > 0) {
      setTimeout(() => processHighlightQueue(), 50);
    }
  }
}

async function clearHighlights(root = document.body, groupId = null) {
  const marks = root.querySelectorAll(`.${KH_CLASS}`);
  marks.forEach((mark) => {
    // If groupId is specified, only clear marks from that group
    if (groupId !== null) {
      const markGroup = mark.getAttribute(KH_DATA_GROUP);
      if (markGroup !== groupId) return;
    }

    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });

  // Remove from active groups if clearing all or specific group
  if (groupId === null) {
    activeHighlightGroups.clear();
    allHighlights = [];
    currentHighlightIndex = -1;
    savedHighlightTerms = [];
    updateNavigationUI();
    // Clear saved highlights
    await clearSavedHighlightsForPage();
  } else {
    activeHighlightGroups.delete(groupId);
    // Remove term from saved list
    savedHighlightTerms = savedHighlightTerms.filter((t) => t !== groupId);
    // Rebuild highlights array
    rebuildHighlightsArray();
    // Save updated highlights
    await saveHighlightsForPage();
  }
}

// Rebuild the highlights array after clearing or adding highlights
function rebuildHighlightsArray() {
  allHighlights = Array.from(document.querySelectorAll(`.${KH_CLASS}`));
  allHighlights.forEach((mark, index) => {
    mark.setAttribute(KH_DATA_INDEX, index);
  });
  if (currentHighlightIndex >= allHighlights.length) {
    currentHighlightIndex = allHighlights.length > 0 ? 0 : -1;
  }
  updateNavigationUI();
}

async function highlightAll(term, clearExisting = false) {
  if (!term || !term.trim()) return { count: 0 };

  const prefs = await getPrefs();
  const useMultiColor = prefs.khMultiColorMode;

  // If clearing existing and not in multi-color mode, clear all
  if (clearExisting && !useMultiColor) {
    clearHighlights();
  }

  // For very long text, we'll highlight individual words instead of the whole text
  const isLongText = term.length > 100;
  const searchTerms = isLongText
    ? term.split(/\s+/).filter((word) => word.length > 2)
    : [term];

  const { khCaseSensitive, khWholeWord, khUseRegex } = prefs;
  let totalCount = 0;

  for (const searchTerm of searchTerms) {
    if (!searchTerm.trim()) continue;

    // Get color for this term
    const color = await getColorForTerm(searchTerm);
    const groupId = useMultiColor ? searchTerm : "default";

    // If clearing existing for this specific term in multi-color mode
    if (clearExisting && useMultiColor) {
      clearHighlights(document.body, groupId);
    }

    const regex = buildRegex(
      searchTerm,
      khCaseSensitive,
      khWholeWord,
      khUseRegex
    );
    if (!regex) continue;

    // Parse selectors
    const includeSelectors = parseSelectors(prefs.khIncludeSelectors || "");
    const excludeSelectors = parseSelectors(prefs.khExcludeSelectors || "");

    // Use adaptive node limit based on page size
    const pageSize = document.body.children.length;
    const maxNodes = pageSize > 1000 ? 3000 : pageSize > 500 ? 5000 : 10000;

    const nodes = textNodesUnder(
      document.body,
      includeSelectors,
      excludeSelectors,
      maxNodes
    );
    let count = 0;

    // Batch processing for large node sets
    const BATCH_SIZE = 100;
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);

      // Allow browser to breathe between batches
      if (i > 0 && i % (BATCH_SIZE * 5) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      for (const textNode of batch) {
        const txt = textNode.nodeValue;
        regex.lastIndex = 0; // ensure start fresh per-node
        let match;
        let currentNode = textNode;
        let offset = 0;

        while ((match = regex.exec(txt)) !== null) {
          const start = match.index;
          const end = start + match[0].length;

          // split into: [before][match][after]
          const before = currentNode.splitText(start - offset);
          const after = before.splitText(end - start);

          const mark = document.createElement("mark");
          mark.className = `${KH_CLASS} kh-pulse`;
          mark.style.background = color;
          if (useMultiColor) {
            mark.setAttribute(KH_DATA_GROUP, groupId);
          }
          mark.appendChild(before.cloneNode(true));

          before.parentNode.replaceChild(mark, before);

          // Add to highlights array
          allHighlights.push(mark);
          mark.setAttribute(KH_DATA_INDEX, allHighlights.length - 1);

          // prepare for next iteration in this text node
          currentNode = after;
          offset = end;
          count++;
        }
      }
    } // Close outer batch loop

    // Update count for this group
    if (useMultiColor && activeHighlightGroups.has(groupId)) {
      activeHighlightGroups.get(groupId).count += count;
    }

    // console.log(`Found ${count} matches for "${searchTerm}"`);
    totalCount += count;
  }

  // Set current index to first highlight if starting fresh
  if (clearExisting || allHighlights.length === totalCount) {
    currentHighlightIndex = allHighlights.length > 0 ? 0 : -1;
  }

  // Save terms for persistence
  if (totalCount > 0) {
    // Add terms to saved list if not already there
    for (const searchTerm of searchTerms) {
      if (
        searchTerm.trim() &&
        !savedHighlightTerms.includes(searchTerm.trim())
      ) {
        savedHighlightTerms.push(searchTerm.trim());
      }
    }
    // Save highlights for this page
    await saveHighlightsForPage();
  }

  // Create navigation UI if we have highlights
  if (allHighlights.length > 0) {
    createNavigationUI();
    // Navigate to first highlight
    if (currentHighlightIndex >= 0) {
      navigateToHighlight(currentHighlightIndex, false); // Don't scroll yet on initial highlight
    }
  }

  updateNavigationUI();

  return {
    count: totalCount,
    groups: Array.from(activeHighlightGroups.entries()),
  };
}

// ----------------------------------------------------------------------------
// NAVIGATION FUNCTIONS
// ----------------------------------------------------------------------------
function navigateToHighlight(index, scroll = true) {
  if (index < 0 || index >= allHighlights.length) return false;

  // Remove previous active highlight
  if (
    currentHighlightIndex >= 0 &&
    currentHighlightIndex < allHighlights.length
  ) {
    allHighlights[currentHighlightIndex].classList.remove("kh-active");
  }

  currentHighlightIndex = index;
  const highlight = allHighlights[index];

  // Add active class
  highlight.classList.add("kh-active");

  // Scroll to highlight
  if (scroll) {
    highlight.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  updateNavigationUI();
  return true;
}

function navigateNext() {
  if (allHighlights.length === 0) return false;
  const nextIndex =
    currentHighlightIndex < allHighlights.length - 1
      ? currentHighlightIndex + 1
      : 0; // Wrap around
  return navigateToHighlight(nextIndex);
}

function navigatePrevious() {
  if (allHighlights.length === 0) return false;
  const prevIndex =
    currentHighlightIndex > 0
      ? currentHighlightIndex - 1
      : allHighlights.length - 1; // Wrap around
  return navigateToHighlight(prevIndex);
}

function navigateFirst() {
  if (allHighlights.length === 0) return false;
  return navigateToHighlight(0);
}

function navigateLast() {
  if (allHighlights.length === 0) return false;
  return navigateToHighlight(allHighlights.length - 1);
}

// Update navigation UI
function updateNavigationUI() {
  const navUI = document.querySelector(".kh-navigation-ui");
  if (!navUI) return;

  const counter = navUI.querySelector(".kh-match-counter");
  const prevBtn = navUI.querySelector(".kh-nav-prev");
  const nextBtn = navUI.querySelector(".kh-nav-next");

  if (counter) {
    if (allHighlights.length === 0) {
      counter.textContent = "No matches";
    } else {
      counter.textContent = `${currentHighlightIndex + 1} of ${
        allHighlights.length
      }`;
    }
  }

  if (prevBtn) {
    prevBtn.disabled = allHighlights.length === 0;
  }

  if (nextBtn) {
    nextBtn.disabled = allHighlights.length === 0;
  }
}

// Create navigation UI
async function createNavigationUI() {
  // Remove existing UI if present
  const existing = document.querySelector(".kh-navigation-ui");
  if (existing) existing.remove();

  // Check dark mode preference
  const prefs = await getPrefs();
  const darkMode = prefs.khDarkMode || "auto";
  const isDark =
    darkMode === "dark" ||
    (darkMode === "auto" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const navUI = document.createElement("div");
  navUI.className = "kh-navigation-ui";
  navUI.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${
      isDark ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)"
    };
    backdrop-filter: blur(10px);
    border: 1px solid ${
      isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.4)"
    };
    border-radius: 16px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, ${isDark ? "0.5" : "0.15"});
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: ${isDark ? "#e5e5e5" : "#1a1a1a"};
  `;

  const prevBtn = document.createElement("button");
  prevBtn.className = "kh-nav-prev";
  prevBtn.innerHTML = "◀";
  prevBtn.style.cssText = `
    background: rgba(59, 130, 246, 0.8);
    border: none;
    border-radius: 8px;
    color: white;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;
  prevBtn.addEventListener("click", navigatePrevious);
  prevBtn.addEventListener("mouseenter", () => {
    prevBtn.style.background = "rgba(59, 130, 246, 0.95)";
  });
  prevBtn.addEventListener("mouseleave", () => {
    prevBtn.style.background = "rgba(59, 130, 246, 0.8)";
  });

  const counter = document.createElement("span");
  counter.className = "kh-match-counter";
  counter.style.cssText = `
    min-width: 80px;
    text-align: center;
    color: ${isDark ? "#e5e5e5" : "#1a1a1a"};
  `;

  const nextBtn = document.createElement("button");
  nextBtn.className = "kh-nav-next";
  nextBtn.innerHTML = "▶";
  nextBtn.style.cssText = prevBtn.style.cssText;
  nextBtn.addEventListener("click", navigateNext);
  nextBtn.addEventListener("mouseenter", () => {
    nextBtn.style.background = "rgba(59, 130, 246, 0.95)";
  });
  nextBtn.addEventListener("mouseleave", () => {
    nextBtn.style.background = "rgba(59, 130, 246, 0.8)";
  });

  navUI.appendChild(prevBtn);
  navUI.appendChild(counter);
  navUI.appendChild(nextBtn);

  document.body.appendChild(navUI);
  updateNavigationUI();

  return navUI;
}

// ----------------------------------------------------------------------------
// KEYBOARD SHORTCUTS MANAGEMENT
// ----------------------------------------------------------------------------
// Keybinding: Custom shortcuts for clear highlights
let clearShortcut = "Escape";
let copyShortcut = "Ctrl+Shift+C";
let highlightShortcut = "Ctrl+Shift+H";
let copyTitleShortcut = "Ctrl+Shift+T";
let copyContentShortcut = "Ctrl+Shift+E";
let navNextShortcut = "Ctrl+Shift+N";
let navPrevShortcut = "Ctrl+Shift+P";

// Load shortcuts from storage
chrome.storage.sync.get(
  {
    clearShortcut: "Escape",
    copyShortcut: "Ctrl+Shift+C",
    highlightShortcut: "Ctrl+Shift+H",
    copyTitleShortcut: "Ctrl+Shift+T",
    copyContentShortcut: "Ctrl+Shift+E",
    navNextShortcut: "Ctrl+Shift+N",
    navPrevShortcut: "Ctrl+Shift+P",
  },
  (prefs) => {
    clearShortcut = prefs.clearShortcut;
    copyShortcut = prefs.copyShortcut;
    highlightShortcut = prefs.highlightShortcut;
    copyTitleShortcut = prefs.copyTitleShortcut;
    copyContentShortcut = prefs.copyContentShortcut;
    navNextShortcut = prefs.navNextShortcut || "Ctrl+Shift+N";
    navPrevShortcut = prefs.navPrevShortcut || "Ctrl+Shift+P";
    /*
    console.log("Loaded shortcuts:", {
      clearShortcut,
      copyShortcut,
      highlightShortcut,
      copyTitleShortcut,
      copyContentShortcut,
      navNextShortcut,
      navPrevShortcut,
    });
    */

    // Set up event listener after shortcuts are loaded
    setupKeyboardShortcuts();
  }
);

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    /*
    console.log("Key pressed:", e.key, "Shortcuts:", {
      clearShortcut,
      copyShortcut,
      highlightShortcut,
      copyTitleShortcut,
      copyContentShortcut,
    });
    */

    if (checkShortcut(e, clearShortcut)) {
      console.log("Clear shortcut triggered");
      e.preventDefault();
      clearHighlights();
    } else if (checkShortcut(e, copyShortcut)) {
      console.log("Copy shortcut triggered");
      e.preventDefault();
      // Copy all highlighted content
      const highlightedTexts = Array.from(document.querySelectorAll(".kh-mark"))
        .map((mark) => mark.textContent.trim())
        .filter((text) => text.length > 0);

      if (highlightedTexts.length > 0) {
        const contentToCopy = highlightedTexts.join(" ");
        const pageTitle = document.title || "Untitled Page";
        copyHighlightedContent(contentToCopy, pageTitle);
      } else {
        console.log("No highlighted content to copy");
      }
    } else if (checkShortcut(e, highlightShortcut)) {
      console.log("Highlight shortcut triggered");
      e.preventDefault();
      // Get selected text and highlight it
      const selection = window.getSelection();
      if (selection.toString().trim()) {
        const searchText = selection.toString().trim();
        highlightAll(searchText);
      } else {
        console.log("No text selected for highlighting");
      }
    } else if (checkShortcut(e, copyTitleShortcut)) {
      console.log("Copy title shortcut triggered");
      e.preventDefault();
      // Copy just the page title
      const pageTitle = document.title || "Untitled Page";
      copyPageTitle(pageTitle);
    } else if (checkShortcut(e, copyContentShortcut)) {
      console.log("Copy content shortcut triggered");
      e.preventDefault();
      // Copy the filtered page content
      const pageContent = getAllPageContent();
      const pageTitle = document.title || "Untitled Page";
      copyPageContent(pageContent, pageTitle);
    } else if (checkShortcut(e, navNextShortcut)) {
      console.log("Navigate next shortcut triggered");
      e.preventDefault();
      navigateNext();
    } else if (checkShortcut(e, navPrevShortcut)) {
      console.log("Navigate previous shortcut triggered");
      e.preventDefault();
      navigatePrevious();
    }
  });
}

function checkShortcut(e, shortcut) {
  if (!shortcut) return false;

  const parts = shortcut.split("+");
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1];

  // Check that the specified modifiers are pressed and others are not
  const hasCtrl = modifiers.includes("Ctrl") ? e.ctrlKey : !e.ctrlKey;
  const hasAlt = modifiers.includes("Alt") ? e.altKey : !e.altKey;
  const hasShift = modifiers.includes("Shift") ? e.shiftKey : !e.shiftKey;
  const hasMeta = modifiers.includes("Meta") ? e.metaKey : !e.metaKey;

  // Check main key
  const keyMatch = e.key === key || e.code === key;

  const result = hasCtrl && hasAlt && hasShift && hasMeta && keyMatch;

  /*
  // Debug logging for testing
  if (keyMatch) {

      shortcut,
      key,
      modifiers,
      pressed: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      },
      checks: { hasCtrl, hasAlt, hasShift, hasMeta, keyMatch },
      result,
    });
  }
  */

  return result;
}

// Helper to save content to history
async function saveToHistory(
  url,
  title,
  content,
  highlightCount = 0,
  htmlContent = null
) {
  try {
    const historyResult = await chrome.storage.local.get(["kh_global_history"]);
    let globalHistory = historyResult.kh_global_history || [];

    // Remove existing entry for this URL if present
    globalHistory = globalHistory.filter((item) => item.url !== url);

    // Add new entry
    globalHistory.push({
      url: url,
      title: title,
      lastUpdated: Date.now(),
      highlightCount: highlightCount,
      storedContent: content,
    });

    // Limit history size
    if (globalHistory.length > 1000) {
      globalHistory.sort((a, b) => b.lastUpdated - a.lastUpdated);
      globalHistory = globalHistory.slice(0, 1000);
    }

    await chrome.storage.local.set({ kh_global_history: globalHistory });

    // Save detailed HTML for Reader Mode
    if (htmlContent) {
      const key = `kh_highlights_${url}`;
      const existingData = await chrome.storage.local.get([key]);
      const details = existingData[key] || {};
      details.storedHTML = htmlContent;
      details.url = url;
      details.title = title;
      details.lastUpdated = Date.now();
      await chrome.storage.local.set({ [key]: details });
    }
  } catch (error) {
    console.error("Error saving to history:", error);
  }
}

// Auto-copy functionality
async function copyHighlightedContent(highlightedText, pageTitle) {
  try {
    // console.log("Copying content:", { highlightedText, pageTitle });
    const copyText = `${pageTitle}\n\nHighlighted: "${highlightedText}"\n\nSource: ${window.location.href}`;

    await navigator.clipboard.writeText(copyText);

    // Show a temporary notification
    showCopyNotification(`Copied: "${highlightedText}"`);

    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

// Copy page title only
async function copyPageTitle(pageTitle) {
  try {
    // console.log("Copying page title:", pageTitle);
    await navigator.clipboard.writeText(pageTitle);

    // Show a temporary notification
    showCopyNotification(`Copied page title: "${pageTitle}"`);

    return true;
  } catch (error) {
    console.error("Failed to copy page title:", error);
    return false;
  }
}

// Copy page content only
async function copyPageContent(contentData, pageTitle) {
  try {
    const pageContent = contentData.text || contentData;
    const htmlContent = contentData.html || null;

    // console.log('Copying page content:', { pageContent: pageContent.substring(0, 100) + '...', pageTitle });
    await navigator.clipboard.writeText(pageContent);

    // Show a temporary notification
    const wordCount = pageContent.split(/\s+/).length;
    showCopyNotification(`Copied page content (${wordCount} words)`);

    // Save to history
    await saveToHistory(
      window.location.href,
      pageTitle,
      pageContent,
      0,
      htmlContent
    );

    return true;
  } catch (error) {
    console.error("Failed to copy page content:", error);
    return false;
  }
}

// Show a temporary notification
async function showCopyNotification(text) {
  // Remove any existing notification
  const existing = document.querySelector(".kh-copy-notification");
  if (existing) existing.remove();

  // Check dark mode preference
  const prefs = await getPrefs();
  const darkMode = prefs.khDarkMode || "auto";
  const isDark =
    darkMode === "dark" ||
    (darkMode === "auto" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Create notification element
  const notification = document.createElement("div");
  notification.className = "kh-copy-notification";
  notification.textContent = text;
  notification.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: ${
      isDark ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)"
    };
    color: ${isDark ? "#e5e5e5" : "#1a1a1a"};
    padding: 16px 20px;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, ${isDark ? "0.5" : "0.15"});
    border: 1px solid ${
      isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.4)"
    };
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 320px;
    word-wrap: break-word;
    animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Add animation keyframes
  if (!document.querySelector("#kh-notification-styles")) {
    const style = document.createElement("style");
    style.id = "kh-notification-styles";
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ----------------------------------------------------------------------------
// CONTENT EXTRACTION & EXPORT
// ----------------------------------------------------------------------------
// Function to get all page content (safe version that doesn't modify DOM)
// Function to get all page content using a scoring-based approach (simplified Readability)
function getAllPageContent() {
  try {
    // 1. Candidates Identification
    // We look for paragraphs as they are the building blocks of articles
    const paragraphs = document.getElementsByTagName("p");
    const candidates = new Map(); // Map<Element, score>

    // Helper to get or initialize score
    const getScore = (el) => candidates.get(el) || 0;
    const setScore = (el, score) => candidates.set(el, score);
    const addToScore = (el, points) =>
      candidates.set(el, (candidates.get(el) || 0) + points);

    // Helper to score based on class/id
    const scoreProps = (el) => {
      let score = 0;
      const props = (el.className + " " + el.id).toLowerCase();

      // Positive indicators
      if (
        /(article|body|content|entry|hentry|main|page|pagination|post|text|blog|story)/.test(
          props
        )
      )
        score += 5;

      // Negative indicators
      if (
        /(comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget|header|nav|menu|social)/.test(
          props
        )
      )
        score -= 25;

      return score;
    };

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const text = p.textContent;

      // Skip short paragraphs
      if (text.length < 25) continue;

      // Initialize parent and grandparent
      const parent = p.parentNode;
      const grandparent = parent.parentNode;

      if (!candidates.has(parent)) {
        setScore(parent, scoreProps(parent));
        // Base score for being a paragraph container
        addToScore(parent, 10);
      }
      if (grandparent && !candidates.has(grandparent)) {
        setScore(grandparent, scoreProps(grandparent));
        // Less score for grandparent
        addToScore(grandparent, 5);
      }

      // Add points for content length
      let contentScore = 1;
      // Add points for commas (indicative of sentence structure)
      contentScore += text.split(",").length;
      // For every 100 chars, add a point, up to 3
      contentScore += Math.min(Math.floor(text.length / 100), 3);

      addToScore(parent, contentScore);
      if (grandparent) addToScore(grandparent, contentScore / 2);
    }

    // 2. Find Top Candidate
    let topCandidate = null;
    let maxScore = 0;

    for (const [el, score] of candidates.entries()) {
      // Scale score by link density (penalize containers that are mostly links)
      const linkDensity = getLinkDensity(el);
      const finalScore = score * (1 - linkDensity);

      candidates.set(el, finalScore);

      if (finalScore > maxScore) {
        maxScore = finalScore;
        topCandidate = el;
      }
    }

    // Fallback if no good candidate found
    if (!topCandidate || maxScore < 20) {
      /*
      console.log(
        "No strong candidate found, falling back to body text extraction"
      );
      */
      return getBodyTextFallback();
    }

    // 3. Extract and Clean Content from Top Candidate
    // We clone the node to avoid modifying the live DOM
    const clone = topCandidate.cloneNode(true);

    // Remove unlikely candidates from the clone
    cleanNode(clone, "script");
    cleanNode(clone, "style");
    cleanNode(clone, "noscript");
    cleanNode(clone, "iframe");
    cleanNode(clone, "object");
    cleanNode(clone, "button");
    cleanNode(clone, "input");
    cleanNode(clone, "select");
    cleanNode(clone, "textarea");
    cleanNode(clone, "nav");
    cleanNode(clone, "footer");
    cleanNode(clone, "header");
    cleanNode(clone, "aside");

    // Remove elements with negative class names within the content
    const allElements = clone.getElementsByTagName("*");
    for (let i = allElements.length - 1; i >= 0; i--) {
      const el = allElements[i];
      const props = (el.className + " " + el.id).toLowerCase();
      // Aggressive filtering for common noise within articles
      if (
        /(share|social|related|sidebar|advert|promo|sponsor|newsletter|subscribe|comment|meta|tags)/.test(
          props
        )
      ) {
        // Be careful not to remove the content itself if the container has a bad name but good content
        // But for inner elements, it's usually safe
        el.parentNode.removeChild(el);
      }
    }

    // Get text content and clean up whitespace

    // Normalize Images (Fix Lazy Loading)
    const images = clone.getElementsByTagName("img");
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const realSrc =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy") ||
        img.src;

      if (realSrc) {
        img.src = realSrc;
        img.removeAttribute("data-src");
        img.removeAttribute("loading");
      }
      img.style.display = "block";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.margin = "1em auto";
    }

    return {
      text: clone.textContent.replace(/\s+/g, " ").trim(),
      html: clone.innerHTML,
    };
  } catch (error) {
    console.error("Error in getAllPageContent:", error);
    return { text: getBodyTextFallback(), html: "" };
  }
}

// Helper to calculate link density
function getLinkDensity(el) {
  const links = el.getElementsByTagName("a");
  const textLength = el.textContent.length;
  let linkLength = 0;
  for (let i = 0; i < links.length; i++) {
    linkLength += links[i].textContent.length;
  }
  return textLength === 0 ? 0 : linkLength / textLength;
}

// Helper to remove elements by tag name
function cleanNode(el, tag) {
  const targetList = el.getElementsByTagName(tag);
  for (let i = targetList.length - 1; i >= 0; i--) {
    targetList[i].parentNode.removeChild(targetList[i]);
  }
}

// Fallback function (similar to original but slightly improved)
function getBodyTextFallback() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tag = parent.tagName;
        if (
          [
            "SCRIPT",
            "STYLE",
            "NOSCRIPT",
            "IFRAME",
            "OBJECT",
            "HEAD",
            "NAV",
            "FOOTER",
            "ASIDE",
            "BUTTON",
          ].includes(tag)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Basic class filtering
        const props = (parent.className + " " + parent.id).toLowerCase();
        if (
          /(menu|nav|footer|header|social|share|sidebar|popup|modal|cookie)/.test(
            props
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node.nodeValue.trim());
  }
  return textNodes.join(" ").replace(/\s+/g, " ").trim();
}

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------
// Initialize: Restore highlights on page load
(function init() {
  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => restoreHighlightsForPage(), 1000);
    });
  } else {
    setTimeout(() => restoreHighlightsForPage(), 1000);
  }

  // Also listen for page visibility changes (e.g., when navigating back)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      setTimeout(() => restoreHighlightsForPage(), 500);
    }
  });
})();

// ----------------------------------------------------------------------------
// MESSAGE HANDLING (Chrome Runtime API)
// ----------------------------------------------------------------------------
// Listen for background messages
// --- Visual Inspector Mode ---
let isInspectorActive = false;
let highlighedElement = null;

function toggleInspector() {
  isInspectorActive = !isInspectorActive;

  if (isInspectorActive) {
    document.body.style.cursor = "crosshair";

    // Create and inject style to disable interaction with iframes/ads so we can click them
    const style = document.createElement("style");
    style.id = "kh-inspector-style";
    style.textContent = `
      iframe, embed, object { pointer-events: none !important; }
      a { pointer-events: none !important; cursor: crosshair !important; }
      * { cursor: crosshair !important; }
      .kh-highlight-blur {
        outline: 2px solid #0d9488 !important;
        box-shadow: 0 0 15px 5px rgba(13, 148, 136, 0.4) !important;
        filter: grayscale(0.2) contrast(1.1) brightness(1.1) !important;
        transition: all 0.2s ease !important;
        position: relative !important; 
        z-index: 999990 !important;
      }
    `;
    document.head.appendChild(style);

    document.addEventListener("mouseover", handleInspectorHover, true);
    document.addEventListener("click", handleInspectorClick, true);
    createInspectorToast(
      "Inspector Active. Click elements to remove. (Links & Iframes disabled)"
    );
  } else {
    document.body.style.cursor = "default";

    // Remove inspector styles
    const style = document.getElementById("kh-inspector-style");
    if (style) style.remove();

    document.removeEventListener("mouseover", handleInspectorHover, true);
    document.removeEventListener("click", handleInspectorClick, true);
    if (highlighedElement) {
      highlighedElement.classList.remove("kh-highlight-blur");
      highlighedElement = null;
    }
    removeInspectorToast();
  }
  return isInspectorActive;
}

function handleInspectorHover(e) {
  if (!isInspectorActive) return;
  e.preventDefault();
  e.stopPropagation();

  if (highlighedElement) {
    highlighedElement.classList.remove("kh-highlight-blur");
  }

  highlighedElement = e.target;
  highlighedElement.classList.add("kh-highlight-blur");
}

function handleInspectorClick(e) {
  if (!isInspectorActive) return;
  e.preventDefault();
  e.stopPropagation();

  const target = e.target;

  // 1. Visual Effect: Particle Explosion
  createParticleExplosion(target);

  // 2. Hide Element (immediately visually, fully removed after delay to prevent layout jump during anim)
  // Use visibility:hidden to keep layout stable for a split second, or just display:none
  // display:none is better for "removing" ads instantly. The particles will persist on top.
  target.style.display = "none";

  // Generate Selector
  const selector = generateSelector(target);

  // Save to Storage
  chrome.storage.sync.get({ khExcludeSelectors: "" }, (data) => {
    let current = data.khExcludeSelectors || "";
    if (current) current += "\n";
    current += selector;
    chrome.storage.sync.set({ khExcludeSelectors: current });
  });

  // Feedback
  createInspectorToast("Element Dissolved & Removed");
}

function createParticleExplosion(target) {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return; // Skip if invisible

  // Extract colors from element
  const computed = window.getComputedStyle(target);
  const bgColor = computed.backgroundColor;
  const textColor = computed.color;
  const borderColor = computed.borderLeftColor;

  // Create palette
  const colors = [bgColor, textColor, borderColor, "#0d9488"].filter(
    (c) => c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent"
  );
  if (colors.length === 0) colors.push("#0d9488", "#ccfbf1");

  // Create particles
  const particleCount = 100;

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");

    // Initial Position (Random within element)
    const initialX = rect.left + window.scrollX + Math.random() * rect.width;
    const initialY = rect.top + window.scrollY + Math.random() * rect.height;

    // Size (Random 3px to 7px)
    const size = Math.random() * 4 + 3;

    p.style.position = "absolute";
    p.style.left = initialX + "px";
    p.style.top = initialY + "px";
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px"; // Mix of circles and squares
    p.style.pointerEvents = "none";
    p.style.zIndex = "999999";
    p.style.opacity = "1";
    // Slower, floaty transition
    p.style.transition =
      "transform 1.5s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 1.5s ease-in";

    document.body.appendChild(p);

    // Trigger Animation (Next Frame)
    requestAnimationFrame(() => {
      // Physics: Explode outward + Drift Upward (Dust effect)
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 80 + 30; // Explosion force around 30-110px

      const driftY = -1 * (Math.random() * 100 + 50); // Upward drift 50-150px

      const destX = Math.cos(angle) * velocity;
      const destY = Math.sin(angle) * velocity + driftY; // Combine explosion + gravity

      // Random rotation
      const rotate = (Math.random() - 0.5) * 720;

      p.style.transform = `translate(${destX}px, ${destY}px) rotate(${rotate}deg) scale(0)`;
      p.style.opacity = "0";
    });

    // Cleanup
    setTimeout(() => {
      if (p.parentNode) p.remove();
    }, 1500);
  }
}

function generateSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === "string") {
    const classes = el.className
      .split(" ")
      .filter((c) => c.trim())
      .join(".");
    if (classes) return `.${classes}`;
  }
  return el.tagName.toLowerCase();
}

let toastEl = null;
function createInspectorToast(msg) {
  removeInspectorToast();
  toastEl = document.createElement("div");
  toastEl.textContent = msg;
  toastEl.style.cssText =
    "position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px 20px; border-radius: 8px; z-index: 999999; font-family: sans-serif; font-size: 14px;";
  document.body.appendChild(toastEl);
}
function removeInspectorToast() {
  if (toastEl) toastEl.remove();
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === "KH_TOGGLE_INSPECTOR") {
    const isActive = toggleInspector();
    sendResponse({ success: true, isActive });
    return true;
  }
  if (msg?.type === "KH_GET_PAGE_CONTENT") {
    (async () => {
      try {
        const clone = document.body.cloneNode(true);

        // Heuristic function to extract article content
        function extractArticle() {
          // 1. Initial aggressive removal by selector
          const toRemove = [
            "nav",
            "header",
            "footer",
            "script",
            "style",
            "iframe",
            "noscript",
            "aside",
            "button",
            "video",
            "audio",
            "object",
            "embed",
            "track",
            "source",
            "param",
            ".sidebar",
            "#sidebar",
            ".ad",
            ".ads",
            ".advertisement",
            ".menu",
            ".comments",
            ".cookie-banner",
            ".popup",
            "[role='alert']",
            "[role='dialog']",
            ".related-posts",
            ".related-articles",
            ".read-more",
            ".pagination",
            ".social-share",
            ".share-buttons",
            ".author-bio",
            ".newsletter-signup",
            ".promoted-content",
            ".sponsored",
            ".outbrain",
            ".taboola",
            ".reuters-graphics",
            "[data-testid='LicenceContentButton']",
          ];
          toRemove.forEach((sel) => {
            clone.querySelectorAll(sel).forEach((el) => el.remove());
          });

          // 2. Find Best Candidate
          let bestCandidate = clone;
          let maxScore = 0;

          const candidates = clone.querySelectorAll(
            "article, main, .content, .post, .article, .body, #content, #main, .story-content"
          );
          if (candidates.length > 0) {
            candidates.forEach((cand) => {
              // Check density of links vs text
              const links = cand.querySelectorAll("a").length;
              const pCount = cand.querySelectorAll("p").length;
              const textLen = cand.textContent.length;

              if (pCount === 0 && textLen < 200) return;
              if (pCount > 0 && links / pCount > 2) return; // Stricter link density check

              const score = pCount * 50 + textLen;
              if (score > maxScore) {
                maxScore = score;
                bestCandidate = cand;
              }
            });
          } else {
            clone.querySelectorAll("div").forEach((div) => {
              const pCount = div.querySelectorAll("p").length;
              if (pCount > 3) {
                const textLen = div.textContent.length;
                const score = pCount * 50 + textLen;
                if (score > maxScore) {
                  maxScore = score;
                  bestCandidate = div;
                }
              }
            });
          }

          // 3. Advanced Cleaning on Candidate
          const content = bestCandidate;

          // A. Remove "Read Next" / "Related" blocks
          // Look for headers that strongly indicate a related section and remove them + following siblings
          const relatedKeywords = [
            "read next",
            "read more",
            "related stories",
            "related articles",
            "more from",
            "recommended",
            "you might like",
          ];
          const headers = content.querySelectorAll(
            "h1, h2, h3, h4, h5, h6, strong, div[class*='header']"
          );

          headers.forEach((h) => {
            const text = h.textContent.trim().toLowerCase();
            if (
              text.length < 50 &&
              relatedKeywords.some((kw) => text.includes(kw))
            ) {
              // Found a related header. Remove it and EVERYTHING after it in this container
              // often related links follow immediately.
              let next = h.nextElementSibling;
              h.remove();
              while (next) {
                let toRemove = next;
                next = next.nextElementSibling;
                toRemove.remove();
              }
            }
          });

          // B. Remove Lists that are Link Farms (mostly links)
          content.querySelectorAll("ul, ol").forEach((list) => {
            const links = list.querySelectorAll("a").length;
            const items = list.querySelectorAll("li").length;
            if (items > 0 && links / items >= 0.8) {
              // 80% or more of items are links -> likely navigation or related list
              list.remove();
            }
          });

          // C. Clean Attributes & Resolve Links
          const walker = document.createTreeWalker(
            content,
            NodeFilter.SHOW_ELEMENT
          );
          const nodesToRemove = [];

          const adKeywords = [
            "doubleclick",
            "adservice",
            "googleadservices",
            "tracker",
            "campaign",
            "sponsored",
            "paid-content",
            "marketing",
            "promotion",
          ];

          while (walker.nextNode()) {
            const node = walker.currentNode;
            node.removeAttribute("class");
            node.removeAttribute("id");
            node.removeAttribute("style");

            // Remove known empty ad containers by common attributes
            if (node.getAttribute("data-ad") || node.getAttribute("ads")) {
              nodesToRemove.push(node);
              continue;
            }

            // Remove specific Licensing links and Ad Links
            if (node.tagName === "A") {
              const href = node.getAttribute("href") || "";
              const txt = node.textContent.toLowerCase();

              if (
                txt.includes("purchase licensing rights") ||
                adKeywords.some((kw) => href.includes(kw) || txt.includes(kw))
              ) {
                nodesToRemove.push(node);
                continue;
              }

              try {
                node.href = new URL(href, window.location.href).href;
              } catch (e) {}
            }

            if (node.tagName === "IMG") {
              try {
                node.src = new URL(
                  node.getAttribute("src"),
                  window.location.href
                ).href;
              } catch (e) {}
              if (node.width > 0 && node.width < 100 && node.height < 100)
                nodesToRemove.push(node); // Tiny images
            } else if (node.tagName !== "A") {
              // Strip non-semantic attributes
              while (node.attributes.length > 0) {
                node.removeAttribute(node.attributes[0].name);
              }
            }
          }
          nodesToRemove.forEach((n) => n.remove());

          // D. Recursive Empty Element & Spacing Remover
          // 5 passes to clean up empty parents
          let modifications = true;
          let passes = 0;
          while (modifications && passes < 5) {
            modifications = false;
            const allNodes = content.querySelectorAll("*");

            allNodes.forEach((node) => {
              const tag = node.tagName;
              // Clean up consecutive BRs
              if (tag === "BR") {
                let next = node.nextElementSibling;
                while (next && next.tagName === "BR") {
                  next.remove();
                  next = node.nextElementSibling; // Re-check new sibling
                }
                return; // Keep single BRs? Or remove all? User said "huge empty spacing". Single BR is usually OK.
              }

              if (["IMG", "HR"].includes(tag)) return;

              const text = node.textContent
                .replace(/[\u00A0\t\n]/g, " ")
                .trim();
              const hasImg = node.querySelector("img");

              // Remove Specific Empty Tags
              if (
                [
                  "SVG",
                  "CANVAS",
                  "FIGURE",
                  "PICTURE",
                  "VIDEO",
                  "AUDIO",
                  "IFRAME",
                  "OBJECT",
                  "EMBED",
                ].includes(tag)
              ) {
                if (!hasImg && text.length === 0) {
                  // If it's a video tag, we want it GONE primarily.
                  node.remove();
                  modifications = true;
                  return;
                }
              }

              // Remove lists
              if (["UL", "OL"].includes(tag)) {
                if (node.querySelectorAll("li").length === 0) {
                  node.remove();
                  modifications = true;
                  return;
                }
              }

              // General Empty Check
              if (text.length === 0 && !hasImg) {
                node.remove();
                modifications = true;
              }
            });
            passes++;
          }

          // E. Normalize Images (Fix Lazy Loading)
          const images = content.getElementsByTagName("img");
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const realSrc =
              img.getAttribute("data-src") ||
              img.getAttribute("data-original") ||
              img.getAttribute("data-lazy") ||
              img.src;

            if (realSrc) {
              img.src = realSrc;
              img.removeAttribute("data-src");
              img.removeAttribute("loading");
            }
            img.style.display = "block";
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            img.style.margin = "1em auto";
          }

          return {
            title: document.title,
            text: content.textContent.trim(),
            html: content.innerHTML,
            url: window.location.href,
          };
        }

        const article = extractArticle();
        const wordCount = article.text.split(/\s+/).length;

        sendResponse({
          success: true,
          wordCount,
          pageTitle: article.title,
          pageContent: article.text,
          pageHTML: article.html,
          url: article.url,
        });
      } catch (error) {
        console.error("Failed to extract page content:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  if (msg?.type === "KH_GET_HIGHLIGHTED") {
    (async () => {
      const pageTitle = document.title || "Untitled Page";

      let highlightedTexts = [];
      if (allHighlights && allHighlights.length > 0) {
        // Filter out any invalid/non-existent elements
        highlightedTexts = allHighlights
          .filter((mark) => mark && mark.parentNode && document.contains(mark))
          .map((mark) => {
            try {
              return mark.textContent.trim();
            } catch (e) {
              return "";
            }
          })
          .filter((text) => text.length > 0);
      }

      // Fallback: if array is empty or out of sync, query DOM directly
      if (highlightedTexts.length === 0) {
        highlightedTexts = Array.from(document.querySelectorAll(`.${KH_CLASS}`))
          .filter((mark) => mark && mark.parentNode && document.contains(mark))
          .map((mark) => {
            try {
              return mark.textContent.trim();
            } catch {
              return "";
            }
          })
          .filter((text) => text.length > 0);

        // Sync the array with DOM if we found elements there but not in array
        if (highlightedTexts.length > 0) {
          allHighlights = Array.from(
            document.querySelectorAll(`.${KH_CLASS}`)
          ).filter(
            (mark) => mark && mark.parentNode && document.contains(mark)
          );
        }
      }

      if (highlightedTexts.length > 0) {
        const contentToCopy = highlightedTexts.join(" ");

        // Save to history
        await saveToHistory(
          window.location.href,
          pageTitle,
          contentToCopy,
          highlightedTexts.length
        );

        sendResponse({
          ok: true,
          count: highlightedTexts.length,
          pageTitle,
          content: contentToCopy,
          url: window.location.href,
        });
      } else {
        sendResponse({ ok: false, error: "No highlighted content found" });
      }
    })();
    return true;
  }
  if (msg?.type === "KH_COPY_TITLE") {
    (async () => {
      const pageTitle = document.title || "Untitled Page";
      try {
        await navigator.clipboard.writeText(pageTitle);
        showCopyNotification(`Copied page title: ${pageTitle}`);
        sendResponse({ ok: true });
      } catch (error) {
        console.error("Failed to copy page title:", error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  if (msg?.type === "KH_COPY_CONTENT") {
    (async () => {
      try {
        const contentData = getAllPageContent();
        const pageContent = contentData.text;
        const pageTitle = document.title || "Untitled Page";
        await navigator.clipboard.writeText(pageContent);
        const wordCount = pageContent.split(/\s+/).length;
        showCopyNotification(`Copied page content (${wordCount} words)`);

        // Save to history
        await saveToHistory(
          window.location.href,
          pageTitle,
          pageContent,
          0,
          contentData.html
        );

        sendResponse({ ok: true });
      } catch (error) {
        console.error("Failed to copy page content:", error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  if (msg?.type === "KH_HIGHLIGHT") {
    (async () => {
      const prefs = await getPrefs();
      const clearExisting =
        msg.clearExisting !== undefined
          ? msg.clearExisting
          : !prefs.khMultiColorMode;

      if (clearExisting) {
        await clearHighlights();
      }

      const searchText = String(msg.text || "");
      const { count, groups } = await highlightAll(searchText, clearExisting);

      // Auto-copy the highlighted content and page title
      if (count > 0) {
        const pageTitle = document.title || "Untitled Page";
        // Use the original search text (full content) for copying
        const contentToCopy = searchText;

        await copyHighlightedContent(contentToCopy, pageTitle);
      }

      sendResponse({ ok: true, count, groups });
      setTimeout(() => {
        document
          .querySelectorAll(".kh-pulse")
          .forEach((el) => el.classList.remove("kh-pulse"));
      }, 1300);
    })();
    // Keep channel open for async
    return true;
  }
  if (msg?.type === "KH_GET_ACTIVE_GROUPS") {
    sendResponse({
      ok: true,
      groups: Array.from(activeHighlightGroups.entries()).map(
        ([term, data]) => ({
          term,
          color: data.color,
          count: data.count,
        })
      ),
    });
    return true;
  }
  if (msg?.type === "KH_CLEAR_GROUP") {
    const groupId = msg.groupId;
    if (groupId) {
      clearHighlights(document.body, groupId);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: "No group ID provided" });
    }
    return true;
  }
  if (msg?.type === "KH_NAV_NEXT") {
    const success = navigateNext();
    sendResponse({
      ok: success,
      index: currentHighlightIndex,
      total: allHighlights.length,
    });
    return true;
  }
  if (msg?.type === "KH_NAV_PREV") {
    const success = navigatePrevious();
    sendResponse({
      ok: success,
      index: currentHighlightIndex,
      total: allHighlights.length,
    });
    return true;
  }
  if (msg?.type === "KH_NAV_FIRST") {
    const success = navigateFirst();
    sendResponse({
      ok: success,
      index: currentHighlightIndex,
      total: allHighlights.length,
    });
    return true;
  }
  if (msg?.type === "KH_NAV_LAST") {
    const success = navigateLast();
    sendResponse({
      ok: success,
      index: currentHighlightIndex,
      total: allHighlights.length,
    });
    return true;
  }
  if (msg?.type === "KH_GET_NAV_INFO") {
    sendResponse({
      ok: true,
      currentIndex: currentHighlightIndex,
      total: allHighlights.length,
      hasHighlights: allHighlights.length > 0,
    });
    return true;
  }
  if (msg?.type === "KH_EXPORT_MARKDOWN") {
    (async () => {
      try {
        const pageTitle = document.title || "Untitled Page";
        const pageUrl = window.location.href;
        const timestamp = new Date().toISOString();

        const prefs = await getPrefs();
        const useMultiColor = prefs.khMultiColorMode;

        let markdown = "";

        // Header
        markdown += `# ${pageTitle}\n\n`;
        markdown += `**Source:** [${pageUrl}](${pageUrl})\n`;
        markdown += `**Exported:** ${timestamp}\n`;
        markdown += `**Total Highlights:** ${allHighlights.length}\n\n`;
        markdown += `---\n\n`;

        if (useMultiColor && activeHighlightGroups.size > 0) {
          // Group by highlight groups (colors)
          const groupsMap = new Map();

          allHighlights.forEach((mark, index) => {
            const groupId = mark.getAttribute(KH_DATA_GROUP) || "default";
            const text = mark.textContent.trim();
            const color = mark.style.background || "default";

            if (!groupsMap.has(groupId)) {
              groupsMap.set(groupId, {
                term: groupId,
                color: color,
                highlights: [],
              });
            }
            groupsMap.get(groupId).highlights.push({ index: index + 1, text });
          });

          // Export by groups
          let groupIndex = 1;
          for (const [groupId, group] of groupsMap.entries()) {
            if (groupId !== "default") {
              markdown += `## Highlight Group ${groupIndex}: "${groupId}"\n\n`;
              markdown += `**Color:** ${group.color}\n`;
              markdown += `**Matches:** ${group.highlights.length}\n\n`;

              group.highlights.forEach((item, idx) => {
                markdown += `${idx + 1}. ${item.text}\n`;
              });

              markdown += `\n---\n\n`;
              groupIndex++;
            } else {
              // Default group highlights
              markdown += `## Highlights\n\n`;
              group.highlights.forEach((item, idx) => {
                markdown += `${idx + 1}. ${item.text}\n`;
              });
              markdown += `\n---\n\n`;
            }
          }
        } else {
          // Simple list format
          markdown += `## Highlights\n\n`;
          allHighlights.forEach((mark, index) => {
            const text = mark.textContent.trim();
            markdown += `${index + 1}. ${text}\n`;
          });
          markdown += `\n---\n\n`;
        }

        // Add full page content section
        markdown += `## Full Page Content\n\n`;
        const contentData = getAllPageContent();
        const markdownContent = htmlToMarkdown(contentData.html);
        markdown += `${markdownContent}\n\n`;
        markdown += `---\n\n`;
        markdown += `*Exported by Siso Copier Chrome Extension*\n`;

        sendResponse({ ok: true, markdown });
      } catch (error) {
        console.error("Error exporting to Markdown:", error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
});

// ----------------------------------------------------------------------------
// MARKDOWN CONVERSION UTILITY
// ----------------------------------------------------------------------------
function htmlToMarkdown(html) {
  if (!html) return "";

  // Create a temporary element to manipulate the HTML
  const div = document.createElement("div");
  div.innerHTML = html;

  // Helper to process nodes recursively
  function processNode(node) {
    if (node.nodeType === 3) {
      // Text node
      return node.nodeValue;
    }

    if (node.nodeType !== 1) return ""; // Skip comments, etc.

    const tagName = node.tagName.toLowerCase();
    let content = "";

    // Process children
    for (const child of node.childNodes) {
      content += processNode(child);
    }

    // Remove excessive whitespace
    if (
      [
        "p",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "blockquote",
      ].includes(tagName)
    ) {
      content = content.trim();
    }

    switch (tagName) {
      case "h1":
        return `\n# ${content}\n\n`;
      case "h2":
        return `\n## ${content}\n\n`;
      case "h3":
        return `\n### ${content}\n\n`;
      case "h4":
        return `\n#### ${content}\n\n`;
      case "h5":
        return `\n##### ${content}\n\n`;
      case "h6":
        return `\n###### ${content}\n\n`;
      case "p":
        return `\n${content}\n\n`;
      case "br":
        return "  \n";
      case "b":
      case "strong":
        return `**${content}**`;
      case "i":
      case "em":
        return `*${content}*`;
      case "code":
        return `\`${content}\``;
      case "pre":
        return `\n\`\`\`\n${content}\n\`\`\`\n\n`;
      case "a": {
        const href = node.getAttribute("href");
        return href ? `[${content}](${href})` : content;
      }
      case "img": {
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || "";
        // Handle lazy loading attributes if standard src is missing
        const realSrc = src || node.getAttribute("data-src") || "";
        if (!realSrc) return "";
        return `\n![${alt}](${realSrc})\n`;
      }
      case "ul":
        return `\n${content}\n`;
      case "ol":
        return `\n${content}\n`;
      case "li":
        return `- ${content}\n`;
      case "blockquote":
        return `\n> ${content}\n\n`;
      case "figure":
        return `\n${content}\n`;
      case "figcaption":
        return `\n_${content}_\n\n`;
      default:
        return content;
    }
  }

  // Process the entire tree
  return processNode(div)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
