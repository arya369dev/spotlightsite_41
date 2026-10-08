/* =========================================================
   SPOTLIGHT — spot-ai.js
   SPOT·AI: a holographic assistant with an AR-style HUD.
   - 4D hologram: a tesseract rotating through the 4th dimension,
     projected 4D -> 3D -> 2D on a canvas (no libraries).
   - Chat works out of the box with a built-in knowledge base.
     If ANTHROPIC_API_KEY is set in Vercel, /api/chat answers
     with live AI instead (the key never reaches the browser).
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };

  /* =======================================================
     4D HOLOGRAM (tesseract) — reusable on any <canvas data-holo>
     ======================================================= */
  function hologram(canvas, opts = {}) {
    const ctx = canvas.getContext("2d");
    const V = []; for (let i = 0; i < 16; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const E = []; for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) { const d = i ^ j; if ((d & (d - 1)) === 0) E.push([i, j]); }
    const parts = Array.from({ length: opts.small ? 26 : 70 }, () => ({ x: Math.random(), y: Math.random(), v: .0015 + Math.random() * .004, r: Math.random() * 1.4 + .3 }));
    let w = 0, h = 0, dpr = 1, running = false, raf = 0, t0 = performance.now(), mx = 0, my = 0, spin = 1, last = performance.now(), fps = 60;
    const state = { xw: 0, yz: 0, zw: 0, fps: 60, talking: 0 };
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const rot = (p, a, b, th) => { const c = Math.cos(th), s = Math.sin(th), x = p[a], y = p[b]; p[a] = x * c - y * s; p[b] = x * s + y * c; };
    function frame(now) {
      const dt = Math.min(50, now - last); last = now; fps = fps * .95 + (1000 / Math.max(dt, 1)) * .05; state.fps = fps;
      if (w < 20 || h < 20) { if (running) raf = requestAnimationFrame(frame); return; }
      const t = (now - t0) / 1000;
      const sp = spin * (1 + state.talking * 1.8);
      state.xw += dt * .00055 * sp; state.yz += dt * .00032 * sp; state.zw += dt * .00021 * sp;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 + mx * 18, cy = h * .46 + my * 12, S = Math.min(w, h) * (opts.small ? .17 : .2), T = Math.min(w, h) * (opts.small ? .2 : .19);

      // light cone from the emitter
      const g = ctx.createLinearGradient(0, h * .9, 0, h * .1);
      g.addColorStop(0, "rgba(91,231,196,.28)"); g.addColorStop(1, "rgba(91,231,196,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - S * .5, h * .88); ctx.lineTo(cx + S * .5, h * .88); ctx.lineTo(cx + S * 2.1, h * .05); ctx.lineTo(cx - S * 2.1, h * .05); ctx.closePath(); ctx.fill();

      ctx.globalCompositeOperation = "lighter";
      // orbit rings
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, S * (1.9 + r * .35), S * (.42 + r * .1), Math.sin(t * .3 + r) * .25, 0, Math.PI * 2);
        ctx.strokeStyle = r === 1 ? "rgba(235,198,110,.35)" : "rgba(170,150,255,.28)"; ctx.lineWidth = 1; ctx.setLineDash(r === 2 ? [4, 8] : []); ctx.lineDashOffset = -t * 20; ctx.stroke();
      }
      ctx.setLineDash([]);
      // tesseract
      const P = V.map(v => {
        const p = v.slice();
        rot(p, 0, 3, state.xw + mx * .6); rot(p, 1, 2, state.yz + my * .6); rot(p, 2, 3, state.zw); rot(p, 0, 1, t * .12);
        const k4 = 3 / (3.6 - p[3]);                 // 4D -> 3D (perspective through the 4th axis)
        const x = p[0] * k4, y = p[1] * k4, z = p[2] * k4;
        const k3 = 5 / (6.5 - z);                      // 3D -> 2D
        return { x: cx + x * T * k3, y: cy + y * T * k3, w: p[3], z };
      });
      const pulse = .6 + .4 * Math.sin(t * 3) * (state.talking ? 1 : .3);
      for (const [a, b] of E) {
        const A = P[a], B = P[b], inner = (V[a][3] < 0 && V[b][3] < 0), outer = (V[a][3] > 0 && V[b][3] > 0);
        const col = inner ? "91,231,196" : outer ? "200,170,255" : "235,198,110";
        ctx.strokeStyle = `rgba(${col},${.16 * pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        ctx.strokeStyle = `rgba(${col},.85)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      for (const p of P) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (p.w + 1) * .9, 0, 6.283); ctx.fill(); }
      // rising data particles
      for (const q of parts) {
        q.y -= q.v; if (q.y < 0) { q.y = 1; q.x = Math.random(); }
        const px = cx + (q.x - .5) * S * 3.4 * (1 - q.y * .3), py = q.y * h * .9;
        ctx.fillStyle = `rgba(91,231,196,${.5 * (1 - Math.abs(q.y - .5) * 1.6)})`; ctx.fillRect(px, py, q.r, q.r * 3);
      }
      // emitter base
      ctx.beginPath(); ctx.ellipse(cx, h * .88, S * .9, S * .16, 0, 0, Math.PI * 2); ctx.strokeStyle = "rgba(91,231,196,.8)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, h * .88, S * .55, S * .09, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(91,231,196,.25)"; ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // occasional glitch slice
      if (!opts.small && Math.random() < .015) { const y = Math.random() * h, hh = 4 + Math.random() * 14; try { ctx.drawImage(canvas, 0, y * dpr, w * dpr, hh * dpr, (Math.random() - .5) * 18, y, w, hh); } catch {} }
      if (running) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    size();
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(canvas); else addEventListener("resize", size);
    if (reduce) { requestAnimationFrame(frame); }
    new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    const host = canvas.parentElement;
    host.addEventListener("pointermove", e => { const r = host.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
    host.addEventListener("pointerleave", () => { mx = 0; my = 0; });
    host.addEventListener("pointerdown", () => { spin = 3.5; setTimeout(() => (spin = 1), 900); });
    return state;
  }

  /* =======================================================
     KNOWLEDGE BASE (works with no server / no API key)
     ======================================================= */
  const DATA = { pillars: [], services: [] };
  fetch("/services-data.json").then(r => r.ok ? r.json() : null).then(d => { if (d) Object.assign(DATA, d); }).catch(() => {});
  const L = (href, label) => ({ href, label });
  const A = {
    audit: L("/#audit", "Get my free growth audit"),
    catalogue: L("/services", "Open the service catalogue"),
    insights: L("/insights", "Read our insights"),
    email: L("mailto:hello@spotlight.agency", "Email hello@spotlight.agency")
  };
  const norm = s => s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ");
  const has = (q, words) => words.some(w => q.includes(w));
  function localAnswer(raw) {
    const q = " " + norm(raw) + " ";
    // a specific service from the catalogue?
    const svc = DATA.services.find(s => q.includes(norm(s.name).trim()));
    if (svc) {
      const p = DATA.pillars.find(x => x.id === svc.pillar);
      return { text: `**${svc.name}** (pillar ${svc.pillar}: ${p ? p.name : ""})\n\nWhat we provide: ${svc.provides}\n\nWhere AI helps: ${svc.ai} Every output is reviewed and approved by a person.`, links: [A.catalogue, A.audit] };
    }
    if (has(q, [" hi ", " hello", " hey", "namaste", "good morning", "good evening"])) return { text: "Hello! I'm SPOT·AI, Spotlight's assistant. Ask me about our services, the free growth audit, how we use AI, or how a campaign runs.", chips: ["What do you offer?", "Free growth audit", "How do you use AI?"] };
    if (has(q, ["price", "cost", "pricing", "charge", "fees", "budget", "package", "how much", "quote"])) return { text: "Every brand's scope is different, so we don't publish fixed prices. The quickest way to an accurate quote is the free growth audit: in 48 hours you'll see where you stand and which services fit your stage and budget. No obligation.", links: [A.audit] };
    if (has(q, ["audit", "free", "48"])) return { text: "The free growth audit arrives within 48 hours and covers:\n• a visibility check across website, ads, social and search\n• a snapshot of what your top competitors are running\n• your first three moves, prioritised\n\nThere's no obligation to hire us.", links: [A.audit] };
    if (has(q, ["contact", "email", "phone", "call", "talk", "a human", "person", "reach", "whatsapp", "meeting"])) return { text: "Happy to connect you with the team. The fastest route is the audit form (we reply within 48 hours), or email hello@spotlight.agency.", links: [A.audit, A.email] };
    if (has(q, [" ai ", "artificial", "automation", "automate", "chatgpt", "human-led", "approve", "approval"])) return { text: "We're human-led and technology-enabled. AI handles research, repetitive operations and first drafts. Spotlight people lead strategy, creativity, judgment, approvals and client relationships. AI-written copy stays a draft until a person approves it, and ad budget changes start as recommendations.", links: [A.catalogue] };
    if (has(q, ["meta", "facebook", "instagram ads", "google ads", "paid", "ads", "advert", "ppc", "roas", "cpc", "performance"])) return { text: "Paid Media & Performance (pillar 04) covers Meta Ads, Google Ads, campaign setup, audience targeting, creative testing, budget pacing and optimisation. We manage to CTR, CPC, CPM, conversions and ROAS, and AI flags underperformance and recommends where to move spend.", links: [A.catalogue, A.audit] };
    if (has(q, ["listening", "sentiment", "mention", "competitor", "trend", "monitor"])) return { text: "Social Listening & Digital Intelligence (pillar 05) tracks brand mentions, sentiment, trends, conversation spikes and competitor activity, so you spot opportunities and issues early.", links: [A.catalogue] };
    if (has(q, ["report", "analytics", "dashboard", "kpi", "metric", "measure", "result"])) return { text: "Analytics, Reporting & Optimisation (pillar 06): live dashboards, weekly and monthly reports, content-performance analysis and clear recommendations for the next cycle. Data is ingested daily so you never wait for month-end.", links: [A.catalogue] };
    if (has(q, ["content", "creative", "reel", "short", "video", "copy", "caption", "carousel", "design", "post"])) return { text: "Content & Creative (pillar 02): content calendars, copywriting, static creatives, carousels, Reels, Shorts and multi-format production. AI drafts 2–3 options and makes rough cuts; our team edits, finishes and approves.", links: [A.catalogue] };
    if (has(q, ["social media", "manage", "schedul", "publish", "community", "linkedin", "twitter", " x "])) return { text: "Social Media Management (pillar 03): account management, scheduling, publishing, approvals and community monitoring across Instagram, Facebook, LinkedIn, X and more.", links: [A.catalogue] };
    if (has(q, ["strategy", "plan", "brand audit", "launch", "campaign", "ott", "film"])) return { text: "Strategy & Intelligence (pillar 01): digital strategy, audience and competitor intelligence, platform strategy, campaign planning (including product, film and OTT launches) and content strategy.", links: [A.catalogue, A.audit] };
    if (has(q, ["seo", "search", "google ranking", "aeo", "geo", "llm"])) return { text: "We optimise for Google and for AI assistants like ChatGPT, Gemini and Perplexity: structured data, question-led content, consistent facts across the web and fast, crawlable pages.", links: [A.insights, A.audit] };
    if (has(q, ["service", "offer", "do you do", "what do", "help with", "capabilit", "pillar"])) return { text: "Spotlight works across six connected pillars:\n01 Strategy & Intelligence\n02 Content & Creative\n03 Social Media Management\n04 Paid Media & Performance\n05 Social Listening & Digital Intelligence\n06 Analytics, Reporting & Optimisation\n\nTogether they cover 19 service areas. Flip through the full catalogue:", links: [A.catalogue, A.audit] };
    if (has(q, ["process", "how do you work", "how does it work", "steps", "timeline", "how long", "start", "onboard"])) return { text: "It runs as one loop: Understand › Strategize › Create › Publish › Amplify, then Monitor › Measure › Learn › Optimize › Repeat. It starts with your brief (brand, objective, audience, budget), and each month's learnings feed the next month's plan.", links: [A.catalogue, A.audit] };
    if (has(q, ["where", "location", "india", "based", "office", "country"])) return { text: "Spotlight is based in India and works with brands across India and worldwide, remotely and on-site for shoots and launches." };
    if (has(q, ["blog", "news", "event", "webinar", "article", "insight"])) return { text: "Our blog, news and events live on the Insights page, updated regularly.", links: [A.insights] };
    if (has(q, ["privacy", "data", "cookie", "gdpr", "dpdp"])) return { text: "We only collect what you share in our forms, plus analytics and ad cookies if you agree. You can ask us to see, correct or delete your data any time.", links: [L("/privacy", "Read the privacy policy")] };
    if (has(q, ["thank", "thanks", "great", "awesome", "cool"])) return { text: "Anytime! Anything else you'd like to know?", chips: ["Free growth audit", "Open the catalogue"] };
    return { text: "I'm not sure I caught that. I can help with our six service pillars, the 19 service areas, the free growth audit, how we use AI, and how a campaign runs.", chips: ["What do you offer?", "Free growth audit", "Talk to a human"] };
  }

  /* =======================================================
     CHAT UI (mounts into every [data-chat] element)
     ======================================================= */
  const HKEY = "sl-chat";
  let history = []; try { history = JSON.parse(store.get(HKEY) || "[]"); } catch { history = []; }
  const save = () => store.set(HKEY, JSON.stringify(history.slice(-30)));
  const views = new Set();
  let liveAI = null;   // null = unknown, true = server AI works, false = use local KB
  const holoStates = [];

  const fmt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  const linkHTML = links => links && links.length ? `<div class="cb-links">${links.map(l => `<a href="${esc(l.href)}" data-cta="chat">${esc(l.label)}</a>`).join("")}</div>` : "";
  const chipHTML = chips => chips && chips.length ? `<div class="cb-chips">${chips.map(c => `<button type="button" data-chip>${esc(c)}</button>`).join("")}</div>` : "";

  function msgHTML(m) {
    return `<div class="cb-msg ${m.role}">${m.role === "bot" ? '<span class="cb-ava" aria-hidden="true"></span>' : ""}<div class="cb-bub"><p>${fmt(m.text)}</p>${linkHTML(m.links)}${chipHTML(m.chips)}</div></div>`;
  }
  function renderAll() {
    views.forEach(v => {
      v.log.innerHTML = history.map(msgHTML).join("");
      v.log.scrollTop = v.log.scrollHeight;
    });
  }
  const welcome = { role: "bot", text: "Hi, I'm **SPOT·AI**. I can walk you through Spotlight's six service pillars, our 19 services, the free growth audit, or how we use AI. What would you like to know?", chips: ["What do you offer?", "Free growth audit", "How do you use AI?", "Meta & Google ads"] };

  async function ask(text) {
    text = text.trim().slice(0, 500); if (!text) return;
    history.push({ role: "user", text }); save(); renderAll();
    views.forEach(v => { v.root.classList.add("thinking"); v.typing.hidden = false; v.log.scrollTop = v.log.scrollHeight; });
    holoStates.forEach(s => (s.talking = 1)); setAI("thinking");
    let reply = null;
    if (liveAI !== false) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, signal: ctrl.signal,
          body: JSON.stringify({ messages: history.slice(-10).map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })) }) });
        clearTimeout(to);
        if (r.ok) { const j = await r.json(); if (j.reply) { reply = { text: j.reply, links: j.links || [] }; liveAI = true; } else if (j.fallback && liveAI !== true) liveAI = false; }
        else if (r.status === 501 || r.status === 404 || r.status === 405) liveAI = false;
      } catch { liveAI = liveAI === true ? true : false; }
    }
    if (!reply) { await new Promise(r => setTimeout(r, 450 + Math.random() * 450)); reply = localAnswer(text); }
    views.forEach(v => { v.mode.textContent = liveAI ? "LIVE AI" : "KNOWLEDGE BASE"; });
    // type the reply out
    const msg = { role: "bot", text: "", links: reply.links, chips: reply.chips };
    history.push(msg);
    views.forEach(v => { v.root.classList.remove("thinking"); v.typing.hidden = true; });
    const full = reply.text; const step = Math.max(2, Math.round(full.length / 60));
    if (reduce) { msg.text = full; renderAll(); }
    else { for (let i = 0; i <= full.length; i += step) { msg.text = full.slice(0, i); renderAll(); await new Promise(r => setTimeout(r, 16)); } msg.text = full; renderAll(); }
    holoStates.forEach(s => (s.talking = 0));
    setAI(""); speak(full);
    save();
    if (window.slTrack) window.slTrack("chat_message", { q: text.slice(0, 80) });
  }

  function mount(root) {
    root.innerHTML = `
      <div class="cb-head">
        <span class="cb-dot" aria-hidden="true"></span>
        <div><b>SPOT·AI</b><small>Spotlight's assistant · <span data-mode>KNOWLEDGE BASE</span></small></div>
        <div class="cb-tools">
          <button type="button" class="cb-tool" data-voice aria-pressed="false" aria-label="Spoken replies" title="Spoken replies"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg></button>
          <select class="cb-persona" data-persona aria-label="Assistant voice"><option value="atlas">Atlas · deep</option><option value="nova">Nova · bright</option></select>
          <button type="button" class="cb-reset" data-reset aria-label="Start a new conversation">New</button>
        </div>
      </div>
      <div class="cb-log" role="log" aria-live="polite" aria-label="Conversation with SPOT·AI"></div>
      <div class="cb-typing" hidden aria-hidden="true"><i></i><i></i><i></i><span>Thinking</span></div>
      <form class="cb-form" autocomplete="off">
        <label class="sr-only" for="cb-in-${views.size}">Ask SPOT·AI a question</label>
        <input id="cb-in-${views.size}" type="text" maxlength="500" placeholder="Ask, or tap the mic and speak…" enterkeyhint="send">
        <button type="button" class="cb-mic" data-mic aria-label="Speak your question" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
        <button type="submit" class="cb-send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button>
      </form>
      <p class="cb-note">AI answers can be imperfect. For anything important, our team will confirm.</p>`;
    const v = { root, log: $(".cb-log", root), typing: $(".cb-typing", root), mode: $("[data-mode]", root), input: $("input", root) };
    views.add(v);
    $(".cb-form", root).addEventListener("submit", e => { e.preventDefault(); const t = v.input.value; v.input.value = ""; ask(t); });
    root.addEventListener("click", e => {
      const c = e.target.closest("[data-chip]"); if (c) { ask(c.textContent); return; }
      if (e.target.closest("[data-reset]")) { history = [welcome]; save(); renderAll(); v.input.focus(); }
    });
    const vb = $("[data-voice]", root), ps = $("[data-persona]", root), mic = $("[data-mic]", root);
    vb.setAttribute("aria-pressed", String(voice.on)); ps.value = voice.persona;
    vb.addEventListener("click", () => { voice.on = !voice.on; syncVoiceUI(); if (!voice.on) speechSynthesis.cancel(); else speak("Voice replies are on."); });
    ps.addEventListener("change", () => { voice.persona = ps.value; syncVoiceUI(); if (voice.on) speak(ps.value === "atlas" ? "Atlas online. How can I help?" : "Nova here. What shall we build?"); });
    if (!("speechSynthesis" in window)) { vb.hidden = true; ps.hidden = true; }
    if (!Recognition) mic.hidden = true;
    mic.addEventListener("click", () => listen(v));
    if (!history.length) { history = [welcome]; save(); }
    renderAll();
    return v;
  }

  /* =======================================================
     VOICE: spoken replies (two voices) + speech-to-text input
     Uses the browser's built-in speech features. Nothing is
     recorded by Spotlight. Some browsers process speech online.
     ======================================================= */
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voice = { on: store.get("sl-voice") === "1", persona: store.get("sl-persona") || "atlas" };
  const setAI = st => { document.documentElement.dataset.ai = st || ""; };
  function syncVoiceUI() {
    store.set("sl-voice", voice.on ? "1" : "0"); store.set("sl-persona", voice.persona);
    views.forEach(v => { const b = $("[data-voice]", v.root), p = $("[data-persona]", v.root); if (b) b.setAttribute("aria-pressed", String(voice.on)); if (p) p.value = voice.persona; });
  }
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const prefs = voice.persona === "atlas"
      ? [/UK English Male/i, /Daniel/i, /Ryan|George|Guy|Arthur|Rishi|Prabhat/i, /Male/i]
      : [/UK English Female/i, /Libby|Sonia|Neerja|Heera/i, /Samantha|Karen|Moira|Serena/i, /Female|Google US English/i];
    for (const re of prefs) { const f = vs.find(v => re.test(v.name)); if (f) return f; }
    return vs[0] || null;
  }
  function speak(text) {
    if (!voice.on || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/\*\*/g, "").replace(/[•›]/g, ",").replace(/\n+/g, ". ").slice(0, 600));
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = voice.persona === "atlas" ? .98 : 1.04; u.pitch = voice.persona === "atlas" ? .82 : 1.12;
      u.onstart = () => { setAI("speaking"); holoStates.forEach(s => (s.talking = 1)); };
      u.onend = u.onerror = () => { setAI(""); holoStates.forEach(s => (s.talking = 0)); };
      speechSynthesis.speak(u);
    } catch {}
  }
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};
  let rec = null;
  function listen(v) {
    if (!Recognition) return;
    if (rec) { rec.stop(); return; }
    rec = new Recognition(); rec.lang = "en-IN"; rec.interimResults = true; rec.maxAlternatives = 1;
    const mic = $("[data-mic]", v.root); mic.setAttribute("aria-pressed", "true"); v.root.classList.add("listening"); setAI("listening");
    speechSynthesis && speechSynthesis.cancel && speechSynthesis.cancel();
    let finalText = "";
    rec.onresult = e => { let t = ""; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) finalText = t; } v.input.value = t; };
    rec.onerror = e => { if (e.error === "not-allowed") v.input.placeholder = "Microphone blocked. Allow it in your browser to speak."; };
    rec.onend = () => {
      mic.setAttribute("aria-pressed", "false"); v.root.classList.remove("listening"); setAI(""); rec = null;
      const t = (finalText || v.input.value).trim();
      if (t) { v.input.value = ""; if (!voice.on) { voice.on = true; syncVoiceUI(); } ask(t); }
    };
    try { rec.start(); } catch { rec = null; }
  }

  /* inline chat section (homepage) */
  $$("[data-chat]").forEach(mount);
  $$("canvas[data-holo]").forEach(c => holoStates.push(hologram(c, { small: c.hasAttribute("data-small") })));

  /* floating launcher + drawer on every page */
  const fab = document.createElement("button");
  fab.type = "button"; fab.className = "chat-fab"; fab.setAttribute("aria-label", "Ask SPOT·AI, our chat assistant"); fab.setAttribute("aria-haspopup", "dialog"); fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = `<span class="fab-holo" aria-hidden="true"><i></i><i></i><i></i></span><span class="fab-txt">Ask SPOT·AI</span>`;
  const drawer = document.createElement("div");
  drawer.className = "chat-drawer"; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-label", "Chat with SPOT·AI"); drawer.hidden = true;
  drawer.innerHTML = `<div class="cd-holo"><canvas data-holo data-small aria-hidden="true"></canvas><div class="hud-mini" aria-hidden="true"><i></i><i></i><i></i><i></i><span data-hud-fps>4D · LINK STABLE</span></div><button type="button" class="cd-close" aria-label="Close chat">×</button></div><div class="chatbox" data-chat-drawer></div>`;
  document.body.append(fab, drawer);
  let drawerReady = false;
  const openDrawer = () => {
    const inline = $("#ask [data-chat]");
    if (inline) { $("#ask").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); setTimeout(() => $("input", inline).focus({ preventScroll: true }), 600); return; }
    if (!drawerReady) { mount($("[data-chat-drawer]", drawer)); holoStates.push(hologram($("canvas", drawer), { small: true })); drawerReady = true; }
    drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add("open"));
    fab.setAttribute("aria-expanded", "true"); $("input", drawer).focus();
  };
  const closeDrawer = () => { drawer.classList.remove("open"); fab.setAttribute("aria-expanded", "false"); setTimeout(() => (drawer.hidden = true), 350); fab.focus(); };
  fab.addEventListener("click", () => (drawer.classList.contains("open") ? closeDrawer() : openDrawer()));
  $(".cd-close", drawer).addEventListener("click", closeDrawer);
  addEventListener("keydown", e => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });
  // hide the launcher while the inline chat is on screen
  const ask$ = $("#ask");
  if (ask$) new IntersectionObserver(([e]) => fab.classList.toggle("hide", e.isIntersecting), { threshold: .25 }).observe(ask$);

  /* =======================================================
     AR HUD readouts + target reticle
     ======================================================= */
  const bay = $(".holo-bay");
  if (bay) {
    const rx = $("[data-hud-rot]", bay), fpsEl = $("[data-hud-fps]", bay), ret = $(".reticle", bay), coord = $("[data-hud-xy]", bay);
    setInterval(() => {
      const s = holoStates[0]; if (!s) return;
      const deg = a => String(Math.round((a * 57.3) % 360)).padStart(3, "0");
      if (rx) rx.textContent = `XW ${deg(s.xw)}° · YZ ${deg(s.yz)}° · ZW ${deg(s.zw)}°`;
      if (fpsEl) fpsEl.textContent = `${Math.round(Math.min(60, s.fps))} FPS · 4D LINK ${s.talking ? "TRANSMITTING" : "STABLE"}`;
    }, 250);
    if (fine && !reduce && ret) {
      bay.addEventListener("pointermove", e => {
        const r = bay.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        ret.style.transform = `translate(${x}px,${y}px)`; ret.classList.add("on");
        if (coord) coord.textContent = `X ${String(Math.round(x)).padStart(4, "0")} · Y ${String(Math.round(y)).padStart(4, "0")}`;
      });
      bay.addEventListener("pointerleave", () => ret.classList.remove("on"));
    }
  }
})();
