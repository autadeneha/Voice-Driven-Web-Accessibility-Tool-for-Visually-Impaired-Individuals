/**
 * VisionaryAI Extension — PII Scrubber
 * Removes personally identifiable information before any API call.
 */
(function () {
  if (window.__vaiPiiScrubberLoaded) return;
  window.__vaiPiiScrubberLoaded = true;

  const PII_PATTERNS = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    /(\+?[\d\s\-(). ]{7,15})/g,
    /\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g
  ];

  window.scrubPII = function (text) {
    if (!text || typeof text !== "string") return text;
    return PII_PATTERNS.reduce((t, p) => t.replace(p, "[REDACTED]"), text);
  };
})();
