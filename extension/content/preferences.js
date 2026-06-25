/**
 * VisionaryAI Extension — Preferences (chrome.storage.local)
 * Mirrors the website's localStorage prefs but uses chrome.storage
 * so settings persist across all websites.
 */
(function () {
  if (window.__vaiPrefsLoaded) return;
  window.__vaiPrefsLoaded = true;

  const PREFS_KEY = "visionaryai_prefs";

  const DEFAULT_PREFS = {
    voiceName:      "",
    speechRate:     1,
    pitch:          1,
    readingDepth:   "standard",
    readingPersona: "narrator",
    spatialAudio:   false,
    declutterMode:  false,
    dyslexicFont:   false,
    readingRuler:   false,
    focusMode:      false
  };

  // In-memory cache so synchronous reads work
  window.__vaiPrefsCache = { ...DEFAULT_PREFS };

  // Load from chrome.storage on boot
  chrome.storage.local.get([PREFS_KEY, "visionaryai_openai_key"], (result) => {
    const stored = result[PREFS_KEY];
    if (stored) {
      window.__vaiPrefsCache = { ...DEFAULT_PREFS, ...stored };
    }
    // Load OpenAI key into global so voice engine can use it
    if (result["visionaryai_openai_key"]) {
      window.__vaiOpenAIKey = result["visionaryai_openai_key"];
      console.log("[VAI] OpenAI key loaded.");
    }
    applyPreferences();
  });

  window.loadPreferences = function () {
    return window.__vaiPrefsCache;
  };

  window.savePreferences = function (updates) {
    window.__vaiPrefsCache = { ...window.__vaiPrefsCache, ...updates };
    chrome.storage.local.set({ [PREFS_KEY]: window.__vaiPrefsCache });
    return window.__vaiPrefsCache;
  };

  function applyPreferences() {
    const prefs = window.__vaiPrefsCache;
    window.__visionarySpeed = prefs.speechRate;
    window.__visionaryPitch = prefs.pitch;
    window.__visionaryDepth = prefs.readingDepth;
    window.spatialAudioEnabled = prefs.spatialAudio;
    window._savedVoiceName = prefs.voiceName;
  }
})();
