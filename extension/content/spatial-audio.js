/**
 * VisionaryAI Extension — Spatial Audio
 * Earcons, page overview, position announcements.
 */
(function () {
  if (window.__vaiSpatialLoaded) return;
  window.__vaiSpatialLoaded = true;

  let audioCtx = null;

  async function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      try { await audioCtx.resume(); } catch (_) {}
    }
    return audioCtx;
  }

  ["click","keydown","touchstart"].forEach(evt =>
    document.addEventListener(evt, () => { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(()=>{}); }, { passive: true })
  );

  const EARCONS = {
    navigation:    { freqs: [220],           dur: 0.15, type: "sine" },
    main:          { freqs: [440],           dur: 0.12, type: "sine" },
    search:        { freqs: [300, 600],      dur: 0.18, type: "sine" },
    complementary: { freqs: [330],           dur: 0.16, type: "triangle" },
    contentinfo:   { freqs: [110],           dur: 0.10, type: "sine" },
    banner:        { freqs: [880],           dur: 0.10, type: "sine" },
    h1:            { freqs: [523, 659, 784], dur: 0.18, type: "sine" },
    h2:            { freqs: [523, 659],      dur: 0.14, type: "sine" },
    h3:            { freqs: [523],           dur: 0.10, type: "sine" },
    success:       { freqs: [523, 659, 784], dur: 0.25, type: "sine" },
    error:         { freqs: [440, 466],      dur: 0.20, type: "sawtooth" },
    form:          { freqs: [440, 880],      dur: 0.20, type: "sine" }
  };

  const ROLE_DESC = {
    navigation: "Navigation menu", main: "Main content",
    search: "Search", complementary: "Sidebar",
    contentinfo: "Footer", banner: "Header", form: "Form"
  };

  window.playEarcon = async function (role, pan = 0) {
    const ctx  = await getAudioContext();
    const spec = EARCONS[role];
    if (!spec) return;

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    panner.connect(ctx.destination);

    spec.freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type || "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec.dur + 0.05);
      osc.connect(gain);
      gain.connect(panner);
      osc.start(ctx.currentTime + i * 0.02);
      osc.stop(ctx.currentTime + spec.dur + 0.1);
    });
  };

  window.playSpatialCue = async function (el) {
    const ctx  = await getAudioContext();
    const rect = el.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const pan  = ((rect.left + rect.width / 2) / vw) * 2 - 1;
    const yRatio = 1 - Math.min(1, Math.max(0, rect.top / vh));
    const freq = 260 + yRatio * 480;

    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    osc.connect(gain); gain.connect(panner); panner.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  };

  window.announceCurrentPosition = function () {
    const el = document.activeElement;
    if (!el || el === document.body) {
      speak("No element is focused. Press Tab to navigate.");
      return;
    }
    const rect  = el.getBoundingClientRect();
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;
    const xPct  = Math.round((rect.left + rect.width / 2) / vw * 100);
    const yPct  = Math.round((rect.top  + rect.height/ 2) / vh * 100);
    const hPos  = xPct < 33 ? "left" : xPct < 66 ? "center" : "right";
    const vPos  = yPct < 33 ? "top"  : yPct < 66 ? "middle" : "bottom";
    const label = el.getAttribute("aria-label") || el.innerText?.trim().slice(0, 40) || el.tagName;
    const pan   = ((rect.left + rect.width / 2) / vw) * 2 - 1;
    playEarcon(el.getAttribute("role") || el.tagName.toLowerCase(), pan);
    speak(`${label}. ${hPos} ${vPos} of page.`);
  };

  window.buildAudioMap = async function () {
    const landmarks = [];
    ["banner","navigation","main","search","complementary","contentinfo","form"].forEach(role => {
      document.querySelectorAll(`[role="${role}"]`).forEach(el => landmarks.push({ el, role }));
    });
    const tagMap = { header:"banner", nav:"navigation", main:"main", aside:"complementary", footer:"contentinfo", form:"form" };
    Object.entries(tagMap).forEach(([tag, role]) => {
      document.querySelectorAll(tag).forEach(el => {
        if (!el.getAttribute("role")) landmarks.push({ el, role });
      });
    });
    document.querySelectorAll("h1,h2,h3").forEach(h => landmarks.push({ el: h, role: h.tagName.toLowerCase() }));

    if (!landmarks.length) { speak("No structural landmarks found."); return; }

    speak(`Page overview. Found ${landmarks.length} structural elements.`);

    for (const { el, role } of landmarks) {
      const rect = el.getBoundingClientRect();
      const pan  = window.innerWidth > 0 ? ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1 : 0;
      await new Promise(r => setTimeout(r, 450));
      playEarcon(role, pan);
      await new Promise(r => setTimeout(r, 200));
      const label = el.getAttribute("aria-label") || el.innerText?.trim().slice(0, 50) || ROLE_DESC[role] || role;
      speak(`${ROLE_DESC[role] || role}: ${label}`);
    }

    speak("Page overview complete. Say 'where am I' for your current position.");
  };

  // Spatial cue on focus
  document.addEventListener("focusin", e => {
    if (window.spatialAudioEnabled) playSpatialCue(e.target);
  });
})();
