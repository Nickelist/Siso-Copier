window.Siso = window.Siso || {};

Siso.Shortcuts = {
  clearShortcut: "Escape",
  copyTitleShortcut: "Ctrl+Shift+T",
  copyContentShortcut: "Ctrl+Shift+E",
  navNextShortcut: "Ctrl+Shift+N",
  navPrevShortcut: "Ctrl+Shift+P",

  init: function () {
    chrome.storage.sync.get(
      {
        clearShortcut: "Escape",
        copyTitleShortcut: "Ctrl+Shift+T",
        copyContentShortcut: "Ctrl+Shift+E",
        navNextShortcut: "Ctrl+Shift+N",
        navPrevShortcut: "Ctrl+Shift+P",
      },
      (prefs) => {
        this.clearShortcut = prefs.clearShortcut;
        this.copyTitleShortcut = prefs.copyTitleShortcut;
        this.copyContentShortcut = prefs.copyContentShortcut;
        this.navNextShortcut = prefs.navNextShortcut || "Ctrl+Shift+N";
        this.navPrevShortcut = prefs.navPrevShortcut || "Ctrl+Shift+P";

        this.setupKeyboardShortcuts();
      }
    );
  },

  setupKeyboardShortcuts: function () {
    window.addEventListener("keydown", (e) => {
      if (this.checkShortcut(e, this.clearShortcut)) {
        // console.log("Clear shortcut triggered");
        e.preventDefault();
        Siso.Highlighter.clearHighlights();
      } else if (this.checkShortcut(e, this.copyTitleShortcut)) {
        // console.log("Copy title shortcut triggered");
        e.preventDefault();
        const pageTitle = document.title || "Untitled Page";
        Siso.Actions.copyPageTitle(pageTitle);
      } else if (this.checkShortcut(e, this.copyContentShortcut)) {
        // console.log("Copy content shortcut triggered");
        e.preventDefault();
        const pageContent = Siso.Extractor.getAllPageContent();
        const pageTitle = document.title || "Untitled Page";
        Siso.Actions.copyPageContent(pageContent, pageTitle);
      } else if (this.checkShortcut(e, this.navNextShortcut)) {
        // console.log("Navigate next shortcut triggered");
        e.preventDefault();
        Siso.Navigation.navigateNext();
      } else if (this.checkShortcut(e, this.navPrevShortcut)) {
        // console.log("Navigate previous shortcut triggered");
        e.preventDefault();
        Siso.Navigation.navigatePrevious();
      }
    });
  },

  checkShortcut: function (e, shortcut) {
    if (!shortcut) return false;

    const parts = shortcut.split("+");
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    const hasCtrl = modifiers.includes("Ctrl") ? e.ctrlKey : !e.ctrlKey;
    const hasAlt = modifiers.includes("Alt") ? e.altKey : !e.altKey;
    const hasShift = modifiers.includes("Shift") ? e.shiftKey : !e.shiftKey;
    const hasMeta = modifiers.includes("Meta") ? e.metaKey : !e.metaKey;

    const keyMatch = e.key === key || e.code === key;

    return hasCtrl && hasAlt && hasShift && hasMeta && keyMatch;
  },
};
