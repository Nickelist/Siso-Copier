window.Siso = window.Siso || {};

Siso.Utils = {
  isExtensionContextValid: function () {
    try {
      return chrome.runtime && chrome.runtime.id !== undefined;
    } catch (error) {
      return false;
    }
  },

  escapeRegExp: function (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  },

  buildRegex: function (term, caseSensitive, wholeWord, useRegex = false) {
    if (!term || !term.trim()) {
      return null;
    }

    const trimmedTerm = term.trim();

    // If regex mode is enabled, try to use the term as-is
    if (useRegex) {
      try {
        new RegExp(trimmedTerm);
        const boundary = wholeWord ? "\\b" : "";
        const flags = caseSensitive ? "g" : "gi";
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
        // Fall back to literal search
        const escaped = this.escapeRegExp(trimmedTerm);
        const boundary = wholeWord ? "\\b" : "";
        const flags = caseSensitive ? "g" : "gi";
        return new RegExp(`${boundary}${escaped}${boundary}`, flags);
      }
    }

    // Normal literal search
    const escaped = this.escapeRegExp(trimmedTerm);
    const boundary = wholeWord ? "\\b" : "";
    const flags = caseSensitive ? "g" : "gi";
    return new RegExp(`${boundary}${escaped}${boundary}`, flags);
  },

  isEditable: function (node) {
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
  },

  parseSelectors: function (selectorString) {
    if (!selectorString || !selectorString.trim()) return [];
    return selectorString
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  },

  matchesIncludeSelectors: function (element, includeSelectors) {
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
  },

  matchesExcludeSelectors: function (element, excludeSelectors) {
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
  },

  textNodesUnder: function (
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
        if (this.isEditable(parent)) return NodeFilter.FILTER_REJECT;
        // avoid inside script/style/noscript
        const t = parent.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT"].includes(t))
          return NodeFilter.FILTER_REJECT;
        // skip inside our own marks
        if (
          parent.classList &&
          parent.classList.contains(Siso.Constants.KH_CLASS)
        )
          return NodeFilter.FILTER_REJECT;

        // Check include selectors
        if (
          includeSelectors.length > 0 &&
          !this.matchesIncludeSelectors(parent, includeSelectors)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Check exclude selectors
        if (
          excludeSelectors.length > 0 &&
          this.matchesExcludeSelectors(parent, excludeSelectors)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const list = [];
    let n;
    let count = 0;
    while ((n = walker.nextNode()) && count < maxNodes) {
      list.push(n);
      count++;
    }
    return list;
  },
};
