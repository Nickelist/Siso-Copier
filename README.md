# Siso Copier - Advanced Text Highlighter & Productivity Tool

Streamline your web research with **Siso Copier**, the ultimate Chrome extension for efficient content gathering. Highlight keywords instantly across any page, auto-copy them with context, and maintain an organized history of your findings.

## Key Features

- **Instant Highlighting**: Quickly mark all occurrences of selected keywords on any webpage.
- **Context-Aware Copy**: Automatically copy highlighted text along with the page title and source URL.
- **Unified Sidebar**: Access all your highlights and tools from a sleek, non-intrusive side panel.
- **Smart AI Assistant**: Summarize entire pages or explain selected text using your favorite AI model.
- **Multi-Provider Support**: Works with Google Gemini, OpenAI, OpenRouter, Fal.ai, Local LM Studio, and Chrome's Built-in AI (Nano).
- **Format-Preserving Export**: Export highlights to Markdown and HTML.
- **Persistent History**: Never lose a piece of information; all your copied highlights are saved in a searchable dashboard.
- **Keyboard Shortcuts**: Power user features for navigating and copying page content.

## Smart AI Features

Siso Copier includes a powerful AI assistant to help you synthesize information.

### Features

- **Summarize Page**: Generates a concise bulleted summary of the current article.
- **Explain Selection**: Provides a simple explanation for any text loop selected on the page.

### Setup

1.  Open **Settings** (Click the Settings icon in the Sidebar).
2.  Navigate to the **Smart AI** tab.
3.  Choose your **AI Provider** and enter your **API Key**.

### Supported Providers

- **Google Gemini (Recommended)**: Fast, free tier available.
- **OpenAI**: Uses GPT-4o-mini or your preferred model.
- **OpenRouter**: Access Claude 3.5 Sonnet, Llama 3, etc.
- **Local LM Studio**: Use local models running on your machine (Set Base URL to `http://localhost:1234/v1`).
- **Chrome Built-in AI**: Uses the experimental Gemini Nano model running locally in Chrome (Requires Chrome Canary or specific flags enabled).

### Privacy & Security: API Key Storage

Your API keys are stored **exclusively** on your local device. Siso Copier does **not** have a backend server and never transmits your keys to us.

**Storage Options:**

1.  **Sync Storage (Default)**:
    - Keys are stored in `chrome.storage.sync`.
    - **Pros**: Syncs across your signed-in Chrome browsers.
    - **Cons**: Stored persistently until deleted.
2.  **Session Only**:
    - Check "Store in Session Only".
    - **Pros**: Keys are deleted automatically when you close Chrome. Maximum security.
    - **Cons**: You must re-enter the key every time you restart browser.

**How to Remove Keys:**

- Simply clear the API Key field in Settings and click **Save**.
- This will overwrite any stored key with an empty string, effectively deleting it from storage.

## About the Author

Developed by **Nickelist Saikia**.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
