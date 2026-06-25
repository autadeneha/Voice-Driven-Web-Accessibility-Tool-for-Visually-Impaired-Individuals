/**
 * VisionaryAI Extension — Popup Script
 */

const PREFS_KEY = "visionaryai_prefs";

// ── Helpers ───────────────────────────────────────────────────────────────

function sendToContent(code) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (fnCode) => {
        try { eval(fnCode); } catch(e) { console.warn("[VisionaryAI popup]", e); }
      },
      args: [code]
    }).catch(() => {});
  });
}

// ── Tab switching ─────────────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    const target = document.getElementById("tab-" + tab.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// ── Status polling ────────────────────────────────────────────────────────

function pollStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) { setOrbUI("inactive", "INACTIVE"); return; }
    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_STATUS" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        setOrbUI("inactive", "LOADING...");
        return;
      }
      const state = resp.orbState || "listening";
      const labels = {
        listening:  "LISTENING",
        speaking:   "SPEAKING",
        processing: "PROCESSING",
        inactive:   "INACTIVE"
      };
      setOrbUI(state, labels[state] || state.toUpperCase());
    });
  });
}

function setOrbUI(state, label) {
  const dot     = document.getElementById("status-dot");
  const badge   = document.getElementById("status-badge");
  const orbBtn  = document.getElementById("orb-btn");
  const orbRing = document.getElementById("orb-glow-ring");
  const waveform = document.getElementById("waveform");

  if (dot) {
    dot.className = "status-dot " + (state === "listening" ? "" : state);
  }
  if (badge) {
    badge.className = "status-badge " + (state === "listening" ? "" : state);
    badge.textContent = label || "LISTENING";
  }
  if (orbBtn) {
    orbBtn.className = "orb-button " + (state === "speaking" ? "speaking" : "");
  }
  if (orbRing) {
    orbRing.className = "orb-glow-ring " + (state !== "listening" ? state : "");
  }
  if (waveform) {
    if (state === "speaking" || state === "listening") {
      waveform.classList.add("active");
    } else {
      waveform.classList.remove("active");
    }
  }
}

// ── Live Page Headings ────────────────────────────────────────────────────

function loadPageHeadings() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const headings = [];
        document.querySelectorAll("h1, h2, h3").forEach((h) => {
          const text = h.innerText?.trim();
          if (text) {
            headings.push({ level: h.tagName, text: text.slice(0, 80) });
          }
        });
        return headings;
      }
    }, (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) return;
      renderHeadings(results[0].result || []);
    });
  });
}

function renderHeadings(headings) {
  const list = document.getElementById("headings-list");
  if (!list) return;

  if (!headings.length) {
    list.innerHTML = '<div class="headings-empty">No headings found on this page.</div>';
    return;
  }

  list.innerHTML = headings.map((h) => {
    const lvl = h.level.toLowerCase();
    const badgeClass = lvl === "h1" ? "h1-badge" : lvl === "h2" ? "h2-badge" : "h3-badge";
    const itemClass  = lvl === "h1" ? "h1-item"  : lvl === "h2" ? "h2-item"  : "h3-item";
    const indent     = lvl === "h3" ? "padding-left:20px" : "";
    return `
      <div class="heading-item ${itemClass}" style="${indent}"
           data-heading="${encodeURIComponent(h.text)}" role="button" tabindex="0">
        <span class="heading-badge ${badgeClass}">${h.level}</span>
        <span class="heading-text">${escapeHtml(h.text)}</span>
      </div>`;
  }).join("");

  // Click on heading → scroll to it and read it
  list.querySelectorAll(".heading-item").forEach((item) => {
    item.addEventListener("click", () => {
      const text = decodeURIComponent(item.dataset.heading);
      sendToContent(`
        (function(){
          var all = document.querySelectorAll('h1,h2,h3');
          for(var i=0;i<all.length;i++){
            if(all[i].innerText && all[i].innerText.trim().startsWith(${JSON.stringify(text.slice(0,40))})){
              all[i].scrollIntoView({behavior:'smooth',block:'center'});
              all[i].focus();
              if(typeof speak==='function') speak('Navigated to: ' + all[i].innerText.trim().slice(0,80));
              break;
            }
          }
        })();
      `);
      window.close();
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") item.click();
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Orb button ────────────────────────────────────────────────────────────

document.getElementById("orb-btn").addEventListener("click", () => {
  sendToContent("if(typeof vaiRestartVoice==='function') vaiRestartVoice()");
});

// ── Action buttons ────────────────────────────────────────────────────────

document.querySelectorAll(".action-btn[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendToContent(btn.dataset.cmd);
    window.close();
  });
});

// ── Load prefs into UI ────────────────────────────────────────────────────

function loadPrefsIntoUI() {
  chrome.storage.local.get([PREFS_KEY], (result) => {
    const prefs = result[PREFS_KEY] || {};

    const persona = document.getElementById("pop-persona");
    if (persona && prefs.readingPersona) persona.value = prefs.readingPersona;

    const depth = document.getElementById("pop-depth");
    if (depth && prefs.readingDepth) depth.value = prefs.readingDepth;

    const speed = document.getElementById("pop-speed");
    const speedVal = document.getElementById("pop-speed-val");
    if (speed && prefs.speechRate != null) {
      speed.value = prefs.speechRate;
      speedVal.textContent = parseFloat(prefs.speechRate).toFixed(1) + "x";
    }

    const pitch = document.getElementById("pop-pitch");
    const pitchVal = document.getElementById("pop-pitch-val");
    if (pitch && prefs.pitch != null) {
      pitch.value = prefs.pitch;
      pitchVal.textContent = parseFloat(prefs.pitch).toFixed(1);
    }

    if (prefs.declutterMode)  document.getElementById("tog-declutter").checked = true;
    if (prefs.dyslexicFont)   document.getElementById("tog-dyslexic").checked = true;
    if (prefs.readingRuler)   document.getElementById("tog-ruler").checked = true;
    if (prefs.focusMode)      document.getElementById("tog-focus").checked = true;
  });
}

// ── Settings changes ──────────────────────────────────────────────────────

document.getElementById("pop-persona").addEventListener("change", (e) => {
  sendToContent(`if(typeof setPersona==='function') setPersona('${e.target.value}')`);
  chrome.storage.local.get([PREFS_KEY], (r) => {
    const p = r[PREFS_KEY] || {};
    p.readingPersona = e.target.value;
    chrome.storage.local.set({ [PREFS_KEY]: p });
  });
});

document.getElementById("pop-depth").addEventListener("change", (e) => {
  sendToContent(`window.__visionaryDepth='${e.target.value}'`);
  chrome.storage.local.get([PREFS_KEY], (r) => {
    const p = r[PREFS_KEY] || {};
    p.readingDepth = e.target.value;
    chrome.storage.local.set({ [PREFS_KEY]: p });
  });
});

const speedSlider = document.getElementById("pop-speed");
const speedValEl  = document.getElementById("pop-speed-val");
speedSlider.addEventListener("input", () => {
  const v = parseFloat(speedSlider.value).toFixed(1);
  speedValEl.textContent = v + "x";
  sendToContent(`window.__visionarySpeed=${v}; if(typeof savePreferences==='function') savePreferences({speechRate:${v}})`);
});

const pitchSlider = document.getElementById("pop-pitch");
const pitchValEl  = document.getElementById("pop-pitch-val");
pitchSlider.addEventListener("input", () => {
  const v = parseFloat(pitchSlider.value).toFixed(1);
  pitchValEl.textContent = v;
  sendToContent(`window.__visionaryPitch=${v}; if(typeof savePreferences==='function') savePreferences({pitch:${v}})`);
});

// ── Cognitive toggles ─────────────────────────────────────────────────────

document.querySelectorAll(".cog-cb").forEach((cb) => {
  cb.addEventListener("change", () => {
    const fn  = cb.dataset.fn;
    const val = cb.checked;
    sendToContent(`if(typeof ${fn}==='function') ${fn}(${val})`);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  pollStatus();
  loadPrefsIntoUI();
  loadPageHeadings();

  // Refresh every 2s
  const interval = setInterval(pollStatus, 2000);
  window.addEventListener("unload", () => clearInterval(interval));
});

// ── OpenAI API Key Management ─────────────────────────────────────────────

const OPENAI_KEY_STORAGE = "visionaryai_openai_key";

function loadOpenAIKeyUI() {
  chrome.storage.local.get([OPENAI_KEY_STORAGE], (result) => {
    const key    = result[OPENAI_KEY_STORAGE] || "";
    const input  = document.getElementById("openai-key-input");
    const status = document.getElementById("api-key-status");
    if (input) input.value = key;
    updateKeyStatus(!!key, status);
  });
}

function updateKeyStatus(isSet, statusEl) {
  const el = statusEl || document.getElementById("api-key-status");
  if (!el) return;
  if (isSet) {
    el.textContent  = "✓ Active";
    el.className    = "api-key-status set";
  } else {
    el.textContent  = "Not set";
    el.className    = "api-key-status";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadOpenAIKeyUI();

  // Save button
  document.getElementById("api-key-save")?.addEventListener("click", () => {
    const key = document.getElementById("openai-key-input")?.value.trim();
    if (!key) { alert("Please enter your OpenAI API key first."); return; }
    if (!key.startsWith("sk-")) {
      alert("That doesn't look like a valid OpenAI key.\nIt should start with: sk-");
      return;
    }
    chrome.storage.local.set({ [OPENAI_KEY_STORAGE]: key }, () => {
      updateKeyStatus(true);
      // Push key to content script so it's available immediately
      sendToContent(`window.__vaiOpenAIKey = ${JSON.stringify(key)};`);
      showSavedFeedback();
    });
  });

  // Clear button
  document.getElementById("api-key-clear")?.addEventListener("click", () => {
    if (!confirm("Remove the saved OpenAI API key?")) return;
    chrome.storage.local.remove(OPENAI_KEY_STORAGE, () => {
      document.getElementById("openai-key-input").value = "";
      updateKeyStatus(false);
      sendToContent(`window.__vaiOpenAIKey = null;`);
    });
  });

  // Show/hide toggle
  document.getElementById("api-key-toggle")?.addEventListener("click", () => {
    const input = document.getElementById("openai-key-input");
    const btn   = document.getElementById("api-key-toggle");
    if (!input) return;
    if (input.type === "password") {
      input.type   = "text";
      btn.textContent = "🙈";
    } else {
      input.type   = "password";
      btn.textContent = "👁";
    }
  });

  // Open platform.openai.com on link click
  document.querySelector(".api-link")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://platform.openai.com/api-keys" });
  });
});

function showSavedFeedback() {
  const btn = document.getElementById("api-key-save");
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = "✓ Saved!";
  btn.style.background = "#10b981";
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = "";
  }, 2000);
}

// ── Reset all cognitive modes ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-reset-modes")?.addEventListener("click", () => {
    // Turn off all modes in content script
    sendToContent(`
      if(typeof toggleDeclutter   ==='function') toggleDeclutter(false);
      if(typeof toggleDyslexicFont==='function') toggleDyslexicFont(false);
      if(typeof toggleReadingRuler==='function') toggleReadingRuler(false);
      if(typeof toggleFocusMode   ==='function') toggleFocusMode(false);
      if(typeof speak             ==='function') speak('All cognitive modes turned off.');
    `);
    // Uncheck all toggles in popup UI
    ["tog-declutter","tog-dyslexic","tog-ruler","tog-focus"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    // Clear from storage
    chrome.storage.local.get(["visionaryai_prefs"], (r) => {
      const p = r["visionaryai_prefs"] || {};
      p.declutterMode = false;
      p.dyslexicFont  = false;
      p.readingRuler  = false;
      p.focusMode     = false;
      chrome.storage.local.set({ "visionaryai_prefs": p });
    });
    // Visual feedback
    const btn = document.getElementById("btn-reset-modes");
    if (btn) {
      btn.textContent = "✓ All modes off";
      setTimeout(() => { btn.textContent = "✕ Turn Off All Modes"; }, 2000);
    }
  });
});
