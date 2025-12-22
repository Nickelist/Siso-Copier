# Changelog

All notable changes to the Siso Copier Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-17

### Added

- **Initial release of Siso Copier Chrome Extension**
- **Text Highlighting System**
  - Right-click context menu integration for text highlighting
  - Customizable highlight colors with transparency control
  - Case sensitivity and whole word matching options
  - Support for long text selections with intelligent word-by-word highlighting
- **Auto-Copy Functionality**
  - Copy highlighted content with page title and source URL
  - Copy page title only (Ctrl+Shift+T)
  - Copy entire page content with smart filtering (Ctrl+Shift+E)
  - Copy highlighted text only (Ctrl+Shift+C)
  - Quick highlight selected text (Ctrl+Shift+H)
  - Clear all highlights (Escape)
- **Professional UI Design**
  - Glassmorphism design with transparency and blur effects
  - Popup interface with multiple copy options
  - Visual notifications for copy actions
  - Professional icons and minimal styling
- **Smart Content Filtering**
  - Remove social media links and buttons
  - Filter navigation elements and menus
  - Remove footer content and copyright text
  - Filter advertisement elements
  - Remove script and style content
  - Filter progress indicators and reading progress
  - Remove article metadata and structure elements
- **Advanced Features**
  - Options page for complete customization
  - Keyboard shortcuts for all major functions
  - Context menu integration
  - Comprehensive error handling
  - Cross-site compatibility with host permissions
  - Manifest V3 compliance for modern Chrome browsers

### Technical Features

- Service worker for background operations
- Content script injection for page interaction
- Message passing between components
- Chrome storage API for user preferences
- Clipboard API integration
- DOM manipulation with TreeWalker for efficient text processing
- Regular expression-based text matching
- Cross-site compatibility with host permissions

### File Structure

- Organized project structure with separate folders for:
  - Source files (`src/`)
  - Assets and icons (`assets/`)
  - Documentation (`docs/`)
- Proper manifest.json configuration
- Package.json for project metadata
- Comprehensive README with installation and usage instructions
- MIT License for open source distribution
