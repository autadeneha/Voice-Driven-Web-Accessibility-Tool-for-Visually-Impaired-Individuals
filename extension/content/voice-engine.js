/**
 * VisionaryAI — Voice Engine (final clean rewrite)
 *
 * Architecture:
 * - Web Speech API (SpeechRecognition) for input — continuous, never stops
 * - Web Speech API (SpeechSynthesis) for output — no background routing needed
 * - Wake word: "hey vision"
 * - Works on ALL Chrome websites
 * - Supports English, Hindi, Marathi
 */
(function () {
  'use strict';
  if (window.__vaiVoiceEngineLoaded) return;
  window.__vaiVoiceEngineLoaded = true;

  /* ── STATE ─────────────────────────────────────────────────────── */
  let rec        = null;
  let active     = false;
  let chatMode   = false;
  let recOn      = false;
  let idleTmr    = null;
  let lastTxt    = '';
  let lastTime   = 0;

  const IDLE = 90000;

  const WAKE = ['hey vision','hey visions','avision','a vision','hi vision',
    'ok vision','vision activate','activate vision','hey vizion','hay vision',
    'hey version','wake vision','vision on','hey wishin','vision please',
    'hey vison','hey vizon'];

  const SLEEP = ['sleep','go to sleep','deactivate','goodbye vision',
    'vision off','bye vision','stop vision','done chatting','vision bye'];

  /* ── RECOGNITION ────────────────────────────────────────────────── */
  function buildRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.error('[VAI] SpeechRecognition not available'); return null; }
    const r = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = 'en-US';
    r.maxAlternatives = 3;
    r.onresult = onResult;
    r.onerror  = onError;
    r.onend    = onEnd;
    return r;
  }

  function startRec() {
    if (recOn) return;
    if (!rec) rec = buildRec();
    if (!rec) return;
    try { rec.start(); recOn = true; console.log('[VAI] listening'); }
    catch(e) { recOn=false; if(e.name!=='InvalidStateError') setTimeout(startRec,800); }
  }

  function onEnd()  { recOn=false; setTimeout(startRec,300); }
  function onError(e) {
    recOn = false;
    if (e.error==='not-allowed'||e.error==='service-not-allowed') {
      say('Please allow microphone access in Chrome settings.');
      if (window.setOrbState) window.setOrbState('inactive','Mic blocked');
      return;
    }
    setTimeout(startRec, 500);
  }

  function onResult(event) {
    for (let i=event.resultIndex; i<event.results.length; i++) {
      const res = event.results[i];
      for (let j=0; j<res.length; j++) {
        const raw = res[j].transcript.trim();
        if (!raw) continue;
        const txt = norm(raw.toLowerCase());

        if (!active) {
          if (WAKE.some(w=>txt.includes(w))) { activate(); return; }
        } else if (res.isFinal) {
          const now = Date.now();
          if (txt===lastTxt && now-lastTime<800) continue;
          lastTxt=txt; lastTime=now;
          console.log('[VAI] cmd:', txt);
          resetIdle();
          dispatch(txt, raw);
          return;
        }
      }
    }
  }

  /* ── ACTIVATE / DEACTIVATE ──────────────────────────────────────── */
  function activate() {
    if (active) { resetIdle(); say('Listening. Say a command.'); return; }
    active=true; chatMode=false;
    if (window.setOrbState) window.setOrbState('listening','Listening...');
    if (window.vaiShowWakeBanner) vaiShowWakeBanner('VisionaryAI activated!');
    say('VisionaryAI activated. Say a command or say help.');
    resetIdle();
  }

  function deactivate(silent) {
    active=false; chatMode=false;
    clearTimeout(idleTmr);
    if (window.setOrbState) window.setOrbState('listening','Say Hey Vision');
    if (!silent) say('Going to sleep. Say Hey Vision to wake me.');
  }

  function resetIdle() {
    clearTimeout(idleTmr);
    idleTmr = setTimeout(() => {
      if (!active) return;
      if (chatMode) { resetIdle(); return; }
      say('No command heard. Going to sleep. Say Hey Vision to reactivate.');
      setTimeout(() => deactivate(true), 3000);
    }, IDLE);
  }

  /* ── SAY ────────────────────────────────────────────────────────── */
  function say(text, lang) {
    if (typeof window.speak === 'function') { window.speak(text, lang); return; }
    // fallback if reader.js not loaded yet
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate=1; u.pitch=1; u.volume=1;
    speechSynthesis.speak(u);
  }

  /* ── PHONETIC NORMALISER ────────────────────────────────────────── */
  function norm(t) {
    return t
      .replace(/\b(some[\s-]*rice|some[\s-]*rise|sum[\s-]*rice|sum[\s-]*rise|sumerize|sommerize|sommarize|sumrise)\b/g,'summarize')
      .replace(/\b(some[\s-]*mary|sum[\s-]*mary|summery)\b/g,'summary')
      .replace(/\b(de[\s-]*scribe|discribe|descripe)\b/g,'describe')
      .replace(/\b(paje|paige|paage)\b/g,'page')
      .replace(/\b(reed|reade)\b/g,'read')
      .replace(/\b(nex\b|nexxt)\b/g,'next')
      .replace(/\b(chatt|chaat)\b/g,'chat')
      .replace(/\b(halp|heelp)\b/g,'help')
      .replace(/\s+/g,' ').trim();
  }

  /* ── HELPERS ────────────────────────────────────────────────────── */
  const has = (t,arr) => arr.some(p=>t.includes(p));
  function call(fn,...a) {
    if (typeof window[fn]==='function') window[fn](...a);
    else console.warn('[VAI] missing:',fn);
  }
  function wtn(w) {
    const m={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
             first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
    return m[String(w).toLowerCase()]||parseInt(w)||0;
  }
  function looksQ(t) {
    return t.endsWith('?')||/^(what|who|where|when|why|how|is |are |can |does |did |will )/.test(t);
  }

  /* ── SUMMARIZE MATCHER ──────────────────────────────────────────── */
  function isSummarize(t) {
    return has(t,['summarize','summary','summarise','some rice','some rise','sum rice',
      'what is this page about','tell me about this page','give me a summary',
      'page summary','quick summary','brief summary','short summary','detailed summary',
      'full summary','deep summary','tldr','key points','main points','the gist','gist',
      'overview','explain this page','sum up','condense','highlights','short version']);
  }

  /* ── MAIN DISPATCHER ────────────────────────────────────────────── */
  function dispatch(t, raw) {
    // sleep
    if (SLEEP.some(v=>t.includes(v))) { deactivate(false); return; }

    // chat mode
    if (chatMode) { handleChat(t, raw); return; }

    // enter chat
    if (has(t,['chat','chatbot','start chat','ask a question','i have a question',
               'talk to ai','ai chat','question mode','i want to ask','ask ai',
               'voice chat','chat mode','begin chat','open chatbot'])) {
      startChat(); return;
    }

    // help
    if (has(t,['help','what can you do','list commands','commands','tutorial'])) {
      speakHelp(); return;
    }

    // summarize
    if (isSummarize(t)) {
      const det = has(t,['detail','full','long','deep','thorough','complete']);
      doSummarize(det?'detailed':'brief'); return;
    }

    // reading
    if (has(t,['read page','start reading','read this page','read aloud','read the page',
               'begin reading','read it','read to me','read content','read out'])) {
      call('readPage'); return;
    }
    if (has(t,['read headings','list headings','headings only','read titles'])) {
      readHeadings(); return;
    }
    if (has(t,['read links','list links','all links'])) { readLinks(); return; }
    if (has(t,['read buttons','list buttons','what buttons'])) { readButtons(); return; }
    if (has(t,['pause','pause reading','be quiet','stop talking','quiet','shh','mute'])) {
      call('pauseReading'); return;
    }
    if (has(t,['resume','resume reading','continue','unpause','keep going','keep reading'])) {
      call('resumeReading'); return;
    }
    if (has(t,['stop','stop reading','shut up','cancel','silence'])) {
      call('stopReading'); call('stopScrolling'); return;
    }
    if (has(t,['faster','speed up','read faster','quicker'])) { call('fasterTTS'); return; }
    if (has(t,['slower','slow down','read slower'])) { call('slowerTTS'); return; }

    // navigation
    if (has(t,['next section','skip ahead','next part','go forward'])) { call('focusNextLandmark'); return; }
    if (has(t,['previous section','last section','go back section'])) { call('focusPreviousLandmark'); return; }
    if (has(t,['next heading','go to heading','next header'])) { call('focusElement','h1,h2,h3','heading'); return; }
    if (has(t,['next link','go to link'])) { call('focusElement','a','link'); return; }
    if (has(t,['next button','go to button'])) { call('focusElement','button','button'); return; }
    if (has(t,['next element','next item'])) { call('focusNext'); return; }
    if (has(t,['previous element','previous item'])) { call('focusPrevious'); return; }
    if (has(t,['go to top','scroll to top','back to top','top of page'])) {
      window.scrollTo({top:0,behavior:'smooth'}); say('Top of page.'); return;
    }
    if (has(t,['go to bottom','scroll to bottom','bottom of page'])) {
      window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); say('Bottom of page.'); return;
    }
    if (has(t,['scroll down slowly','scroll slowly','auto scroll'])) { call('scrollSlowly'); return; }
    if (has(t,['scroll down','move down']) && !t.includes('slowly')) { call('scrollDown'); return; }
    if (has(t,['scroll up','move up'])) { call('scrollUp'); return; }
    if (has(t,['stop scrolling'])) { call('stopScrolling'); return; }
    if (has(t,['click','press enter','follow link','activate'])) { clickFocused(); return; }
    if (has(t,['what page','page title','what website','what site','current page'])) {
      announceTitle(); return;
    }

    // images
    if (has(t,['stop describing','stop image','cancel image'])) { call('stopImageDescription'); return; }
    if (has(t,['how many images','count images','how many pictures'])) { call('countImages'); return; }
    if (has(t,['list all images','list images','image list'])) { call('listAllImages'); return; }
    if (has(t,['describe images on screen','visible images','images on screen'])) {
      call('describeImagesOnScreen'); return;
    }
    if (has(t,['describe all images','describe every image','all images','all pictures'])) {
      call('describeAllImages'); return;
    }
    if (has(t,['next image','describe next image'])) { call('describeNextImage'); return; }
    if (has(t,['previous image','describe previous image','last image'])) { call('describePreviousImage'); return; }
    { const m=t.match(/(?:describe\s+)?first\s+(\w+)\s+(?:images?|pictures?)/);
      if (m) { call('describeFirstN',wtn(m[1])); return; } }
    { const ord={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
      const m=t.match(/(?:describe\s+)?(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:image|picture)/);
      if (m&&ord[m[1]]) { call('describeImageNumber',ord[m[1]]); return; } }
    { const m=t.match(/(?:describe\s+)?(?:image|picture)\s+(?:number\s+)?(\w+)/)||t.match(/image\s+(\d+)/);
      if (m) { const n=wtn(m[1]); if(n>0){call('describeImageNumber',n);return;} } }
    { const m=t.match(/describe\s+the\s+(.+?)(?:\s+image|\s+picture)?$/);
      if (m&&m[1]&&m[1].length>2) { call('describeImageByKeyword',m[1]); return; } }
    if (has(t,['deep description','describe in detail','detailed image','analyze image'])) {
      call('openAIDescribeImage','detailed'); return;
    }
    if (has(t,['describe image','what is this image','describe picture','what do you see',
               'image description','describe this image','what is shown'])) {
      call('openAIDescribeImage','brief'); return;
    }

    // page overview
    if (has(t,['page overview','map the page','audio map','what is on this page'])) {
      call('buildAudioMap'); return;
    }
    if (has(t,['where am i','my position','current position'])) { call('announceCurrentPosition'); return; }

    // audit
    if (has(t,['audit','wcag','check accessibility','accessibility check','run audit'])) {
      call('runAccessibilityAudit'); return;
    }

    // cognitive modes
    if (has(t,['reset modes','turn off all modes','all modes off'])) {
      call('toggleDeclutter',false); call('toggleDyslexicFont',false);
      call('toggleReadingRuler',false); call('toggleFocusMode',false);
      say('All modes off.'); return;
    }
    if (has(t,['declutter','clean view','remove clutter','hide distractions','remove ads'])) { call('toggleDeclutter'); return; }
    if (has(t,['focus mode','blur background','turn off focus','focus off','disable focus'])) { call('toggleFocusMode'); return; }
    if (has(t,['reading ruler','show ruler','ruler','line guide'])) { call('toggleReadingRuler'); return; }
    if (has(t,['dyslexic font','open dyslexic','dyslexia font','accessibility font'])) { call('toggleDyslexicFont'); return; }
    if (has(t,['high contrast','invert colors','contrast mode'])) { toggleContrast(); return; }
    if (has(t,['zoom in','bigger text','larger text'])) { zoomIn(); return; }
    if (has(t,['zoom out','smaller text','normal size'])) { zoomOut(); return; }

    // language
    if (has(t,['hindi mode','read in hindi','hindi language','switch to hindi','speak hindi'])) {
      if (window.__setReaderLang) window.__setReaderLang('hi-IN'); return;
    }
    if (has(t,['marathi mode','read in marathi','marathi language','switch to marathi','speak marathi'])) {
      if (window.__setReaderLang) window.__setReaderLang('mr-IN'); return;
    }
    if (has(t,['english mode','switch to english','reset language','default language'])) {
      if (window.__setReaderLang) window.__setReaderLang(null); return;
    }

    // forms
    if (has(t,['start form','fill form','form mode','voice form','begin form'])) { call('startFormSession'); return; }
    if (has(t,['submit form','send form','submit','send'])) { call('submitForm'); return; }
    if (has(t,['clear form','reset form'])) { call('clearForm'); return; }
    if (has(t,['review form','read form'])) { call('reviewForm'); return; }
    if (t.startsWith('fill ')&&t.includes(' with ')) {
      const i=t.indexOf(' with ');
      call('fillField',t.slice(5,i).trim(),t.slice(i+6).trim()); return;
    }
    if (/^(yes|no|correct|wrong|yeah|nope)\b/.test(t)&&typeof answerCurrentField==='function') {
      answerCurrentField(t); return;
    }

    // personas
    if (has(t,['narrator mode','narrator voice','narrator'])) { call('setPersona','narrator'); return; }
    if (has(t,['teacher mode','teacher voice','teacher'])) { call('setPersona','teacher'); return; }
    if (has(t,['friend mode','friendly voice','friend'])) { call('setPersona','friend'); return; }

    // find
    { const m=t.match(/^(?:find|search for|locate|look for)\s+(.+)$/);
      if (m) { findText(m[1]); return; } }

    // browser
    if (has(t,['go back','previous page','browser back'])) { history.back(); say('Going back.'); return; }
    if (has(t,['go forward','next page','browser forward'])) { history.forward(); say('Going forward.'); return; }
    if (has(t,['reload','refresh page'])) { say('Reloading.'); setTimeout(()=>location.reload(),800); return; }

    // auto Q&A
    if (looksQ(t)) { handleChat(t, raw||t); return; }

    say('Command not recognised. Say help to hear all commands.');
  }

  /* ── SUMMARIZE ──────────────────────────────────────────────────── */
  async function doSummarize(mode) {
    const key = window.__vaiOpenAIKey;
    if (!key?.startsWith('sk-')) {
      const words = (document.querySelector('main,article,[role="main"]')||document.body)
        .innerText.trim().split(/\s+/).slice(0,100).join(' ');
      say('No OpenAI key. Add it in Settings. Page start: '+words); return;
    }
    if (window.setOrbState) window.setOrbState('processing','Summarizing...');
    say('Summarizing, please wait.');
    const raw  = (typeof extractStructuredContent==='function'?extractStructuredContent():document.body.innerText).slice(0,5000);
    const clean= (typeof scrubPII==='function'?scrubPII(raw):raw);
    const title= document.title||window.location.hostname;
    const p    = mode==='detailed'
      ? `Summarize this webpage in 4-6 spoken sentences for a visually impaired user. No markdown.\n\nPage: "${title}"\n\n${clean}`
      : `Summarize this webpage in 1-2 spoken sentences for a visually impaired user. No markdown.\n\nPage: "${title}"\n\n${clean}`;
    try {
      const ctrl=new AbortController();
      setTimeout(()=>ctrl.abort(),25000);
      const resp=await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'user',content:p}],
          max_tokens:mode==='detailed'?220:90,temperature:0.3}),signal:ctrl.signal});
      if (resp.status===401) { say('OpenAI key invalid. Update in Settings.'); return; }
      if (resp.status===429) { say('OpenAI rate limit. Please wait.'); return; }
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const d=await resp.json();
      const a=(d.choices?.[0]?.message?.content||'').trim().replace(/\*+/g,'').replace(/#+\s*/g,'').replace(/\n+/g,' ');
      if (!a) throw new Error('empty');
      if (window.setOrbState) window.setOrbState('speaking','Speaking...');
      say((mode==='detailed'?'Detailed summary: ':'Summary: ')+a);
      if (window.vaiShowToast) vaiShowToast('📋 '+a.slice(0,100));
    } catch(e) {
      const words=clean.split(/\s+/).slice(0,100).join(' ');
      say('Could not get summary. Page start: '+words);
    }
  }

  /* ── IMAGE DESCRIBE ─────────────────────────────────────────────── */
  async function doDescribeImage(detail) {
    const key=window.__vaiOpenAIKey;
    const img=document.activeElement?.tagName==='IMG'?document.activeElement:document.querySelector('img');
    if (!img) { say('No image found.'); return; }
    if (!key?.startsWith('sk-')) { say(img.alt?'Image: '+img.alt:'No OpenAI key in Settings.'); return; }
    if (window.setOrbState) window.setOrbState('processing','Describing...');
    say('Analysing image.');
    let b64=null;
    try {
      const c=document.createElement('canvas');
      const w=img.naturalWidth||img.width||512, h=img.naturalHeight||img.height||512;
      const s=Math.min(1,800/Math.max(w,h,1));
      c.width=Math.round(w*s); c.height=Math.round(h*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      b64=c.toDataURL('image/jpeg',0.82);
    } catch(_) {}
    const ic=b64?{type:'image_url',image_url:{url:b64,detail:'low'}}:{type:'image_url',image_url:{url:img.src}};
    const prompt=detail==='detailed'?'Describe this image thoroughly. Colors, objects, text, layout. Plain language, no markdown.':'One or two sentence image description for screen reader. Plain language.';
    try {
      const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),30000);
      const resp=await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:'gpt-4o',messages:[{role:'user',content:[{type:'text',text:prompt},ic]}],
          max_tokens:detail==='detailed'?280:80}),signal:ctrl.signal});
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const d=await resp.json();
      const desc=(d.choices?.[0]?.message?.content||'').trim().replace(/\*+/g,'').replace(/\n+/g,' ');
      if (!img.alt) img.alt=desc;
      if (window.setOrbState) window.setOrbState('speaking','Speaking...');
      say('Image: '+desc);
    } catch(e) { say(img.alt?'Image: '+img.alt:'Could not describe image.'); }
  }

  /* ── CHAT ───────────────────────────────────────────────────────── */
  function startChat() {
    chatMode=true;
    if (window.setOrbState) window.setOrbState('processing','Chat');
    if (window.vaiShowChat) vaiShowChat();
    say('Chat mode on. Ask me anything. Say exit chat to stop.');
  }

  async function handleChat(t, question) {
    if (has(t,['exit chat','stop chat','end chat','quit chat','close chat','leave chat',
               'back to commands','done with chat','exit vision'])) {
      chatMode=false;
      if (window.setOrbState) window.setOrbState('listening','Listening...');
      say('Chat ended.'); return;
    }
    if (window.setOrbState) window.setOrbState('processing','Thinking...');
    if (window.appendChatMsg) appendChatMsg(question,'user');
    const key=window.__vaiOpenAIKey;
    const page=(typeof extractStructuredContent==='function'?extractStructuredContent():document.body.innerText).slice(0,3000);
    const title=document.title||window.location.hostname;
    if (key?.startsWith('sk-')) {
      try {
        const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),20000);
        const resp=await fetch('https://api.openai.com/v1/chat/completions',{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
          body:JSON.stringify({model:'gpt-4o-mini',messages:[
            {role:'system',content:'You are VisionaryAI, a voice assistant for visually impaired users. Answer in plain spoken language. No markdown. Max 3 sentences. Page: '+title+'\n'+page.slice(0,2000)},
            {role:'user',content:question}
          ],max_tokens:200,temperature:0.5}),signal:ctrl.signal});
        if (resp.status===401) { say('OpenAI key invalid.'); chatMode=false; return; }
        if (resp.ok) {
          const d=await resp.json();
          const a=(d.choices?.[0]?.message?.content||'').trim().replace(/\*+/g,'').replace(/#+\s*/g,'').replace(/\n+/g,' ');
          if (a) {
            if (window.setOrbState) window.setOrbState('speaking','Speaking...');
            say(a);
            if (window.vaiShowToast) vaiShowToast('💬 '+a.slice(0,100));
            if (window.appendChatMsg) appendChatMsg(a,'bot');
            return;
          }
        }
      } catch(e) { console.warn('[VAI] chat:',e.message); }
    }
    const ans=localAns(question,page,title,!!key);
    if (window.setOrbState) window.setOrbState('speaking','Speaking...');
    say(ans);
    if (window.appendChatMsg) appendChatMsg(ans,'bot');
  }

  function localAns(q,text,title,hasKey) {
    const l=q.toLowerCase();
    if (l.includes('how many heading')) return 'This page has '+document.querySelectorAll('h1,h2,h3,h4,h5,h6').length+' headings.';
    if (l.includes('how many link'))    return 'This page has '+document.querySelectorAll('a[href]').length+' links.';
    if (l.includes('how many image'))   return 'This page has '+document.querySelectorAll('img').length+' images.';
    if (l.includes('what is this page')||l.includes('what page')) return 'This page is titled "'+title+'".';
    const kws=l.replace(/^(what|who|where|when|why|how|is|are|can|does)\s+/,'').split(' ').filter(w=>w.length>3);
    const hit=text.split(/[.!?]+/).filter(s=>s.trim().length>20).find(s=>kws.some(k=>s.toLowerCase().includes(k)));
    if (hit) return 'Based on the page: '+hit.trim().slice(0,220);
    return hasKey?'I could not find a specific answer. Try a more specific question.'
      :'Add your OpenAI key in Settings for AI answers. Or say summarize page.';
  }

  /* ── EXTRA ACTIONS ──────────────────────────────────────────────── */
  function readHeadings() {
    const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    if (!hs.length) { say('No headings.'); return; }
    say(hs.length+' headings. '+hs.slice(0,8).map((h,i)=>(i+1)+': '+h.innerText.trim().slice(0,60)).join('. '));
  }
  function readLinks() {
    const ls=[...document.querySelectorAll('a[href]')].filter(a=>a.innerText.trim()).slice(0,8);
    if (!ls.length) { say('No links.'); return; }
    say(ls.length+' links. '+ls.map((a,i)=>(i+1)+': '+a.innerText.trim().slice(0,50)).join('. '));
  }
  function readButtons() {
    const bs=[...document.querySelectorAll('button,[role=button],input[type=submit]')].filter(b=>(b.innerText||b.value||b.getAttribute('aria-label')||'').trim()).slice(0,8);
    if (!bs.length) { say('No buttons.'); return; }
    say(bs.length+' buttons. '+bs.map((b,i)=>(i+1)+': '+(b.innerText||b.value||'button').trim().slice(0,40)).join('. '));
  }
  function announceTitle() {
    const h1=document.querySelector('h1')?.innerText?.trim()||'';
    say('You are on: '+(document.title||window.location.hostname)+'. '+(h1?'Heading: '+h1:''));
  }
  function clickFocused() {
    const el=document.activeElement;
    if (!el||el===document.body) { say('Nothing focused.'); return; }
    el.click(); say('Clicked.');
  }
  function findText(q) {
    const m=[...document.querySelectorAll('h1,h2,h3,p,a,button,li')].find(el=>el.innerText?.toLowerCase().includes(q.toLowerCase()));
    if (m) { m.scrollIntoView({behavior:'smooth',block:'center'}); m.setAttribute('tabindex','-1'); m.focus(); say('Found: '+m.innerText.trim().slice(0,80)); }
    else say('Could not find "'+q+'" on this page.');
  }
  let zoom=100;
  function zoomIn()  { zoom=Math.min(200,zoom+15); document.body.style.zoom=zoom+'%'; say('Zoom '+zoom+'%.'); }
  function zoomOut() { zoom=Math.max(60,zoom-15);  document.body.style.zoom=zoom+'%'; say('Zoom '+zoom+'%.'); }
  let hcOn=false;
  function toggleContrast() {
    hcOn=!hcOn; document.getElementById('vai-hc-css')?.remove();
    if (hcOn) { const s=Object.assign(document.createElement('style'),{id:'vai-hc-css',textContent:'body{background:#000!important;color:#fff!important}a{color:#ff0!important}'}); document.head.appendChild(s); say('High contrast on.'); }
    else say('High contrast off.');
  }

  /* ── HELP ───────────────────────────────────────────────────────── */
  function speakHelp() {
    say('VisionaryAI commands. Read page. Pause. Resume. Stop. Faster. Slower. '+
        'Next heading. Next section. Scroll down. Scroll up. Go to top. '+
        'Summarize page. Describe image. Describe all images. '+
        'Chat — to ask any question. '+
        'Hindi mode. Marathi mode. English mode. '+
        'Declutter. Focus mode. High contrast. Zoom in. Zoom out. '+
        'Start form. WCAG audit. Say sleep to deactivate.');
  }

  /* ── PUBLIC API ─────────────────────────────────────────────────── */
  window.vaiRestartVoice     = function () {
    active=false; chatMode=false; recOn=false;
    try { if(rec) rec.abort(); } catch(_) {} rec=null;
    setTimeout(()=>{ startRec(); say('Restarted. Say Hey Vision.'); },400);
  };
  window.vaiActivate         = activate;
  window.startChat           = startChat;
  window.summarizePage       = doSummarize;
  window.openAISummarizePage = doSummarize;
  window.openAIDescribeImage = doDescribeImage;

  /* ── BOOT ───────────────────────────────────────────────────────── */
  setTimeout(() => {
    startRec();
    if (window.setOrbState) window.setOrbState('listening','Say Hey Vision');
    console.log('[VAI] Ready — say Hey Vision');
  }, 300);

})();
