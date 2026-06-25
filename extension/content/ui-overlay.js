/**
 * VisionaryAI Extension — UI Overlay
 * Loads first. Defines ALL global APIs immediately (synchronously),
 * then injects DOM elements once body is available.
 *
 * FIX: APIs are defined before inject() so voice-engine never gets
 * "setOrbState is not a function" even if body isn't ready yet.
 */

(function () {
  'use strict';
  if (window.__vaiOverlayLoaded) return;
  window.__vaiOverlayLoaded = true;

  /* ── Define all APIs immediately — before DOM is needed ─────────── */

  window.setOrbState = function (state, text) {
    const orb   = document.getElementById('vai-orb');
    const label = document.getElementById('vai-status-label');
    if (orb) {
      orb.className = state || 'listening';
      orb.textContent =
        state === 'speaking'   ? '🔊' :
        state === 'processing' ? '⏳' :
        state === 'inactive'   ? '😴' : '🎤';
    }
    if (label && text) label.textContent = text;
  };

  window.vaiShowToast = function (message, duration) {
    const tc = document.getElementById('vai-toast-container');
    if (!tc) return;
    const toast = document.createElement('div');
    toast.className = 'vai-toast';
    toast.innerHTML = '<div class="vai-toast-label">VisionaryAI</div><div>' +
      String(message).replace(/</g,'&lt;') + '</div>';
    tc.appendChild(toast);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => toast.classList.add('show'))
    );
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 320);
    }, duration || 3500);
  };

  window.vaiShowWakeBanner = function (text) {
    const wb = document.getElementById('vai-wake-banner');
    if (!wb) return;
    wb.textContent = '◈ ' + (text || 'VisionaryAI activated!');
    wb.classList.add('show');
    setTimeout(() => wb.classList.remove('show'), 2200);
  };

  window.vaiShowChat = function () {
    const cp = document.getElementById('vai-chat-panel');
    if (cp) cp.classList.add('visible');
  };

  window.appendChatMsg = function (text, role) {
    const msgs = document.getElementById('vai-chat-messages');
    if (!msgs) return;
    const div       = document.createElement('div');
    div.className   = 'vai-chat-msg ' + (role || 'bot');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop  = msgs.scrollHeight;
  };

  window.vaiRenderAudit = function (violations, categoryScores, compositeScore) {
    const panel   = document.getElementById('vai-audit-panel');
    const results = document.getElementById('vai-audit-results');
    if (!panel || !results) return;

    const scoreColor = compositeScore >= 80 ? '#10b981' :
                       compositeScore >= 60 ? '#f59e0b' : '#ef4444';
    const catLabels  = {
      perceivable:    'Perceivable (1.x)',
      operable:       'Operable (2.x)',
      understandable: 'Understandable (3.x)',
      robust:         'Robust (4.x)'
    };

    const meter = '<div class="vai-score-meter">' +
      '<div class="vai-score-circle" style="--score-color:' + scoreColor + '">' +
        '<span class="vai-score-num">' + compositeScore + '</span>' +
        '<span class="vai-score-lbl">/ 100</span>' +
      '</div>' +
      Object.entries(categoryScores).map(([c, s]) =>
        '<div class="vai-score-cat">' +
          '<span style="width:140px;font-size:11px">' + (catLabels[c] || c) + '</span>' +
          '<div class="vai-score-bar-wrap">' +
            '<div class="vai-score-bar" style="width:' + s + '%;background:' +
              (s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444') + '"></div>' +
          '</div>' +
          '<span style="width:26px;text-align:right;font-size:11px">' + Math.round(s) + '</span>' +
        '</div>'
      ).join('') +
    '</div>';

    if (!violations.length) {
      results.innerHTML = meter +
        '<div style="text-align:center;padding:10px;color:#10b981">✅ No issues found!</div>';
    } else {
      const crits  = violations.filter(v => v.severity === 'critical');
      const majors = violations.filter(v => v.severity === 'major');
      const minors = violations.filter(v => v.severity === 'minor');
      const li = (list, cls, icon) => list.map(i =>
        '<li class="vai-audit-item ' + cls + '"><span>' + icon + '</span>' +
        '<div><strong>' + i.rule + '</strong><p>' + i.message + '</p></div></li>'
      ).join('');
      results.innerHTML = meter +
        '<div style="margin-bottom:8px">' +
          '<span class="vai-audit-badge error">' + crits.length + ' Critical</span>' +
          '<span class="vai-audit-badge warning">' + majors.length + ' Major</span>' +
          '<span class="vai-audit-badge minor">' + minors.length + ' Minor</span>' +
        '</div>' +
        '<ul class="vai-audit-list">' +
          li(crits, 'error', '🔴') + li(majors, 'warning', '🟡') + li(minors, 'minor', '🔵') +
        '</ul>';
    }
    panel.classList.add('visible');
  };

  window.fetchChatAnswer = async function (question) {
    const pageText  = typeof extractStructuredContent === 'function'
      ? extractStructuredContent().slice(0, 3000)
      : document.body.innerText.slice(0, 3000);
    const pageTitle = document.title || window.location.hostname;
    const key       = window.__vaiOpenAIKey;

    if (key && key.startsWith('sk-')) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 18000);
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
          body: JSON.stringify({
            model:    'gpt-4o-mini',
            messages: [
              { role:'system', content:
                  'You are VisionaryAI, a voice assistant for visually impaired users. ' +
                  'Answer in plain spoken language only. No markdown, no bullets, no asterisks. ' +
                  'Max 3 sentences. Page: ' + pageTitle + '\n' + pageText.slice(0,1500)
              },
              { role:'user', content: question }
            ],
            max_tokens: 200, temperature: 0.4
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (resp.ok) {
          const data   = await resp.json();
          const answer = (data.choices?.[0]?.message?.content || '')
            .trim().replace(/\*+/g,'').replace(/#+\s*/g,'').replace(/\n+/g,' ');
          if (answer) return answer;
        }
        if (resp.status === 401) return 'OpenAI key is invalid. Update it in Settings.';
        if (resp.status === 429) return 'OpenAI rate limit. Please wait a moment.';
      } catch (_) {}
    }

    // Page-based local fallback
    const l = question.toLowerCase();
    if (l.includes('how many heading'))
      return 'This page has ' + document.querySelectorAll('h1,h2,h3,h4,h5,h6').length + ' headings.';
    if (l.includes('how many link'))
      return 'This page has ' + document.querySelectorAll('a[href]').length + ' links.';
    if (l.includes('how many image'))
      return 'This page has ' + document.querySelectorAll('img').length + ' images.';
    if (l.includes('what is this page') || l.includes('what page'))
      return 'This page is titled "' + pageTitle + '".';
    const kws  = l.replace(/^(what|who|where|when|why|how|is|are|can|does)\s+/,'').split(' ').filter(w=>w.length>3);
    const sent = pageText.split(/[.!?]+/).filter(s=>s.trim().length>20);
    const hit  = sent.find(s => kws.some(k => s.toLowerCase().includes(k)));
    if (hit) return 'Based on the page: ' + hit.trim().slice(0,250);
    return 'Add your OpenAI key in Settings for AI answers. Or say "summarize page".';
  };

  /* ── Inject DOM once body is ready ──────────────────────────────── */
  function inject() {
    if (document.getElementById('vai-orb-wrap')) return;

    // Orb
    const orbWrap     = document.createElement('div');
    orbWrap.id        = 'vai-orb-wrap';
    orbWrap.innerHTML =
      '<div id="vai-orb" tabindex="0" role="button" ' +
           'aria-label="VisionaryAI — click to restart" ' +
           'title="Click to restart VisionaryAI">🎤</div>' +
      '<div id="vai-status-label">Say "Hey Vision"</div>';
    document.body.appendChild(orbWrap);
    setTimeout(() => orbWrap.classList.add('visible'), 300);

    // Toast container
    const tc = document.createElement('div');
    tc.id = 'vai-toast-container';
    document.body.appendChild(tc);

    // Audit panel
    const ap = document.createElement('div');
    ap.id    = 'vai-audit-panel';
    ap.setAttribute('role', 'region');
    ap.setAttribute('aria-label', 'WCAG Audit Results');
    ap.innerHTML =
      '<h3>🛡 WCAG 2.2 Audit' +
        '<button id="vai-audit-close" aria-label="Close">×</button>' +
      '</h3>' +
      '<div id="vai-audit-results"></div>';
    document.body.appendChild(ap);
    document.getElementById('vai-audit-close')
      .addEventListener('click', () => ap.classList.remove('visible'));

    // Wake banner
    const wb = document.createElement('div');
    wb.id    = 'vai-wake-banner';
    document.body.appendChild(wb);

    // Chat panel
    const cp = document.createElement('div');
    cp.id    = 'vai-chat-panel';
    cp.innerHTML =
      '<div class="vai-chat-header">' +
        '<span>💬 VisionaryAI Chat</span>' +
        '<button id="vai-chat-close" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="vai-chat-messages" id="vai-chat-messages">' +
        '<div class="vai-chat-msg bot">Hi! Ask me anything. Say "chat" to use voice.</div>' +
      '</div>' +
      '<div class="vai-chat-input-row">' +
        '<input type="text" id="vai-chat-input" placeholder="Type a question..." aria-label="Chat input" />' +
        '<button id="vai-chat-send" aria-label="Send">➤</button>' +
      '</div>';
    document.body.appendChild(cp);

    // Chat wiring
    document.getElementById('vai-chat-close')
      .addEventListener('click', () => cp.classList.remove('visible'));

    async function sendFromInput() {
      const inp = document.getElementById('vai-chat-input');
      const q   = (inp.value || '').trim();
      if (!q) return;
      inp.value = '';
      window.appendChatMsg(q, 'user');
      const ans = await window.fetchChatAnswer(q);
      window.appendChatMsg(ans, 'bot');
      if (typeof speak === 'function') speak(ans);
    }
    document.getElementById('vai-chat-send')
      .addEventListener('click', sendFromInput);
    document.getElementById('vai-chat-input')
      .addEventListener('keydown', e => { if (e.key === 'Enter') sendFromInput(); });

    // Orb click → restart
    document.getElementById('vai-orb').addEventListener('click', () => {
      if (typeof vaiRestartVoice === 'function') vaiRestartVoice();
    });

    // Popup message handler
    chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
      if (msg.type === 'GET_STATUS') {
        const orb = document.getElementById('vai-orb');
        sendResponse({
          status:   (document.getElementById('vai-status-label')?.textContent) || 'Ready',
          orbState: (orb?.className) || 'listening'
        });
        return true;
      }
    });
  }

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  }

})();
