# Siso Copier - Feature Enhancements (Alternative Focus)

Since we are moving away from _Highlighting_ as a core feature, we should double down on the **"Copier"** and **"AI"** aspects to make this the ultimate web clipper and productivity tool.

## 1. 📋 Smart Data Extraction (The "Ultimate Copier")

**Concept:** Instead of just "Copy Page", give users power tools to extract _specific data structures_ without manual formatting.

- **Table to CSV/Excel:** Detect HTML tables on a page and offer a "Copy as CSV" or "Copy to Clipboard for Excel" button.
- **List Extractor:** specific "Copy List" button that detects `<ul>` or `<ol>` items and copies them as a clean text list (stripping bullets/numbers or keeping them as Markdown).
- **Code Block Clipper:** Automatically detect code blocks (`<pre>`, `<code>`) and add a "Copy Code" button overlay with language detection.
- **"Deep Link" Copier:** When selecting text, instead of just copying the text, copy a **Link to Text Fragment** (`URL#:~:text=Selected%20Text`) so users can share a link that scrolls directly to that specific sentence.

## 2. ✍️ AI Writing & Editing Companion

**Concept:** Shift from passive "Summarizing" to active "Writing/Editing".

- **"Polished Copy":** A mode where the user copies text, but Siso _automatically fixes grammar and formatting_ before it hits the clipboard.
- **AI Rewrite Menu:** Select text -> Right Click -> "Siso Rewrite":
  - _Make Professional_ (for emails)
  - _Simplify_ (for complex docs)
  - _Translate_ (to user's native language)
- **Email Reply Generator:** If the user is on Gmail/Outlook, the AI panel detects the email context and offers "Draft Reply" buttons (Positive, Negative, Request Meeting).

## 3. 🛡️ Distraction-Free Reading & Audio

**Concept:** Improvements for consuming content.

- **"Read Aloud" (TTS):** Add a Play button in the Sidebar to read the extracted page content using high-quality Browser Text-to-Speech API. Great for multi-tasking.
- **Focus Mode (Reader View):** A toggle that hides the website's sidebar, ads, and nav bar, leaving only the clean content (using the logic you already have for `getAllPageContent`) centered on the screen.

## 4. 🔗 Workflow Integrations

**Concept:** Connect Siso to the user's "Second Brain".

- **"Send to Obsidian/Notion":** instead of generic copy, format the extraction specifically for these tools (using their specific Markdown flavors or APIs).
- **PDF Export:** Generate a clean PDF of the article (stripping ads) directly from the extension.

## Summary of Pivot

| Feature         | Old Focus (Highlighting)  | New Focus (Smart Copier)     |
| :-------------- | :------------------------ | :--------------------------- |
| **User Action** | Reading & Marking         | Extracting & Transforming    |
| **Output**      | Visual Highlights on Page | structured Data in Clipboard |
| **Value**       | Memory Aid                | Workflow Acceleration        |
