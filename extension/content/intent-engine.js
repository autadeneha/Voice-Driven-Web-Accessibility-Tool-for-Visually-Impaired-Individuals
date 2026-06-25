/**
 * VisionaryAI Extension — Intent Engine (silent mode)
 * FIX: Removed all auto-speak suggestions — they were interrupting
 *      voice commands and confusing the speech recogniser.
 *      extractStructuredContent() is still available for summarize/chat.
 */
(function () {
  if (window.__vaiIntentLoaded) return;
  window.__vaiIntentLoaded = true;

  window.extractStructuredContent = function () {
    try {
      const clone = document.body.cloneNode(true);
      const remove = [
        'nav','footer','aside','header','script','style','noscript',
        '[role="navigation"]','[role="banner"]',
        '.ads','.sidebar','.cookie-banner','.popup','.modal'
      ];
      remove.forEach(s => {
        try { clone.querySelectorAll(s).forEach(el => el.remove()); } catch(_) {}
      });

      const parts = [];
      clone.querySelectorAll('h1').forEach(h => {
        const t = h.innerText?.trim(); if (t) parts.push('[H1] ' + t);
      });
      clone.querySelectorAll('h2').forEach(h => {
        const t = h.innerText?.trim(); if (t) parts.push('[H2] ' + t);
      });
      clone.querySelectorAll('h3').forEach(h => {
        const t = h.innerText?.trim(); if (t) parts.push('[H3] ' + t);
      });
      clone.querySelectorAll('p').forEach(p => {
        const t = p.innerText?.trim(); if (t && t.length > 30) parts.push(t);
      });

      let content = parts.join('\n');
      if (content.length > 16000) content = content.slice(0, 16000);
      return content;
    } catch (e) {
      return document.body.innerText.slice(0, 4000);
    }
  };

  // Store page context silently — no auto-speaking
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        const bodyText  = window.extractStructuredContent();
        const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
        const title     = document.title || '';
        const firstPara = document.querySelector('p')?.innerText?.trim() || '';
        const sentText  = (title + ' ' + firstPara).toLowerCase();
        let pageSentiment = 'neutral';
        if (/alert|warning|error|urgent|critical|danger/.test(sentText))
          pageSentiment = 'urgent';
        else if (/amazing|great|celebrate|success|win|launch/.test(sentText))
          pageSentiment = 'positive';
        window.pageSentiment = pageSentiment;
        window.pageContext   = { wordCount, pageSentiment, title };
        console.log('[VAI] PageContext ready, words:', wordCount);
      } catch (e) {
        console.warn('[VAI] Intent engine error:', e.message);
      }
    }, 1500);
  });

})();
