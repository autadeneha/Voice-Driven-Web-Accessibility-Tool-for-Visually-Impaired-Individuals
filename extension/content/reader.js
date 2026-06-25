/**
 * VisionaryAI — Reader FINAL
 * Pure Web Speech API. No chrome.tts. No message passing.
 * Works on every https page. Supports English, Hindi, Marathi.
 */
(function () {
  if (window.__vaiReaderLoaded) return;
  window.__vaiReaderLoaded = true;

  let queueId   = 0;
  let paused    = false;
  let persona   = 'narrator';
  let forceLang = null;

  const P = {
    narrator: { rate:1.0,  pitch:1.0 },
    teacher:  { rate:0.88, pitch:1.1 },
    friend:   { rate:1.12, pitch:1.2 }
  };

  const spd = () => Math.max(0.5, Math.min(3, (window.__visionarySpeed ?? window.__vaiPrefsCache?.speechRate ?? 1) * (P[persona]?.rate ?? 1)));
  const pit = () => Math.max(0, Math.min(2, (window.__visionaryPitch ?? window.__vaiPrefsCache?.pitch ?? 1)));

  /* ── language detection ─────────────────────────────────────── */
  function lang(text) {
    if (forceLang) return forceLang;
    const dev = (text.match(/[\u0900-\u097F]/g)||[]).length;
    if (dev / Math.max(1, text.replace(/\s/g,'').length) > 0.25)
      return /\b(आहे|असे|आणि|मराठी|महाराष्ट्र|नाही)\b/.test(text) ? 'mr-IN' : 'hi-IN';
    return 'en-US';
  }

  /* ── voice picker ───────────────────────────────────────────── */
  let vcache = null;
  const vv = () => { if (!vcache?.length) vcache = speechSynthesis.getVoices(); return vcache||[]; };
  speechSynthesis.onvoiceschanged = () => { vcache = null; };
  function pickV(lg) {
    const vs = vv();
    return vs.find(v=>v.lang===lg)
      || vs.find(v=>v.lang.startsWith(lg.slice(0,2))&&v.localService)
      || vs.find(v=>v.lang.startsWith(lg.slice(0,2)))
      || vs.find(v=>v.lang.startsWith('en'))
      || vs[0] || null;
  }

  /* ── speak() — global, fire-and-forget ─────────────────────── */
  window.speak = function(text, lg) {
    if (!text?.trim()) return;
    console.log('[VAI] speak:', text.slice(0,60));
    const L = lg || lang(text);
    const u = new SpeechSynthesisUtterance(text);
    const v = pickV(L);
    if (v) u.voice = v;
    u.lang = L; u.rate = L!=='en-US' ? Math.min(spd(),0.9) : spd();
    u.pitch = pit(); u.volume = 1;
    u.onstart = () => { if (window.setOrbState) window.setOrbState('speaking','Speaking...'); };
    u.onend   = () => { if (window.setOrbState) window.setOrbState('listening','Listening...'); };
    u.onerror = e  => { console.warn('[VAI] TTS err:',e.error); if (window.setOrbState) window.setOrbState('listening','Listening...'); };
    speechSynthesis.cancel();
    setTimeout(() => speechSynthesis.speak(u), 30);
  };

  /* ── sayOne() — awaitable ───────────────────────────────────── */
  function sayOne(text, lg) {
    return new Promise(res => {
      if (!text?.trim()) { res(); return; }
      const L   = lg || lang(text);
      const r   = L!=='en-US' ? Math.min(spd(),0.9) : spd();
      const cps = L!=='en-US' ? 7 : 13;
      const est = Math.max(1500, text.length/cps*1000/r) + 3000;
      let done=false;
      const fin = () => { if(!done){done=true;clearTimeout(tmr);setTimeout(res,80);} };
      const tmr = setTimeout(fin, est);
      try {
        const u = new SpeechSynthesisUtterance(text);
        const v = pickV(L);
        if (v) u.voice = v;
        u.lang=L; u.rate=r; u.pitch=pit(); u.volume=1;
        u.onend=fin; u.onerror=fin;
        speechSynthesis.speak(u);
      } catch(_) { fin(); }
    });
  }

  /* ── language mode ──────────────────────────────────────────── */
  window.__setReaderLang = function(lg) {
    forceLang = lg;
    if (lg==='hi-IN')      window.speak('हिंदी मोड चालू।','hi-IN');
    else if (lg==='mr-IN') window.speak('मराठी मोड चालू.','mr-IN');
    else                   window.speak('English mode restored.');
  };

  /* ── controls ───────────────────────────────────────────────── */
  window.setPersona = n => {
    if (!P[n]) { window.speak('Unknown persona.'); return; }
    persona=n; window.speak('Persona: '+n+'.');
    if (window.savePreferences) savePreferences({readingPersona:n});
  };
  window.fasterTTS = () => {
    window.__visionarySpeed = Math.min(3,+((window.__visionarySpeed||1)+0.2).toFixed(1));
    window.speak('Speed '+window.__visionarySpeed+'x.');
  };
  window.slowerTTS = () => {
    window.__visionarySpeed = Math.max(0.5,+((window.__visionarySpeed||1)-0.2).toFixed(1));
    window.speak('Speed '+window.__visionarySpeed+'x.');
  };
  window.pauseReading = () => {
    paused=true; speechSynthesis.cancel();
    if (window.setOrbState) window.setOrbState('listening','Paused');
  };
  window.stopReading = () => {
    paused=true; queueId++; speechSynthesis.cancel();
    if (window.setOrbState) window.setOrbState('listening','Stopped');
  };
  window.resumeReading = () => {
    paused=false;
    if (window.setOrbState) window.setOrbState('listening','Listening...');
    window.speak('Resuming.');
  };

  /* ── image description ──────────────────────────────────────── */
  async function descImg(img) {
    const alt=(img.alt||'').trim();
    if (alt&&alt.length>3&&!['image','photo','img','picture'].includes(alt.toLowerCase()))
      return 'Image: '+alt;
    const key=window.__vaiOpenAIKey;
    if (key?.startsWith('sk-')) {
      try {
        const ow=img.naturalWidth||img.width||0, oh=img.naturalHeight||img.height||0;
        let b64=null;
        if(ow>0&&oh>0){
          const sc=Math.min(1,400/Math.max(ow,oh));
          const c=document.createElement('canvas');
          c.width=Math.round(ow*sc); c.height=Math.round(oh*sc);
          try{c.getContext('2d').drawImage(img,0,0,c.width,c.height); b64=c.toDataURL('image/jpeg',0.7);}catch(_){}
        }
        const ic=b64?{type:'image_url',image_url:{url:b64,detail:'low'}}
                    :(img.src?{type:'image_url',image_url:{url:img.src}}:null);
        if(ic){
          const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),8000);
          const resp=await fetch('https://api.openai.com/v1/chat/completions',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
            body:JSON.stringify({model:'gpt-4o',messages:[{role:'user',content:[
              {type:'text',text:'One sentence for screen reader. No markdown.'},ic
            ]}],max_tokens:50}),signal:ctrl.signal});
          if(resp.ok){
            const d=await resp.json();
            const desc=(d.choices?.[0]?.message?.content||'').trim().replace(/\*+/g,'').replace(/\n+/g,' ');
            if(desc){img.alt=desc; return 'Image: '+desc;}
          }
        }
      } catch(_){}
    }
    return (img.title||img.getAttribute('aria-label')||'Image on page.').trim();
  }

  /* ── readPage() ─────────────────────────────────────────────── */
  window.readPage = function() {
    const depth = window.__visionaryDepth || window.__vaiPrefsCache?.readingDepth || 'standard';

    if (depth === 'brief') {
      const hs = [...document.querySelectorAll('h1,h2,h3')]
        .map(h => h.innerText?.trim()).filter(Boolean).join('. ');
      window.speak('Headings: ' + (hs || 'None found.')); return;
    }
    if (depth === 'deep') {
      if (window.openAISummarizePage) window.openAISummarizePage('detailed');
      else window.speak('Deep mode needs OpenAI key.'); return;
    }

    // ── STANDARD: extract all readable text from the page ──────
    // Strategy: get innerText of main content area, split into sentences,
    // read each one. This always works on any website.

    // Try to find main content area first
    const mainEl =
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('#content') ||
      document.querySelector('#main') ||
      document.querySelector('.content') ||
      document.querySelector('.article') ||
      document.querySelector('.post') ||
      document.body;

    // Get all text — use innerText so it respects visibility
    const rawText = mainEl.innerText || '';

    // Split into meaningful chunks (sentences / paragraphs)
    const chunks = rawText
      .split(/\n+/)                          // split on newlines
      .map(s => s.trim())
      .filter(s => s.length > 3)            // drop empty/tiny lines
      .filter(s => !/^[.\s,;:!?|·•\-–—()]+$/.test(s))  // drop pure punctuation
      .filter((s, i, arr) => arr.indexOf(s) === i)       // remove duplicates
      .slice(0, 200);                        // cap at 200 chunks

    if (!chunks.length) {
      window.speak('No readable text found on this page.'); return;
    }

    // Also get visible images
    const imgs = [...document.querySelectorAll('img')].filter(img => {
      const r = img.getBoundingClientRect();
      return (img.naturalWidth || img.width || 0) > 30 &&
             (img.naturalHeight || img.height || 0) > 30 &&
             r.bottom > 0 && r.top < window.innerHeight;
    }).slice(0, 10);

    const L = forceLang || 'en-US';
    const hasKey = !!window.__vaiOpenAIKey?.startsWith('sk-');

    let intro;
    if (L === 'hi-IN')      intro = 'पेज पढ़ना शुरू।';
    else if (L === 'mr-IN') intro = 'पान वाचणे सुरू.';
    else intro = 'Reading page. ' + chunks.length + ' sections found.' +
      (imgs.length ? ' ' + imgs.length + ' image' + (imgs.length > 1 ? 's' : '') +
        (hasKey ? ' will be described.' : '.') : '') +
      ' Say pause to pause, stop to stop.';

    if (window.setOrbState) window.setOrbState('speaking', 'Reading...');
    window.speak(intro, L);
    setTimeout(() => readChunks(chunks, imgs), 2000);
  };

  /* ── readChunks() — reads text chunks + images ─────────────── */
  async function readChunks(chunks, imgs) {
    queueId++; const myId = queueId; paused = false;

    // Read text chunks
    for (let i = 0; i < chunks.length; i++) {
      if (myId !== queueId) return;
      while (paused) {
        await new Promise(r => setTimeout(r, 100));
        if (myId !== queueId) return;
      }

      const text = chunks[i];
      if (!text.trim()) continue;
      const lg = lang(text);
      if (window.setOrbState) window.setOrbState('speaking', 'Reading...');
      await sayOne(text, lg);
      if (myId !== queueId) return;
    }

    // After text, describe images
    for (let i = 0; i < imgs.length; i++) {
      if (myId !== queueId) return;
      while (paused) {
        await new Promise(r => setTimeout(r, 100));
        if (myId !== queueId) return;
      }
      if (window.setOrbState) window.setOrbState('processing', 'Describing image...');
      const desc = await descImg(imgs[i]);
      if (myId !== queueId) return;
      if (window.setOrbState) window.setOrbState('speaking', 'Reading...');
      await sayOne(desc, 'en-US');
      if (myId !== queueId) return;
    }

    if (myId !== queueId) return;
    if (window.setOrbState) window.setOrbState('listening', 'Listening...');
    const dl = forceLang || 'en-US';
    if (dl === 'hi-IN')      window.speak('पढ़ना पूरा।', 'hi-IN');
    else if (dl === 'mr-IN') window.speak('वाचन पूर्ण.', 'mr-IN');
    else window.speak('Reading complete.');
  }

  /* ── readSeqSegments() — reads text+image segments in order ─── */
  async function readSeqSegments(segments) {
    queueId++; const myId=queueId; paused=false;
    for (let i = 0; i < segments.length; i++) {
      if (myId !== queueId) return;
      while (paused) { await new Promise(r=>setTimeout(r,100)); if(myId!==queueId) return; }
      const seg = segments[i];
      if (seg.type === 'img') {
        if (window.setOrbState) window.setOrbState('processing','Describing image...');
        const desc = await descImg(seg.el);
        if (myId !== queueId) return;
        await sayOne(desc, 'en-US');
      } else {
        const text = seg.text; if (!text.trim()) continue;
        await sayOne(text, lang(text));
      }
      if (myId !== queueId) return;
    }
    if (myId !== queueId) return;
    if (window.setOrbState) window.setOrbState('listening','Listening...');
    window.speak('Reading complete.');
  }

  // restore persona
  try {
    const p=window.loadPreferences?.()??window.__vaiPrefsCache??{};
    if(p.readingPersona&&P[p.readingPersona]) persona=p.readingPersona;
  } catch(_){}

})();
