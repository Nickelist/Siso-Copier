window.Siso = window.Siso || {};

Siso.Actions = {
  saveToHistory: async function (url, title, content, highlightCount = 0) {
    try {
      const historyResult = await chrome.storage.local.get([
        "kh_global_history",
      ]);
      let globalHistory = historyResult.kh_global_history || [];

      globalHistory = globalHistory.filter((item) => item.url !== url);

      globalHistory.push({
        url: url,
        title: title,
        lastUpdated: Date.now(),
        highlightCount: highlightCount,
        storedContent: content,
      });

      if (globalHistory.length > 1000) {
        globalHistory.sort((a, b) => b.lastUpdated - a.lastUpdated);
        globalHistory = globalHistory.slice(0, 1000);
      }

      await chrome.storage.local.set({ kh_global_history: globalHistory });
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  },

  copyHighlightedContent: async function (highlightedText, pageTitle) {
    try {
      const copyText = `${pageTitle}\n\nHighlighted: "${highlightedText}"\n\nSource: ${window.location.href}`;
      await navigator.clipboard.writeText(copyText);
      Siso.UI.showCopyNotification(`Copied: "${highlightedText}"`);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  },

  copyPageTitle: async function (pageTitle) {
    try {
      await navigator.clipboard.writeText(pageTitle);
      Siso.UI.showCopyNotification(`Copied page title: "${pageTitle}"`);
      return true;
    } catch (error) {
      console.error("Failed to copy page title:", error);
      return false;
    }
  },

  copyPageContent: async function (pageContent, pageTitle) {
    try {
      await navigator.clipboard.writeText(pageContent);
      const wordCount = pageContent.split(/\s+/).length;
      Siso.UI.showCopyNotification(`Copied page content (${wordCount} words)`);
      await this.saveToHistory(window.location.href, pageTitle, pageContent, 0);
      return true;
    } catch (error) {
      console.error("Failed to copy page content:", error);
      return false;
    }
  },
  exportMarkdown: async function () {
    try {
      const pageTitle = document.title || "Untitled Page";
      const pageUrl = window.location.href;
      const timestamp = new Date().toISOString();

      const prefs = await Siso.Storage.getPrefs();
      const useMultiColor = prefs.khMultiColorMode;

      let markdown = "";

      // Header
      markdown += `# ${pageTitle}\n\n`;
      markdown += `**Source:** [${pageUrl}](${pageUrl})\n`;
      markdown += `**Exported:** ${timestamp}\n`;
      markdown += `**Total Highlights:** ${Siso.State.allHighlights.length}\n\n`;
      markdown += `---\n\n`;

      if (useMultiColor && Siso.State.activeHighlightGroups.size > 0) {
        // Group by highlight groups (colors)
        const groupsMap = new Map();

        Siso.State.allHighlights.forEach((mark, index) => {
          const groupId =
            mark.getAttribute(Siso.Constants.KH_DATA_GROUP) || "default";
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
        Siso.State.allHighlights.forEach((mark, index) => {
          const text = mark.textContent.trim();
          markdown += `${index + 1}. ${text}\n`;
        });
        markdown += `\n---\n\n`;
      }

      // Add full page content section
      markdown += `## Full Page Content\n\n`;
      const pageContent = Siso.Extractor.getAllPageContent();
      markdown += `${pageContent}\n\n`;
      markdown += `---\n\n`;
      markdown += `*Exported by Siso Copier Chrome Extension*\n`;

      return { ok: true, markdown };
    } catch (error) {
      console.error("Error exporting to Markdown:", error);
      return { ok: false, error: error.message };
    }
  },
};
