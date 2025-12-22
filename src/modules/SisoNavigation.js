window.Siso = window.Siso || {};

Siso.Navigation = {
  navigateToHighlight: function (index, scroll = true) {
    if (index < 0 || index >= Siso.State.allHighlights.length) return false;

    // Remove previous active highlight
    if (
      Siso.State.currentHighlightIndex >= 0 &&
      Siso.State.currentHighlightIndex < Siso.State.allHighlights.length
    ) {
      Siso.State.allHighlights[
        Siso.State.currentHighlightIndex
      ].classList.remove("kh-active");
    }

    Siso.State.currentHighlightIndex = index;
    const highlight = Siso.State.allHighlights[index];

    // Add active class
    highlight.classList.add("kh-active");

    // Scroll to highlight
    if (scroll) {
      highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    this.updateNavigationUI();
    return true;
  },

  navigateNext: function () {
    if (Siso.State.allHighlights.length === 0) return false;
    const nextIndex =
      Siso.State.currentHighlightIndex < Siso.State.allHighlights.length - 1
        ? Siso.State.currentHighlightIndex + 1
        : 0; // Wrap around
    return this.navigateToHighlight(nextIndex);
  },

  navigatePrevious: function () {
    if (Siso.State.allHighlights.length === 0) return false;
    const prevIndex =
      Siso.State.currentHighlightIndex > 0
        ? Siso.State.currentHighlightIndex - 1
        : Siso.State.allHighlights.length - 1; // Wrap around
    return this.navigateToHighlight(prevIndex);
  },

  navigateFirst: function () {
    if (Siso.State.allHighlights.length === 0) return false;
    return this.navigateToHighlight(0);
  },

  navigateLast: function () {
    if (Siso.State.allHighlights.length === 0) return false;
    return this.navigateToHighlight(Siso.State.allHighlights.length - 1);
  },

  updateNavigationUI: function () {
    const navUI = document.querySelector(".kh-navigation-ui");
    if (!navUI) return;

    const counter = navUI.querySelector(".kh-match-counter");
    const prevBtn = navUI.querySelector(".kh-nav-prev");
    const nextBtn = navUI.querySelector(".kh-nav-next");

    if (counter) {
      if (Siso.State.allHighlights.length === 0) {
        counter.textContent = "No matches";
      } else {
        counter.textContent = `${Siso.State.currentHighlightIndex + 1} of ${
          Siso.State.allHighlights.length
        }`;
      }
    }

    if (prevBtn) {
      prevBtn.disabled = Siso.State.allHighlights.length === 0;
    }

    if (nextBtn) {
      nextBtn.disabled = Siso.State.allHighlights.length === 0;
    }
  },

  createNavigationUI: async function () {
    // Remove existing UI if present
    const existing = document.querySelector(".kh-navigation-ui");
    if (existing) existing.remove();

    // Check dark mode preference
    const prefs = await Siso.Storage.getPrefs();
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
    prevBtn.addEventListener("click", () => this.navigatePrevious());
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
    nextBtn.addEventListener("click", () => this.navigateNext());
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
    this.updateNavigationUI();

    return navUI;
  },
};
