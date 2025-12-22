window.Siso = window.Siso || {};

Siso.Storage = {
  getPrefs: async function () {
    if (!Siso.Utils.isExtensionContextValid()) {
      return this._getDefaultPrefs();
    }

    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(this._getDefaultPrefs(), (prefs) => {
          if (chrome.runtime.lastError) {
            resolve(this._getDefaultPrefs());
            return;
          }
          // Apply transparency
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
        });
      } catch (error) {
        resolve(this._getDefaultPrefs());
      }
    });
  },

  _getDefaultPrefs: function () {
    return {
      khColor: "rgba(59, 130, 246, 0.6)",
      khTransparency: 60,
      khCaseSensitive: false,
      khWholeWord: false,
      khUseRegex: false,
      khColorPalette: Siso.Constants.DEFAULT_COLORS,
      khMultiColorMode: false,
      khPersistHighlights: true,
      khIncludeSelectors: "",
      khExcludeSelectors: "",
    };
  },

  saveHighlightsForPage: async function () {
    try {
      if (!Siso.Utils.isExtensionContextValid()) return;

      const prefs = await this.getPrefs();
      if (!prefs.khPersistHighlights) return;

      const pageUrl = window.location.href;
      const pageTitle = document.title;

      const highlightData = {
        url: pageUrl,
        title: pageTitle,
        timestamp: Date.now(),
        terms: [],
        colorAssignments: {},
      };

      for (const [term, data] of Siso.State.activeHighlightGroups.entries()) {
        highlightData.terms.push(term);
        highlightData.colorAssignments[term] = data.color;
      }

      if (
        highlightData.terms.length === 0 &&
        Siso.State.savedHighlightTerms.length > 0
      ) {
        highlightData.terms = Siso.State.savedHighlightTerms;
      }

      const storageKey = `kh_highlights_${pageUrl}`;
      await chrome.storage.local.set({ [storageKey]: highlightData });

      // Update Global History
      const historyResult = await chrome.storage.local.get([
        "kh_global_history",
      ]);
      let globalHistory = historyResult.kh_global_history || [];
      globalHistory = globalHistory.filter((item) => item.url !== pageUrl);
      globalHistory.push({
        url: pageUrl,
        title: pageTitle,
        lastUpdated: Date.now(),
        highlightCount: highlightData.terms.length,
      });

      if (globalHistory.length > 1000) {
        globalHistory.sort((a, b) => b.lastUpdated - a.lastUpdated);
        globalHistory = globalHistory.slice(0, 1000);
      }
      await chrome.storage.local.set({ kh_global_history: globalHistory });

      console.log("Saved highlights for page:", highlightData);
    } catch (error) {
      if (
        !error.message ||
        !error.message.includes("Extension context invalidated")
      ) {
        console.error("Error saving highlights:", error);
      }
    }
  },

  restoreHighlightsForPage: async function () {
    try {
      if (!Siso.Utils.isExtensionContextValid()) return;

      const prefs = await this.getPrefs();
      if (!prefs.khPersistHighlights) return;

      const pageUrl = window.location.href;
      const storageKey = `kh_highlights_${pageUrl}`;

      const result = await chrome.storage.local.get([storageKey]);
      if (chrome.runtime.lastError) return;

      const highlightData = result[storageKey];
      if (
        !highlightData ||
        !highlightData.terms ||
        highlightData.terms.length === 0
      ) {
        return;
      }

      if (highlightData.colorAssignments) {
        for (const [term, color] of Object.entries(
          highlightData.colorAssignments
        )) {
          Siso.State.activeHighlightGroups.set(term, { color, count: 0 });
        }
      }

      Siso.State.savedHighlightTerms = highlightData.terms || [];

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => this.restoreHighlights(), 500);
        });
      } else {
        setTimeout(() => this.restoreHighlights(), 500);
      }

      console.log("Restoring highlights for page:", highlightData);
    } catch (error) {
      if (
        !error.message ||
        !error.message.includes("Extension context invalidated")
      ) {
        console.error("Error restoring highlights:", error);
      }
    }
  },

  restoreHighlights: async function () {
    if (Siso.State.savedHighlightTerms.length === 0) return;

    for (const term of Siso.State.savedHighlightTerms) {
      if (term && term.trim()) {
        await Siso.Highlighter.highlightAll(term, false);
      }
    }

    if (Siso.State.allHighlights.length > 0) {
      Siso.State.currentHighlightIndex = 0;
      Siso.Navigation.navigateToHighlight(0, false);
      Siso.Navigation.createNavigationUI();
    }
  },

  clearSavedHighlightsForPage: async function () {
    try {
      if (!Siso.Utils.isExtensionContextValid()) {
        Siso.State.savedHighlightTerms = [];
        return;
      }
      const pageUrl = window.location.href;
      const storageKey = `kh_highlights_${pageUrl}`;
      await chrome.storage.local.remove([storageKey]);
      Siso.State.savedHighlightTerms = [];
    } catch (error) {
      Siso.State.savedHighlightTerms = [];
      if (
        !error.message ||
        !error.message.includes("Extension context invalidated")
      ) {
        console.error("Error clearing saved highlights:", error);
      }
    }
  },
};
