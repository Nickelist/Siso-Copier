// ============================================================================
// SISO COPIER - CONTENT SCRIPT (Main Entry Point)
// ============================================================================

(function () {
  // Ensure we have the necessary modules
  if (!window.Siso) {
    console.error("Siso modules not loaded");
    return;
  }

  const {
    State,
    Constants,
    Storage,
    Highlighter,
    Navigation,
    Actions,
    Extractor,
    Shortcuts,
    UI,
  } = Siso;

  // ----------------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------------
  function init() {
    // Restore highlights on page load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => Storage.restoreHighlightsForPage(), 1000);
      });
    } else {
      setTimeout(() => Storage.restoreHighlightsForPage(), 1000);
    }

    // Restore on visibility change
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        setTimeout(() => Storage.restoreHighlightsForPage(), 500);
      }
    });

    // Initialize Keyboard Shortcuts
    Shortcuts.init();
  }

  // Run initialization
  init();

  // ----------------------------------------------------------------------------
  // MESSAGE HANDLING
  // ----------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Helper for async response
    const handleAsync = (p) => {
      p.then((res) => sendResponse(res)).catch((err) =>
        sendResponse({ ok: false, error: err.message })
      );
      return true; // Keep channel open
    };

    if (msg?.type === "KH_GET_PAGE_CONTENT") {
      const article = Extractor.getArticleData();
      const wordCount = article.text.split(/\s+/).length;
      sendResponse({
        success: true,
        wordCount,
        pageTitle: article.title,
        pageContent: article.text, // Text only version
        pageHTML: article.html,
        url: article.url,
      });
      return true;
    }

    if (msg?.type === "KH_GET_HIGHLIGHTED") {
      (async () => {
        const pageTitle = document.title || "Untitled Page";
        let highlightedTexts = [];

        // Try from state
        if (State.allHighlights && State.allHighlights.length > 0) {
          highlightedTexts = State.allHighlights
            .filter(
              (mark) => mark && mark.parentNode && document.contains(mark)
            )
            .map((mark) => mark.textContent.trim())
            .filter((text) => text.length > 0);
        }

        // Fallback to DOM
        if (highlightedTexts.length === 0) {
          highlightedTexts = Array.from(
            document.querySelectorAll(`.${Constants.KH_CLASS}`)
          )
            .map((mark) => mark.textContent.trim())
            .filter((text) => text.length > 0);

          // Resync strict state if needed
          if (highlightedTexts.length > 0) {
            Highlighter.rebuildHighlightsArray();
          }
        }

        if (highlightedTexts.length > 0) {
          const contentToCopy = highlightedTexts.join(" ");
          await Actions.saveToHistory(
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
        const ok = await Actions.copyPageTitle(pageTitle);
        sendResponse({ ok });
      })();
      return true;
    }

    if (msg?.type === "KH_COPY_CONTENT") {
      (async () => {
        const pageContent = Extractor.getAllPageContent();
        const pageTitle = document.title || "Untitled Page";
        const ok = await Actions.copyPageContent(pageContent, pageTitle);
        sendResponse({ ok });
      })();
      return true;
    }

    if (msg?.type === "KH_HIGHLIGHT") {
      (async () => {
        const prefs = await Storage.getPrefs();
        const clearExisting =
          msg.clearExisting !== undefined
            ? msg.clearExisting
            : !prefs.khMultiColorMode;

        if (clearExisting) {
          await Highlighter.clearHighlights();
        }

        const searchText = String(msg.text || "");
        const { count, groups } = await Highlighter.highlightAll(
          searchText,
          clearExisting
        );

        if (count > 0) {
          const pageTitle = document.title || "Untitled Page";
          await Actions.copyHighlightedContent(searchText, pageTitle);
        }

        sendResponse({ ok: true, count, groups });

        // Pulse effect removal
        setTimeout(() => {
          document
            .querySelectorAll(".kh-pulse")
            .forEach((el) => el.classList.remove("kh-pulse"));
        }, 1300);
      })();
      return true;
    }

    if (msg?.type === "KH_GET_ACTIVE_GROUPS") {
      sendResponse({
        ok: true,
        groups: Array.from(State.activeHighlightGroups.entries()).map(
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
        Highlighter.clearHighlights(document.body, groupId);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "No group ID provided" });
      }
      return true;
    }

    if (msg?.type === "KH_NAV_NEXT") {
      const success = Navigation.navigateNext();
      sendResponse({
        ok: success,
        index: State.currentHighlightIndex,
        total: State.allHighlights.length,
      });
      return true;
    }

    if (msg?.type === "KH_NAV_PREV") {
      const success = Navigation.navigatePrevious();
      sendResponse({
        ok: success,
        index: State.currentHighlightIndex,
        total: State.allHighlights.length,
      });
      return true;
    }

    if (msg?.type === "KH_NAV_FIRST") {
      const success = Navigation.navigateFirst();
      sendResponse({
        ok: success,
        index: State.currentHighlightIndex,
        total: State.allHighlights.length,
      });
      return true;
    }

    if (msg?.type === "KH_NAV_LAST") {
      const success = Navigation.navigateLast();
      sendResponse({
        ok: success,
        index: State.currentHighlightIndex,
        total: State.allHighlights.length,
      });
      return true;
    }

    if (msg?.type === "KH_GET_NAV_INFO") {
      sendResponse({
        ok: true,
        currentIndex: State.currentHighlightIndex,
        total: State.allHighlights.length,
        hasHighlights: State.allHighlights.length > 0,
      });
      return true;
    }

    if (msg?.type === "KH_EXPORT_MARKDOWN") {
      (async () => {
        const result = await Actions.exportMarkdown();
        sendResponse(result);
      })();
      return true;
    }

    // Fallback for KH_CLEAR (missing in above list but was in background.js calls)
    if (msg?.type === "KH_CLEAR") {
      Highlighter.clearHighlights();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
})();
