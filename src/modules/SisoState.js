window.Siso = window.Siso || {};

Siso.Constants = {
  KH_CLASS: "kh-mark",
  KH_DATA_GROUP: "data-kh-group",
  KH_DATA_INDEX: "data-kh-index",
  HIGHLIGHT_DEBOUNCE_MS: 150,
  DEFAULT_COLORS: [
    "rgba(59, 130, 246, 0.6)", // Blue
    "rgba(236, 72, 153, 0.6)", // Pink
    "rgba(34, 197, 94, 0.6)", // Green
    "rgba(251, 191, 36, 0.6)", // Yellow
    "rgba(168, 85, 247, 0.6)", // Purple
    "rgba(239, 68, 68, 0.6)", // Red
    "rgba(20, 184, 166, 0.6)", // Teal
    "rgba(249, 115, 22, 0.6)", // Orange
  ],
};

Siso.State = {
  activeHighlightGroups: new Map(),
  allHighlights: [],
  currentHighlightIndex: -1,
  savedHighlightTerms: [],
  isHighlighting: false,
  pendingHighlightQueue: [],
  highlightDebounceTimer: null,
};
