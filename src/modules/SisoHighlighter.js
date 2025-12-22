window.Siso = window.Siso || {};

Siso.Highlighter = {
  getColorForTerm: async function (term) {
    const prefs = await Siso.Storage.getPrefs();
    if (!prefs.khMultiColorMode) {
      return prefs.khColor;
    }

    if (Siso.State.activeHighlightGroups.has(term)) {
      return Siso.State.activeHighlightGroups.get(term).color;
    }

    const palette = prefs.khColorPalette || Siso.Constants.DEFAULT_COLORS;
    const usedColors = Array.from(
      Siso.State.activeHighlightGroups.values()
    ).map((g) => g.color);
    const availableColor =
      palette.find((c) => !usedColors.includes(c)) ||
      palette[Siso.State.activeHighlightGroups.size % palette.length];

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

    Siso.State.activeHighlightGroups.set(term, {
      color: finalColor,
      count: 0,
    });

    return finalColor;
  },

  debouncedHighlight: async function (
    term,
    clearExisting = false,
    delay = Siso.Constants.HIGHLIGHT_DEBOUNCE_MS
  ) {
    return new Promise((resolve) => {
      if (Siso.State.highlightDebounceTimer) {
        clearTimeout(Siso.State.highlightDebounceTimer);
      }

      Siso.State.pendingHighlightQueue.push({ term, clearExisting, resolve });

      Siso.State.highlightDebounceTimer = setTimeout(async () => {
        if (Siso.State.isHighlighting) {
          Siso.State.highlightDebounceTimer = setTimeout(async () => {
            await this.processHighlightQueue();
          }, delay);
          return;
        }
        await this.processHighlightQueue();
      }, delay);
    });
  },

  processHighlightQueue: async function () {
    if (
      Siso.State.pendingHighlightQueue.length === 0 ||
      Siso.State.isHighlighting
    )
      return;

    Siso.State.isHighlighting = true;
    const queue = [...Siso.State.pendingHighlightQueue];
    Siso.State.pendingHighlightQueue = [];
    Siso.State.highlightDebounceTimer = null;

    try {
      for (const item of queue) {
        try {
          const result = await this.highlightAll(item.term, item.clearExisting);
          if (item.resolve) item.resolve(result);
        } catch (error) {
          console.error("Error processing highlight:", error);
          if (item.resolve) item.resolve({ count: 0, error: error.message });
        }
      }
    } finally {
      Siso.State.isHighlighting = false;
      if (Siso.State.pendingHighlightQueue.length > 0) {
        setTimeout(() => this.processHighlightQueue(), 50);
      }
    }
  },

  clearHighlights: async function (root = document.body, groupId = null) {
    const marks = root.querySelectorAll(`.${Siso.Constants.KH_CLASS}`);
    marks.forEach((mark) => {
      if (groupId !== null) {
        const markGroup = mark.getAttribute(Siso.Constants.KH_DATA_GROUP);
        if (markGroup !== groupId) return;
      }

      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });

    if (groupId === null) {
      Siso.State.activeHighlightGroups.clear();
      Siso.State.allHighlights = [];
      Siso.State.currentHighlightIndex = -1;
      Siso.State.savedHighlightTerms = [];
      Siso.Navigation.updateNavigationUI();
      await Siso.Storage.clearSavedHighlightsForPage();
    } else {
      Siso.State.activeHighlightGroups.delete(groupId);
      Siso.State.savedHighlightTerms = Siso.State.savedHighlightTerms.filter(
        (t) => t !== groupId
      );
      this.rebuildHighlightsArray();
      await Siso.Storage.saveHighlightsForPage();
    }
  },

  rebuildHighlightsArray: function () {
    Siso.State.allHighlights = Array.from(
      document.querySelectorAll(`.${Siso.Constants.KH_CLASS}`)
    );
    Siso.State.allHighlights.forEach((mark, index) => {
      mark.setAttribute(Siso.Constants.KH_DATA_INDEX, index);
    });
    if (Siso.State.currentHighlightIndex >= Siso.State.allHighlights.length) {
      Siso.State.currentHighlightIndex =
        Siso.State.allHighlights.length > 0 ? 0 : -1;
    }
    Siso.Navigation.updateNavigationUI();
  },

  highlightAll: async function (term, clearExisting = false) {
    if (!term || !term.trim()) return { count: 0 };

    const prefs = await Siso.Storage.getPrefs();
    const useMultiColor = prefs.khMultiColorMode;

    if (clearExisting && !useMultiColor) {
      this.clearHighlights();
    }

    const isLongText = term.length > 100;
    const searchTerms = isLongText
      ? term.split(/\s+/).filter((word) => word.length > 2)
      : [term];

    console.log(
      `Highlighting "${term}" (${
        isLongText ? "long text" : "short text"
      }) - found ${searchTerms.length} search terms`
    );

    const { khCaseSensitive, khWholeWord, khUseRegex } = prefs;
    let totalCount = 0;

    for (const searchTerm of searchTerms) {
      if (!searchTerm.trim()) continue;

      const color = await this.getColorForTerm(searchTerm);
      const groupId = useMultiColor ? searchTerm : "default";

      if (clearExisting && useMultiColor) {
        this.clearHighlights(document.body, groupId);
      }

      const regex = Siso.Utils.buildRegex(
        searchTerm,
        khCaseSensitive,
        khWholeWord,
        khUseRegex
      );
      if (!regex) continue;

      const includeSelectors = Siso.Utils.parseSelectors(
        prefs.khIncludeSelectors || ""
      );
      const excludeSelectors = Siso.Utils.parseSelectors(
        prefs.khExcludeSelectors || ""
      );

      const pageSize = document.body.children.length;
      const maxNodes = pageSize > 1000 ? 3000 : pageSize > 500 ? 5000 : 10000;

      const nodes = Siso.Utils.textNodesUnder(
        document.body,
        includeSelectors,
        excludeSelectors,
        maxNodes
      );
      let count = 0;

      console.log(
        `Searching for "${searchTerm}" in ${nodes.length} text nodes (limit: ${maxNodes}) with color ${color}`
      );

      const BATCH_SIZE = 100;
      for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
        const batch = nodes.slice(i, i + BATCH_SIZE);

        if (i > 0 && i % (BATCH_SIZE * 5) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        for (const textNode of batch) {
          const txt = textNode.nodeValue;
          regex.lastIndex = 0;
          let match;
          let currentNode = textNode;
          let offset = 0;

          while ((match = regex.exec(txt)) !== null) {
            const start = match.index;
            const end = start + match[0].length;

            const before = currentNode.splitText(start - offset);
            const after = before.splitText(end - start);

            const mark = document.createElement("mark");
            mark.className = `${Siso.Constants.KH_CLASS} kh-pulse`;
            mark.style.background = color;
            if (useMultiColor) {
              mark.setAttribute(Siso.Constants.KH_DATA_GROUP, groupId);
            }
            mark.appendChild(before.cloneNode(true));

            before.parentNode.replaceChild(mark, before);

            Siso.State.allHighlights.push(mark);
            mark.setAttribute(
              Siso.Constants.KH_DATA_INDEX,
              Siso.State.allHighlights.length - 1
            );

            currentNode = after;
            offset = end;
            count++;
          }
        }
      }

      if (useMultiColor && Siso.State.activeHighlightGroups.has(groupId)) {
        Siso.State.activeHighlightGroups.get(groupId).count += count;
      }

      totalCount += count;
    }

    if (clearExisting || Siso.State.allHighlights.length === totalCount) {
      Siso.State.currentHighlightIndex =
        Siso.State.allHighlights.length > 0 ? 0 : -1;
    }

    if (totalCount > 0) {
      for (const searchTerm of searchTerms) {
        if (
          searchTerm.trim() &&
          !Siso.State.savedHighlightTerms.includes(searchTerm.trim())
        ) {
          Siso.State.savedHighlightTerms.push(searchTerm.trim());
        }
      }
      await Siso.Storage.saveHighlightsForPage();
    }

    if (Siso.State.allHighlights.length > 0) {
      Siso.Navigation.createNavigationUI();
      if (Siso.State.currentHighlightIndex >= 0) {
        Siso.Navigation.navigateToHighlight(
          Siso.State.currentHighlightIndex,
          false
        );
      }
    }

    Siso.Navigation.updateNavigationUI();

    return {
      count: totalCount,
      groups: Array.from(Siso.State.activeHighlightGroups.entries()),
    };
  },
};
