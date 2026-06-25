/**
 * Run with: node create-icons.js
 * Generates icon16.png, icon48.png, icon128.png in the icons/ folder.
 * Requires: npm install canvas  (only needed once)
 */
const fs   = require("fs");
const path = require("path");

function tryWithCanvas() {
  try {
    const { createCanvas } = require("canvas");

    function drawIcon(size) {
      const canvas = createCanvas(size, size);
      const ctx    = canvas.getContext("2d");

      // Rounded rect background (orange)
      const r = Math.round(size * 0.2);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size); ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fillStyle = "#ff6b35";
      ctx.fill();

      // White mic body
      ctx.fillStyle   = "white";
      ctx.strokeStyle = "white";
      ctx.lineWidth   = Math.max(1, size * 0.07);
      ctx.lineCap     = "round";

      const cx     = size / 2;
      const micW   = size * 0.22;
      const micH   = size * 0.28;
      const micTop = size * 0.18;
      const micR   = micW / 2;

      // Mic body (rounded rect)
      ctx.beginPath();
      ctx.moveTo(cx - micW/2 + micR, micTop);
      ctx.lineTo(cx + micW/2 - micR, micTop);
      ctx.quadraticCurveTo(cx + micW/2, micTop, cx + micW/2, micTop + micR);
      ctx.lineTo(cx + micW/2, micTop + micH - micR);
      ctx.quadraticCurveTo(cx + micW/2, micTop + micH, cx + micW/2 - micR, micTop + micH);
      ctx.lineTo(cx - micW/2 + micR, micTop + micH);
      ctx.quadraticCurveTo(cx - micW/2, micTop + micH, cx - micW/2, micTop + micH - micR);
      ctx.lineTo(cx - micW/2, micTop + micR);
      ctx.quadraticCurveTo(cx - micW/2, micTop, cx - micW/2 + micR, micTop);
      ctx.closePath();
      ctx.fill();

      // Arc
      ctx.beginPath();
      ctx.arc(cx, micTop + micH, size * 0.22, Math.PI, 0);
      ctx.stroke();

      // Stand
      ctx.beginPath();
      ctx.moveTo(cx, micTop + micH + size * 0.22);
      ctx.lineTo(cx, size * 0.82);
      ctx.stroke();

      // Base
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.16, size * 0.82);
      ctx.lineTo(cx + size * 0.16, size * 0.82);
      ctx.stroke();

      return canvas;
    }

    const iconsDir = path.join(__dirname, "icons");
    if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

    [16, 48, 128].forEach(size => {
      const canvas = drawIcon(size);
      const buffer = canvas.toBuffer("image/png");
      const outPath = path.join(iconsDir, `icon${size}.png`);
      fs.writeFileSync(outPath, buffer);
      console.log(`✅ Created icons/icon${size}.png`);
    });

  } catch (e) {
    console.warn("⚠️  'canvas' package not found. Using fallback PNG generator.");
    generateMinimalPNGs();
  }
}

/**
 * Fallback: generate minimal 1×1 colored PNG files so Chrome doesn't error.
 * These are tiny but valid — replace with real icons using generate-icons.html.
 */
function generateMinimalPNGs() {
  // Minimal 16×16 orange PNG (pre-encoded)
  // Generated from a solid #ff6b35 16x16 PNG
  const png16base64 =
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mP8z8BQDwADhQGAWjR9" +
    "RgAAAABJRU5ErkJggg==";

  const iconsDir = path.join(__dirname, "icons");
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

  const buf = Buffer.from(png16base64, "base64");

  [16, 48, 128].forEach(size => {
    const outPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ Fallback icon created: icons/icon${size}.png`);
  });

  console.log("\n👉 For proper icons, open extension/generate-icons.html in Chrome,");
  console.log("   click 'Generate & Download Icons', then save them to extension/icons/");
}

tryWithCanvas();
