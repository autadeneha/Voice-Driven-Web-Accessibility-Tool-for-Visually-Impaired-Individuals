/**
 * VisionaryAI Extension — Image AI v2
 *
 * Full command set:
 *  describeImages(mode)           — describe focused/first image (brief|detailed|deep)
 *  describeAllImages()            — describe ALL images on page
 *  describeImageNumber(n)         — describe image #n by position (1-based)
 *  describeFirstN(n)              — describe first N images (e.g. first 5, first 10)
 *  describeImagesOnScreen()       — describe only images visible in the viewport
 *  describeImagesInSection(query) — describe images inside a heading section
 *  listAllImages()                — list all images with number + alt/title (no API)
 *  countImages()                  — announce total image count
 *  describeImageByKeyword(kw)     — find image whose alt/src/context matches keyword
 *
 * All API calls use OpenAI GPT-4o (primary). Falls back to alt text or Flask.
 */
(function () {
  if (window.__vaiImageAILoaded) return;
  window.__vaiImageAILoaded = true;

  /* ─────────────────────────────────────────────────────────────────
     CORE UTILITIES
  ───────────────────────────────────────────────────────────────── */

  /** Convert img element to base64 JPEG, capped at maxSize px */
  async function toB64(img, maxSize) {
    return new Promise((resolve, reject) => {
      try {
        const ms = maxSize || 768;
        const ow = img.naturalWidth  || img.width  || 0;
        const oh = img.naturalHeight || img.height || 0;
        if (ow === 0 || oh === 0) { reject(new Error('zero size')); return; }
        const sc = Math.min(1, ms / Math.max(ow, oh));
        const c  = document.createElement('canvas');
        c.width  = Math.round(ow * sc);
        c.height = Math.round(oh * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.80));
      } catch (e) { reject(e); }
    });
  }

  /** Build the image_url content block for OpenAI */
  async function makeImgContent(img) {
    try {
      const b64 = await toB64(img);
      return { type: 'image_url', image_url: { url: b64, detail: 'low' } };
    } catch (_) {
      if (img.src && img.src.startsWith('http')) {
        return { type: 'image_url', image_url: { url: img.src } };
      }
      return null;
    }
  }

  /** Call OpenAI GPT-4o with an image and return description string */
  async function askOpenAI(imgContent, promptText, maxTokens) {
    const key = window.__vaiOpenAIKey;
    if (!key || !key.startsWith('sk-')) return null;
    if (!imgContent) return null;

    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 20000);
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model:      'gpt-4o',
          messages:   [{ role: 'user', content: [
            { type: 'text', text: promptText },
            imgContent
          ]}],
          max_tokens: maxTokens || 80
        }),
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (!resp.ok) {
        if (resp.status === 401) say('OpenAI key is invalid. Update it in Settings.');
        return null;
      }
      const data = await resp.json();
      return (data.choices?.[0]?.message?.content || '')
        .trim().replace(/\*+/g, '').replace(/#+\s*/g, '').replace(/\n+/g, ' ');
    } catch (_) { return null; }
  }

  /** Get clean list of meaningful images on the page */
  function getPageImages(minSize) {
    const min = minSize || 30;
    return Array.from(document.querySelectorAll('img')).filter(img => {
      const w = img.naturalWidth  || img.width  || 0;
      const h = img.naturalHeight || img.height || 0;
      return w >= min && h >= min;
    });
  }

  /** Get images currently visible in the viewport */
  function getVisibleImages() {
    return getPageImages(20).filter(img => {
      const r = img.getBoundingClientRect();
      return (
        r.top    < window.innerHeight &&
        r.bottom > 0 &&
        r.left   < window.innerWidth  &&
        r.right  > 0 &&
        r.width  > 0 && r.height > 0
      );
    });
  }

  function say(text) {
    if (typeof speak === 'function') speak(text);
  }

  function setOrb(s, t) {
    if (typeof window.setOrbState === 'function') window.setOrbState(s, t);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE SINGLE IMAGE (focused or first)
  ───────────────────────────────────────────────────────────────── */
  window.describeImages = async function (mode) {
    mode = mode || 'brief';

    // Use focused image if available, else first image
    const img = (document.activeElement?.tagName === 'IMG')
      ? document.activeElement
      : getPageImages()[0];

    if (!img) { say('No images found on this page.'); return; }

    // Use cached alt if brief mode
    if (mode === 'brief' && img.alt && img.alt.trim().length > 3) {
      say('Image: ' + img.alt); return;
    }

    setOrb('processing', 'Describing image...');
    say('Analysing image, one moment.');

    const prompt = mode === 'detailed' || mode === 'deep'
      ? 'Describe this image thoroughly for a visually impaired user. Cover colors, objects, text visible, layout, spatial arrangement, and overall scene. Plain spoken language, no markdown, no bullet points.'
      : 'Briefly describe this image in one sentence for a visually impaired user. Plain language only.';

    const ic   = await makeImgContent(img);
    const desc = await askOpenAI(ic, prompt, mode === 'brief' ? 70 : 250);

    if (desc) {
      if (!img.alt) img.alt = desc;
      setOrb('speaking', 'Speaking...');
      say('Image description: ' + desc);
      if (typeof vaiShowToast === 'function') vaiShowToast('🖼 ' + desc.slice(0, 100));
    } else {
      // Fallback to alt/title
      const fallback = img.alt || img.title || img.getAttribute('aria-label') || '';
      say(fallback ? 'Image: ' + fallback : 'Could not describe this image. No OpenAI key or API error.');
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE IMAGE BY NUMBER  e.g. "describe image 3"
  ───────────────────────────────────────────────────────────────── */
  window.describeImageNumber = async function (n) {
    const images = getPageImages();
    if (!images.length) { say('No images found on this page.'); return; }

    const idx = parseInt(n) - 1;
    if (isNaN(idx) || idx < 0 || idx >= images.length) {
      say(`Image number ${n} not found. This page has ${images.length} image${images.length > 1 ? 's' : ''}.`);
      return;
    }

    const img = images[idx];

    // Scroll to it and highlight
    img.scrollIntoView({ behavior: 'smooth', block: 'center' });
    img.style.outline = '3px solid #00c9a7';
    setTimeout(() => { img.style.outline = ''; }, 3000);

    setOrb('processing', 'Describing image ' + n + '...');
    say('Describing image ' + n + ' of ' + images.length + '.');

    // Use cached alt first
    if (img.alt && img.alt.trim().length > 3) {
      setOrb('speaking', 'Speaking...');
      say('Image ' + n + ': ' + img.alt);
      setOrb('listening', 'Listening...');
      return;
    }

    const ic   = await makeImgContent(img);
    const desc = await askOpenAI(ic,
      'Describe this image in one clear sentence for a visually impaired user. No markdown.',
      80
    );

    if (desc) {
      if (!img.alt) img.alt = desc;
      say('Image ' + n + ': ' + desc);
    } else {
      say('Image ' + n + ': Could not be described.');
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE FIRST N IMAGES  e.g. "describe first 5 images"
  ───────────────────────────────────────────────────────────────── */
  window.describeFirstN = async function (n) {
    const count  = Math.max(1, Math.min(parseInt(n) || 5, 20));
    const images = getPageImages();

    if (!images.length) { say('No images found on this page.'); return; }

    const limit  = Math.min(count, images.length);
    say('Describing first ' + limit + ' image' + (limit > 1 ? 's' : '') + '. Please wait.');
    setOrb('processing', 'Describing images...');

    for (let i = 0; i < limit; i++) {
      const img = images[i];

      if (img.alt && img.alt.trim().length > 3) {
        say('Image ' + (i + 1) + ': ' + img.alt);
        await sleep(400);
        continue;
      }

      const ic   = await makeImgContent(img);
      const desc = await askOpenAI(ic,
        'One sentence image description for screen reader. No markdown.',
        70
      );

      if (desc) {
        if (!img.alt) img.alt = desc;
        say('Image ' + (i + 1) + ': ' + desc);
      } else {
        const fb = img.alt || img.title || '';
        say('Image ' + (i + 1) + ': ' + (fb || 'Could not be described.'));
      }
      await sleep(500);
    }

    if (images.length > limit) {
      say('Described ' + limit + ' images. ' +
        (images.length - limit) + ' more on this page. Say "describe all images" for the rest.');
    } else {
      say('All ' + limit + ' image' + (limit > 1 ? 's' : '') + ' described.');
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE IMAGES ON SCREEN (visible in viewport only)
  ───────────────────────────────────────────────────────────────── */
  window.describeImagesOnScreen = async function () {
    const images = getVisibleImages();

    if (!images.length) {
      say('No images visible on screen right now. Try scrolling down.');
      return;
    }

    say(images.length + ' image' + (images.length > 1 ? 's' : '') +
        ' visible on screen. Describing each.');
    setOrb('processing', 'Describing visible images...');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      if (img.alt && img.alt.trim().length > 3) {
        say('Visible image ' + (i + 1) + ': ' + img.alt);
        await sleep(400);
        continue;
      }

      const ic   = await makeImgContent(img);
      const desc = await askOpenAI(ic,
        'One sentence image description for a visually impaired user. No markdown.',
        70
      );

      say('Visible image ' + (i + 1) + ': ' + (desc || img.alt || 'Could not be described.'));
      if (desc && !img.alt) img.alt = desc;
      await sleep(400);
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE IMAGES IN A SECTION  e.g. "describe images in introduction"
  ───────────────────────────────────────────────────────────────── */
  window.describeImagesInSection = async function (sectionQuery) {
    const q = (sectionQuery || '').toLowerCase().trim();

    // Find the heading that matches the query
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const heading  = headings.find(h =>
      h.innerText.toLowerCase().includes(q)
    );

    if (!heading) {
      say('Could not find a section called "' + sectionQuery + '". ' +
          'Available sections: ' +
          headings.slice(0, 5).map(h => h.innerText.trim()).join(', ') + '.');
      return;
    }

    // Collect all elements between this heading and the next same-level heading
    const sectionImages = [];
    let el = heading.nextElementSibling;
    const level = parseInt(heading.tagName[1]);

    while (el) {
      const tag = el.tagName;
      // Stop at next heading of same or higher level
      if (/^H[1-6]$/.test(tag) && parseInt(tag[1]) <= level) break;
      // Collect images directly and inside containers
      const imgs = el.tagName === 'IMG'
        ? [el]
        : Array.from(el.querySelectorAll('img'));
      imgs.forEach(img => {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w >= 30 && h >= 30) sectionImages.push(img);
      });
      el = el.nextElementSibling;
    }

    if (!sectionImages.length) {
      say('No images found in the "' + heading.innerText.trim() + '" section.');
      return;
    }

    say('Found ' + sectionImages.length + ' image' + (sectionImages.length > 1 ? 's' : '') +
        ' in the "' + heading.innerText.trim() + '" section. Describing.');
    setOrb('processing', 'Describing section images...');

    for (let i = 0; i < sectionImages.length; i++) {
      const img = sectionImages[i];

      if (img.alt && img.alt.trim().length > 3) {
        say('Image ' + (i + 1) + ': ' + img.alt);
        await sleep(400);
        continue;
      }

      const ic   = await makeImgContent(img);
      const desc = await askOpenAI(ic,
        'One sentence image description for a visually impaired user. No markdown.',
        70
      );

      say('Image ' + (i + 1) + ': ' + (desc || img.alt || 'Could not be described.'));
      if (desc && !img.alt) img.alt = desc;
      await sleep(400);
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE ALL IMAGES (full page)
  ───────────────────────────────────────────────────────────────── */
  window.describeAllImages = async function () {
    const images = getPageImages();
    if (!images.length) { say('No images found on this page.'); return; }

    say('Found ' + images.length + ' image' + (images.length > 1 ? 's' : '') +
        ' on this page. Describing all. Say stop to cancel.');
    setOrb('processing', 'Describing all images...');

    for (let i = 0; i < images.length; i++) {
      // Allow stop command to cancel
      if (window.__vaiStopImageDesc) {
        window.__vaiStopImageDesc = false;
        say('Stopped image description.');
        break;
      }

      const img = images[i];

      if (img.alt && img.alt.trim().length > 3) {
        say('Image ' + (i + 1) + ' of ' + images.length + ': ' + img.alt);
        await sleep(400);
        continue;
      }

      const ic   = await makeImgContent(img);
      const desc = await askOpenAI(ic,
        'One sentence image description for a screen reader. No markdown.',
        70
      );

      say('Image ' + (i + 1) + ' of ' + images.length + ': ' +
          (desc || img.alt || 'Could not be described.'));
      if (desc && !img.alt) img.alt = desc;
      await sleep(400);
    }
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     LIST ALL IMAGES (no API — just alt text / metadata)
  ───────────────────────────────────────────────────────────────── */
  window.listAllImages = function () {
    const images = getPageImages();
    if (!images.length) { say('No images found on this page.'); return; }

    const parts = images.map((img, i) => {
      const label = img.alt || img.title || img.getAttribute('aria-label') ||
                    img.getAttribute('aria-describedby') || '';
      const src   = img.src ? img.src.split('/').pop().split('?')[0].slice(0, 30) : '';
      return 'Image ' + (i + 1) + ': ' + (label || src || 'unlabelled');
    });

    say('This page has ' + images.length + ' image' + (images.length > 1 ? 's' : '') +
        '. ' + parts.join('. '));
  };

  /* ─────────────────────────────────────────────────────────────────
     COUNT IMAGES
  ───────────────────────────────────────────────────────────────── */
  window.countImages = function () {
    const all     = getPageImages();
    const visible = getVisibleImages();
    const withAlt = all.filter(i => i.alt && i.alt.trim().length > 3).length;
    say(
      'This page has ' + all.length + ' image' + (all.length > 1 ? 's' : '') + ' total. ' +
      visible.length + ' visible on screen. ' +
      withAlt + ' have text descriptions.'
    );
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE IMAGE BY KEYWORD  e.g. "describe the chart image"
  ───────────────────────────────────────────────────────────────── */
  window.describeImageByKeyword = async function (keyword) {
    const kw     = (keyword || '').toLowerCase().trim();
    const images = getPageImages();

    if (!images.length) { say('No images found on this page.'); return; }
    if (!kw) { window.describeImages('brief'); return; }

    // Search alt, title, aria-label, src filename, nearby text
    let match = null;
    for (const img of images) {
      const searchText = [
        img.alt || '',
        img.title || '',
        img.getAttribute('aria-label') || '',
        img.src || '',
        img.closest('figure')?.querySelector('figcaption')?.innerText || '',
        img.closest('[class]')?.className || ''
      ].join(' ').toLowerCase();

      if (searchText.includes(kw)) { match = img; break; }
    }

    // Also search nearby paragraph/heading text
    if (!match) {
      for (const img of images) {
        const container = img.closest('section,article,div,figure,p') || img.parentElement;
        const nearText  = container?.innerText?.toLowerCase() || '';
        if (nearText.includes(kw)) { match = img; break; }
      }
    }

    if (!match) {
      say('Could not find an image matching "' + keyword + '". ' +
          'Try saying "list all images" to hear image names, ' +
          'or "describe image number" followed by a number.');
      return;
    }

    // Scroll to matched image
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    match.style.outline = '3px solid #00c9a7';
    setTimeout(() => { match.style.outline = ''; }, 3000);

    const imgIdx = images.indexOf(match) + 1;
    setOrb('processing', 'Describing matched image...');
    say('Found a matching image, image number ' + imgIdx + '. Describing it.');

    if (match.alt && match.alt.trim().length > 3) {
      say('Image: ' + match.alt);
      setOrb('listening', 'Listening...'); return;
    }

    const ic   = await makeImgContent(match);
    const desc = await askOpenAI(ic,
      'Describe this image in detail for a visually impaired user. No markdown.',
      200
    );

    say('Image: ' + (desc || match.alt || 'Could not be described.'));
    if (desc && !match.alt) match.alt = desc;
    setOrb('listening', 'Listening...');
  };

  /* ─────────────────────────────────────────────────────────────────
     DESCRIBE NEXT / PREVIOUS IMAGE  (navigate image by image)
  ───────────────────────────────────────────────────────────────── */
  let _currentImageIdx = 0;

  window.describeNextImage = async function () {
    const images = getPageImages();
    if (!images.length) { say('No images on this page.'); return; }
    _currentImageIdx = Math.min(_currentImageIdx + 1, images.length - 1);
    await window.describeImageNumber(_currentImageIdx + 1);
  };

  window.describePreviousImage = async function () {
    const images = getPageImages();
    if (!images.length) { say('No images on this page.'); return; }
    _currentImageIdx = Math.max(_currentImageIdx - 1, 0);
    await window.describeImageNumber(_currentImageIdx + 1);
  };

  /* ─────────────────────────────────────────────────────────────────
     STOP IMAGE DESCRIPTION (sets flag checked in describeAllImages)
  ───────────────────────────────────────────────────────────────── */
  window.stopImageDescription = function () {
    window.__vaiStopImageDesc = true;
    say('Stopping image description.');
  };

})();
