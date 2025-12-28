# Privacy Policy for Siso Copier

**Last Updated:** December 28, 2025

**Siso Copier** ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle your data when you use our Chrome Extension.

## 1. Data Collection and Storage

**Siso Copier** is designed with a "Local-First" philosophy. We do not collect, harvest, or sell your personal data.

### Local Storage

All user-generated content, including:

- Highlighted text
- Page summaries
- Research history
- Extracted content

Is stored **locally** on your device using the browser's `chrome.storage.local` API. We do not have access to this data.

### Sync Storage

User preferences, such as:

- Theme colors
- Keyboard shortcuts
- UI settings

Are stored using `chrome.storage.sync` to synchronize your settings across your signed-in Chrome browsers. This data is managed by Google Chrome's sync infrastructure.

## 2. AI Features and Third-Party Data Transmission

**Siso Copier** includes optional AI features ("Summarize", "Explain") that allow you to process text using Large Language Models (LLMs).

- **User-Controlled**: These features are only activated when you explicitly click the "Summarize" or "Explain" buttons.
- **Bring Your Own Key (BYOK)**: You must provide your own API keys (e.g., for Google Gemini, OpenAI, Anthropic via OpenRouter).
- **Direct Transmission**: When you use an AI feature, the selected text or page content is sent **directly** from your browser to the API of the provider you have chosen.
  - **We do not operate a proxy server.** Your data goes straight to the AI provider.
  - **We do not store your API keys.** Keys are saved locally on your device (in `sync` or `session` storage depending on your choice).

**Third-Party Providers**:
When you use these features, your data is subject to the privacy policy of the respective provider:

- **Google Gemini**: [Google Privacy Policy](https://policies.google.com/privacy)
- **OpenAI**: [OpenAI Privacy Policy](https://openai.com/privacy)
- **OpenRouter**: [OpenRouter Privacy Policy](https://openrouter.ai/privacy)
- **Fal.ai**: [Fal.ai Privacy Policy](https://fal.ai/privacy)

## 3. Permissions

We request the following permissions to ensure the extension functions correctly:

- **`storage`**: To save your highlights and settings locally.
- **`activeTab` & `scripting`**: To highlighting text on the page you are currently viewing and to extract content for summarization.
- **`sidePanel`**: To display the extension interface.
- **`contextMenus`**: To add "Highlight" options to your right-click menu.
- **`clipboardWrite`**: To allow you to copy text to your clipboard.
- **Host Permissions (`<all_urls>`)**: Required to allow the extension to work on any website you visit for research.

## 4. Analytics

We **do not** use third-party analytics trackers (like Google Analytics, Mixpanel, etc.) inside the extension.

## 5. Contact Us

If you have any questions about this Privacy Policy, please contact us at:
**Email**: <Nickelist.Saikia@gmail.com>
**GitHub**: [Siso Copier](https://github.com/Nickelist/Siso-Copier)(https://github.com/Nickelist/Siso-Copier)
