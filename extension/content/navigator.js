/**
 * VisionaryAI Extension — Navigator Module
 * Keyboard/voice-driven focus, scrolling, landmark navigation.
 */
(function () {
  if (window.__vaiNavigatorLoaded) return;
  window.__vaiNavigatorLoaded = true;

  let focusIndex   = 0;
  let scrollInterval = null;
  let landmarkIndex  = 0;

  const focusables = () => Array.from(document.querySelectorAll(
    "a,button,input,textarea,select,h1,h2,h3,p,img,[tabindex]"
  )).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  function getLabel(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.innerText?.trim().slice(0, 60) ||
      el.tagName.toLowerCase()
    );
  }

  window.focusNext = function () {
    const els = focusables();
    if (!els.length) return;
    focusIndex = (focusIndex + 1) % els.length;
    els[focusIndex].focus();
    speak("Next: " + getLabel(els[focusIndex]));
  };

  window.focusPrevious = function () {
    const els = focusables();
    if (!els.length) return;
    focusIndex = (focusIndex - 1 + els.length) % els.length;
    els[focusIndex].focus();
    speak("Previous: " + getLabel(els[focusIndex]));
  };

  window.focusElement = function (selector, typeName) {
    const els = document.querySelectorAll(selector);
    if (els.length > 0) {
      els[0].focus();
      speak("Focused on " + typeName + ": " + getLabel(els[0]));
    } else {
      speak("No " + typeName + " found on this page.");
    }
  };

  window.scrollDown = function () {
    stopScrolling();
    window.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
    speak("Scrolled down.");
  };

  window.scrollUp = function () {
    stopScrolling();
    window.scrollBy({ top: -(window.innerHeight * 0.6), behavior: "smooth" });
    speak("Scrolled up.");
  };

  window.scrollSlowly = function () {
    stopScrolling();
    speak("Scrolling slowly.");
    scrollInterval = setInterval(() => {
      window.scrollBy({ top: 2, behavior: "auto" });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 10) {
        stopScrolling();
        speak("Reached end of page.");
      }
    }, 50);
  };

  window.stopScrolling = function () {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
  };

  // ── Landmark navigation ───────────────────────────────────────────────
  function getLandmarks() {
    return Array.from(document.querySelectorAll(
      "[role='navigation'],[role='main'],[role='search']," +
      "[role='complementary'],[role='contentinfo'],[role='banner']," +
      "nav,main,aside,footer,header"
    )).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  window.focusNextLandmark = function () {
    const landmarks = getLandmarks();
    if (!landmarks.length) { speak("No landmarks found."); return; }
    landmarkIndex = (landmarkIndex + 1) % landmarks.length;
    const el = landmarks[landmarkIndex];
    el.setAttribute("tabindex", "-1");
    el.focus();
    speak(getLabel(el));
  };

  window.focusPreviousLandmark = function () {
    const landmarks = getLandmarks();
    if (!landmarks.length) { speak("No landmarks found."); return; }
    landmarkIndex = (landmarkIndex - 1 + landmarks.length) % landmarks.length;
    const el = landmarks[landmarkIndex];
    el.setAttribute("tabindex", "-1");
    el.focus();
    speak(getLabel(el));
  };
})();
