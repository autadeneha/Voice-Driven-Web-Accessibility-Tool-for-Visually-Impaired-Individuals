/**
 * VisionaryAI Extension — WCAG 2.2 Accessibility Auditor
 * Runs on any page and renders results in the injected audit panel.
 */
(function () {
  if (window.__vaiAuditorLoaded) return;
  window.__vaiAuditorLoaded = true;

  const BASE_SCORE = 100;
  const WEIGHTS    = { perceivable: 0.30, operable: 0.25, understandable: 0.25, robust: 0.20 };
  const PENALTY    = { critical: 3.0, major: 1.5, minor: 0.5 };

  window.runAccessibilityAudit = function () {
    if (typeof setOrbState === "function") setOrbState("processing", "Auditing...");

    const violations = [];

    // 1.1.1 — Images without alt
    document.querySelectorAll("img").forEach(img => {
      if (!img.hasAttribute("alt") || img.alt.trim() === "") {
        violations.push({ category:"perceivable", severity:"critical", rule:"WCAG 1.1.1",
          message:`Image missing alt: ${img.src.split("/").pop().slice(-40)}` });
      }
    });

    // 1.3.1 — Inputs without labels
    document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select"
    ).forEach(input => {
      const hasLabel = input.getAttribute("aria-label") ||
        input.getAttribute("aria-labelledby") ||
        (input.id && document.querySelector(`label[for="${input.id}"]`));
      if (!hasLabel) {
        violations.push({ category:"perceivable", severity:"critical", rule:"WCAG 1.3.1",
          message:`Input missing label: ${input.name || input.id || input.type}` });
      }
    });

    // 1.3.1 — Heading hierarchy
    const headingLevels = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .map(h => parseInt(h.tagName[1]));
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i-1] > 1) {
        violations.push({ category:"perceivable", severity:"major", rule:"WCAG 1.3.1",
          message:`Heading skips level: h${headingLevels[i-1]} → h${headingLevels[i]}` });
        break;
      }
    }

    // Multiple H1
    const h1Count = document.querySelectorAll("h1").length;
    if (h1Count > 1) {
      violations.push({ category:"perceivable", severity:"major", rule:"WCAG 1.3.1",
        message:`Multiple h1 elements (${h1Count}).` });
    }

    // 2.4.4 — Links without name
    document.querySelectorAll("a").forEach(a => {
      const name = a.innerText?.trim() || a.getAttribute("aria-label") || a.querySelector("img[alt]")?.alt;
      if (!name) violations.push({ category:"operable", severity:"critical", rule:"WCAG 2.4.4",
        message:"Link has no accessible name." });
    });

    // 4.1.2 — Buttons without name
    document.querySelectorAll("button,[role=button]").forEach(btn => {
      const name = btn.innerText?.trim() || btn.getAttribute("aria-label") || btn.getAttribute("title");
      if (!name) violations.push({ category:"robust", severity:"critical", rule:"WCAG 4.1.2",
        message:"Button has no accessible name." });
    });

    // 2.4.7 — Focus styles
    const hasFocusStyle = Array.from(document.styleSheets).some(ss => {
      try { return ss.cssRules && Array.from(ss.cssRules).some(r => r.selectorText?.includes(":focus")); }
      catch { return false; }
    });
    if (!hasFocusStyle) {
      violations.push({ category:"operable", severity:"minor", rule:"WCAG 2.4.7",
        message:"No visible focus styles detected." });
    }

    // 3.1.1 — Lang attribute
    if (!document.querySelector("html")?.getAttribute("lang")) {
      violations.push({ category:"understandable", severity:"critical", rule:"WCAG 3.1.1",
        message:"Missing lang attribute on <html>." });
    }

    // 3.3.2 — Input placeholders
    document.querySelectorAll("input[type=text],input[type=email],textarea").forEach(el => {
      if (!el.placeholder && !el.getAttribute("aria-describedby")) {
        violations.push({ category:"understandable", severity:"minor", rule:"WCAG 3.3.2",
          message:`Input "${el.name || el.id || "unnamed"}" lacks placeholder or help text.` });
      }
    });

    // 4.1.1 — Duplicate IDs
    const ids    = Array.from(document.querySelectorAll("[id]")).map(el => el.id);
    const dupes  = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].sort();
    if (dupes.length) {
      violations.push({ category:"robust", severity:"major", rule:"WCAG 4.1.1",
        message:`Duplicate IDs: ${dupes.join(", ")}` });
    }

    // Score
    const categoryScores = {};
    ["perceivable","operable","understandable","robust"].forEach(cat => {
      const pen = violations.filter(v => v.category === cat)
        .reduce((s, v) => s + (PENALTY[v.severity] || 0), 0);
      categoryScores[cat] = Math.max(0, BASE_SCORE - pen);
    });
    const compositeScore = Math.round(
      Object.entries(WEIGHTS).reduce((s, [c, w]) => s + categoryScores[c] * w, 0)
    );

    // Render in overlay panel
    if (typeof vaiRenderAudit === "function") {
      vaiRenderAudit(violations, categoryScores, compositeScore);
    }

    // Speak summary
    const crits  = violations.filter(v => v.severity === "critical").length;
    const majors = violations.filter(v => v.severity === "major").length;
    const minors = violations.filter(v => v.severity === "minor").length;
    const summary = violations.length === 0
      ? `Audit complete. No issues found. Score: 100 out of 100.`
      : `Audit complete. Score: ${compositeScore} out of 100. ${crits} critical, ${majors} major, ${minors} minor issues.`;

    if (typeof speak === "function") speak(summary);
    if (typeof setOrbState === "function") setOrbState("listening", "Listening...");

    return { violations, categoryScores, compositeScore };
  };
})();
