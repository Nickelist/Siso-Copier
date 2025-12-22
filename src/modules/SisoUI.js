window.Siso = window.Siso || {};

Siso.UI = {
  showCopyNotification: async function (text) {
    // Remove any existing notification
    const existing = document.querySelector(".kh-copy-notification");
    if (existing) existing.remove();

    // Check dark mode preference
    const prefs = await Siso.Storage.getPrefs();
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
  },
};
