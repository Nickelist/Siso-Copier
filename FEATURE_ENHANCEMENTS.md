# Siso Copier - Feature Enhancement Report

Based on a thorough analysis of the codebase, I have identified several key areas where **Siso Copier** can be significantly enhanced to provide a more premium, "wow" experience for users.

## 1. 🤖 AI "Chat with Page" Interface (High Impact)

**Current State:** The extension currently offers static "Summarize" and "Explain" buttons.
**The Upgrade:** Transform the Side Panel into a conversational **AI Assistant**.

- **Chat Interface:** Allow users to ask follow-up questions about the page content (e.g., "What does the author say about X?", "Compare this product to Y").
- **Context Awareness:** Automatically attach _currently highlighted text_ as specific context for the prompt.
- **Custom Personas:** Allow users to define custom system prompts (e.g., "Summarize like a 5-year-old", "Extract code blocks only").

## 2. 🎨 Interactive Highlight Menu (High Impact)

**Current State:** Highlights use an auto-rotating color palette or a single default color.
**The Upgrade:** Implement a **Floating Action Tooltip** (like Medium/Notion) that appears immediately upon text selection.

- **Color Picker:** Let users choose the specific color _at the moment of highlighting_ (e.g., Yellow for core ideas, Red for disagreements).
- **Annotations/Notes:** Allow users to attach a text note to a highlight. These notes should appear in the Sidebar and Export.
- **"Copy as Citation":** One-click button to copy the text formatted with the URL and Author (e.g., Markdown or BibTeX).

## 3. ☁️ cross-Device Sync & Data Safety (Medium Impact)

**Current State:** Highlights are stored in `chrome.storage.local`, meaning they live and die on the specific device.
**The Upgrade:** Implement robust data management.

- **Cloud Sync:** Option to use `chrome.storage.sync` (for small data) or a simple backend integration to sync highlights across devices.
- **Backup & Restore:** Add a "Export All Data (JSON)" and "Import Data" feature in settings so users never lose their research.

## 4. 📊 "Research Dashboard" (Medium Impact)

**Current State:** The sidebar shows highlights for the _current_ page only.
**The Upgrade:** A "Home" view in the Sidebar or a dedicated Dashboard page.

- **Recent Activity:** Show a list of recently highlighted pages.
- **Global Search:** Search through _all_ previously highlighted text across different websites.
- **Topic Grouping:** Auto-group pages by domain or AI-suggested topics.

## 5. 🛠️ Codebase & Developer Experience

- **Refactoring:** The `content.js` is quite large (2000+ lines). It should be refactored into modules (e.g., `highlighter.js`, `navigator.js`, `storage.js`) for better maintainability.
- **Build System:** Since we are proposing more complex UI (Chat, Dashboard), introducing a lightweight build step (Vite) would allow using modern frameworks (React/Vue/Svelte) for the Side Panel, making the UI much easier to build and maintain than Vanilla JS.

## Recommended Implementation Roadmap

1.  **Phase 1 (Quick Wins):** Implement **Backup/Restore** and **Custom System Prompts** for the existing AI features.
2.  **Phase 2 (Experience):** Build the **Chat Interface** in the Sidebar. This is the "killer feature" that will impress users most.
3.  **Phase 3 (Precision):** Add the **Interactive Highlight Menu** (Tooltip) for better control over highlighting.
