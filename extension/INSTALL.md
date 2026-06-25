# VisionaryAI Chrome Extension — Installation Guide

## Quick Install (2 minutes)

### Step 1 — Open Chrome Extensions
1. Open Chrome and go to: `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)

### Step 2 — Load the Extension
1. Click **"Load unpacked"**
2. Navigate to this folder:
   ```
   voice-accessible-website 5\extension\
   ```
3. Click **Select Folder**

### Step 3 — Allow Microphone
1. A microphone permission popup will appear — click **Allow**
2. The VisionaryAI icon (🎤 orange) appears in your toolbar

---

## How to Use

### Activate on Any Website
1. Go to **any** Chrome website (Google, Wikipedia, news sites, etc.)
2. Say: **"Hey Vision"**
3. You'll hear: *"VisionaryAI activated. Say a command or say help."*
4. The orb in the bottom-right corner turns green

### Voice Commands (40+)

| Category | Commands |
|---|---|
| Reading | "read page", "pause", "resume", "stop", "faster", "slower" |
| Navigation | "next section", "next heading", "go to top", "scroll down" |
| AI Images | "describe image", "deep description", "describe all images" |
| Summarize | "summarize page", "detailed summary" |
| Forms | "start form", "submit form", "clear form", "review form" |
| Cognitive | "declutter", "focus mode", "reading ruler", "dyslexic font" |
| Personas | "narrator mode", "teacher mode", "friend mode" |
| Audit | "audit this page" / "wcag audit" |
| Spatial | "page overview", "where am I" |
| Help | "help" |
| Deactivate | "deactivate" / "go to sleep" |

### Popup Panel
Click the VisionaryAI toolbar icon to:
- See **live page headings** (click any to jump to it)
- Use **quick action buttons**
- Change **persona, speed, pitch, reading depth**
- Toggle **cognitive modes** (declutter, dyslexic font, etc.)

---

## AI Features (Need Flask Backend)

For AI image descriptions and page summaries, start the backend:
```bash
cd server
python ai-image-caption.py
```
The extension automatically connects to `http://127.0.0.1:5000`.
If the backend is not running, the extension works offline with basic TTS.

---

## Better Icons (Optional)

The current icons are placeholder PNGs. For proper icons:
1. Open `extension/generate-icons.html` in Chrome
2. Click "Generate & Download Icons"
3. Save `icon16.png`, `icon48.png`, `icon128.png` to `extension/icons/`
4. Reload the extension in `chrome://extensions`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Hey Vision" not working | Click the orb to restart, or reload the tab |
| No sound | Allow mic in Chrome settings → Site Settings → Microphone |
| AI description fails | Start `python server/ai-image-caption.py` |
| Extension not loading | Check Developer mode is ON in chrome://extensions |

---

## Browser Compatibility
- ✅ Chrome 112+
- ✅ Edge 112+ (Chromium)
- ❌ Firefox (Manifest V3 differences)
- ❌ Safari

Built with VisionaryAI v2.0 · Mistral Pixtral Vision · WCAG 2.2 ♿
