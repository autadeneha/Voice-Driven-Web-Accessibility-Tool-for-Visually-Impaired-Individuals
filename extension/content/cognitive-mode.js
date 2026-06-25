/**
 * VisionaryAI Extension — Cognitive Modes
 * FIX: Pref restoration now waits for chrome.storage to resolve
 *      instead of reading from the (possibly empty) in-memory cache.
 */
(function () {
  if (window.__vaiCognitiveLoaded) return;
  window.__vaiCognitiveLoaded = true;

  /* ── Declutter ──────────────────────────────────────────────── */
  const DECLUTTER_SEL = [
    '[class*="ad-"],[class*="advertisement"],[id*="ad-unit"],[data-ad]',
    'ins.adsbygoogle,[class*="sidebar"],[class*="related"],[class*="recommended"]',
    '[class*="social-share"],[class*="cookie"],[id*="cookie"],[class*="consent"]',
    '[class*="popup"],[class*="promo"],[class*="banner-ad"],[class*="widget"]'
  ].join(',');

  let declutterOn = false;
  window.toggleDeclutter = function (force) {
    declutterOn = (force !== undefined) ? !!force : !declutterOn;
    document.getElementById('vai-declutter-css')?.remove();
    if (declutterOn) {
      const s = document.createElement('style');
      s.id    = 'vai-declutter-css';
      s.textContent = DECLUTTER_SEL + '{display:none!important}';
      document.head.appendChild(s);
      if (typeof speak === 'function') speak('Declutter on.');
    } else {
      if (typeof speak === 'function') speak('Declutter off.');
    }
    if (typeof savePreferences === 'function') savePreferences({ declutterMode: declutterOn });
  };

  /* ── Dyslexic font ──────────────────────────────────────────── */
  let dyslexicOn = false;
  window.toggleDyslexicFont = function (force) {
    dyslexicOn = (force !== undefined) ? !!force : !dyslexicOn;
    document.getElementById('vai-dyslexic-css')?.remove();
    document.getElementById('vai-opendyslexic-link')?.remove();
    if (dyslexicOn) {
      const link = Object.assign(document.createElement('link'), {
        rel: 'stylesheet', id: 'vai-opendyslexic-link',
        href: 'https://fonts.cdnfonts.com/css/opendyslexic'
      });
      document.head.appendChild(link);
      const s = document.createElement('style');
      s.id    = 'vai-dyslexic-css';
      s.textContent = '*{font-family:"OpenDyslexic",sans-serif!important}' +
        'p,li,td,span,div,label,input,textarea{letter-spacing:.12em!important;line-height:1.9!important;word-spacing:.25em!important}';
      document.head.appendChild(s);
      if (typeof speak === 'function') speak('Dyslexic font on.');
    } else {
      if (typeof speak === 'function') speak('Standard font restored.');
    }
    if (typeof savePreferences === 'function') savePreferences({ dyslexicFont: dyslexicOn });
  };

  /* ── Reading ruler ──────────────────────────────────────────── */
  let rulerOn = false;
  let rulerEl = null;
  const moveRuler = e => { if (rulerEl) rulerEl.style.top = (e.clientY - 20) + 'px'; };

  window.toggleReadingRuler = function (force) {
    rulerOn = (force !== undefined) ? !!force : !rulerOn;
    if (rulerOn) {
      if (!rulerEl) {
        rulerEl    = document.createElement('div');
        rulerEl.id = 'vai-reading-ruler';
        document.body.appendChild(rulerEl);
      }
      document.addEventListener('mousemove', moveRuler);
      if (typeof speak === 'function') speak('Reading ruler on.');
    } else {
      document.removeEventListener('mousemove', moveRuler);
      rulerEl?.remove(); rulerEl = null;
      if (typeof speak === 'function') speak('Reading ruler off.');
    }
    if (typeof savePreferences === 'function') savePreferences({ readingRuler: rulerOn });
  };

  /* ── Focus mode ─────────────────────────────────────────────── */
  let focusOn = false;
  window.toggleFocusMode = function (force) {
    focusOn = (force !== undefined) ? !!force : !focusOn;
    document.getElementById('vai-focus-css')?.remove();
    if (focusOn) {
      const s = document.createElement('style');
      s.id    = 'vai-focus-css';
      s.textContent =
        'body>*{opacity:.15;transition:opacity .3s}' +
        'body>*:focus-within,body>*:hover{opacity:1!important}';
      document.head.appendChild(s);
      if (typeof speak === 'function') speak('Focus mode on.');
    } else {
      if (typeof speak === 'function') speak('Focus mode off.');
    }
    if (typeof savePreferences === 'function') savePreferences({ focusMode: focusOn });
  };

  /* ── Restore prefs after chrome.storage resolves ────────────── */
  // Wait up to 3 s for __vaiPrefsCache to be populated by preferences.js
  function restoreWhenReady(attempts) {
    const prefs = window.__vaiPrefsCache;
    // If all falsy, chrome.storage hasn't loaded yet — wait
    if (!prefs || (!prefs.declutterMode && !prefs.dyslexicFont &&
                   !prefs.readingRuler  && !prefs.focusMode)) {
      if (attempts > 0) {
        setTimeout(() => restoreWhenReady(attempts - 1), 300);
      }
      return;
    }
    // Silent restore — no TTS on page load
    const speak_backup = window.speak;
    window.speak = () => {};   // suppress during restore
    if (prefs.declutterMode) window.toggleDeclutter(true);
    if (prefs.dyslexicFont)  window.toggleDyslexicFont(true);
    if (prefs.readingRuler)  window.toggleReadingRuler(true);
    if (prefs.focusMode)     window.toggleFocusMode(true);
    window.speak = speak_backup;
  }

  setTimeout(() => restoreWhenReady(10), 500);
})();
