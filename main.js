/* =========================================================
   SPOTLIGHT — main.js
   Motion, interactions, consent-gated analytics, form handling.
   No secrets live here: only PUBLIC ids (GA4, Meta Pixel,
   Turnstile site key). Secret keys stay in Vercel env vars.
   ========================================================= */

const CONFIG = {
  GA4_ID: "",             // e.g. "G-XXXXXXXXXX"  (public id, safe in the browser)
  META_PIXEL_ID: "",      // e.g. "1234567890"    (public id, safe in the browser)
  TURNSTILE_SITE_KEY: "", // Cloudflare Turnstile SITE key (public). Secret goes in Vercel env.
  CONTACT_EMAIL: "hello@spotlight.agency",
  CONTACT_ENDPOINT: "/api/contact",
  POSTS_ENDPOINT: "/api/content?route=posts"
};

(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* one passive scroll listener, batched into a single animation frame */
  const scrollFns = []; let scrollQueued = false;
  const runScroll = () => { scrollQueued = false; for (const f of scrollFns) f(); };
  addEventListener("scroll", () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(runScroll); } }, { passive: true });
  const onScrollFrame = f => { scrollFns.push(f); f(); };
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch {} }
  };

  $$("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));

  /* ---------- attribution capture (for Meta / Google ads) ---------- */
  const params = new URLSearchParams(location.search);
  const AD_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  const fromAd = AD_KEYS.some(k => params.has(k));
  if (fromAd) {
    const a = {}; AD_KEYS.forEach(k => params.get(k) && (a[k] = params.get(k)));
    a.landing = location.pathname; store.set("sl-attr", JSON.stringify(a), sessionStorage);
  }

  /* =======================================================
     CONSENT + ANALYTICS (nothing loads before a yes)
     ======================================================= */
  const consentEl = $("#consent");
  let consent = null;
  try { consent = JSON.parse(store.get("sl-consent") || "null"); } catch { consent = null; }
  let gaReady = false, pixelReady = false;

  function loadScript(src, attrs = {}) {
    const s = document.createElement("script");
    s.src = src; s.async = true; Object.assign(s, attrs); document.head.appendChild(s); return s;
  }
  function loadGA() {
    if (gaReady || !CONFIG.GA4_ID) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    gtag("js", new Date());
    gtag("config", CONFIG.GA4_ID, { anonymize_ip: true });
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GA4_ID));
    gaReady = true;
  }
  function loadPixel() {
    if (pixelReady || !CONFIG.META_PIXEL_ID) return;
    /* Meta Pixel base code */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", CONFIG.META_PIXEL_ID);
    fbq("track", "PageView");
    pixelReady = true;
  }
  function applyConsent(c) {
    consent = c;
    store.set("sl-consent", JSON.stringify(c));
    if (c.a) loadGA();
    if (c.m) loadPixel();
    if (gaReady && c.m) gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  }
  /* one tracking helper for both platforms */
  window.slTrack = function (name, data = {}, metaStd = null, eventID) {
    if (gaReady && window.gtag) gtag("event", name, data);
    if (pixelReady && window.fbq) {
      if (metaStd) fbq("track", metaStd, data, eventID ? { eventID } : undefined);
      else fbq("trackCustom", name, data);
    }
  };

  if (consentEl) {
    const cA = $("#c-analytics"), cM = $("#c-marketing");
    const show = () => { consentEl.classList.add("show"); document.body.classList.add("consent-open"); };
    const hide = () => { consentEl.classList.remove("show", "custom"); document.body.classList.remove("consent-open"); };
    if (!consent) setTimeout(show, 1600); else applyConsent(consent);
    consentEl.addEventListener("click", e => {
      const b = e.target.closest("[data-consent]"); if (!b) return;
      const t = b.dataset.consent;
      if (t === "accept") { applyConsent({ a: true, m: true, v: 1, t: Date.now() }); hide(); }
      else if (t === "reject") { applyConsent({ a: false, m: false, v: 1, t: Date.now() }); hide(); }
      else if (t === "custom") {
        if (!consentEl.classList.contains("custom")) {
          consentEl.classList.add("custom"); b.textContent = "Save choices";
          cA.checked = !!(consent && consent.a); cM.checked = !!(consent && consent.m); cA.focus();
        } else { applyConsent({ a: cA.checked, m: cM.checked, v: 1, t: Date.now() }); hide(); b.textContent = "Choose"; }
      }
    });
    $$("[data-open-consent]").forEach(b => b.addEventListener("click", () => {
      show(); consentEl.classList.add("custom");
      const btn = $('[data-consent="custom"]', consentEl); btn.textContent = "Save choices";
      cA.checked = !!(consent && consent.a); cM.checked = !!(consent && consent.m); cA.focus();
    }));
  }

  /* CTA click tracking */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-cta]"); if (!a) return;
    slTrack("cta_click", { location: a.dataset.cta }, null);
    if (pixelReady) fbq("track", "Contact", { content_name: a.dataset.cta });
  });

  /* =======================================================
     HEADER, MENU, PROGRESS
     ======================================================= */
  const header = $("#header");
  const hero = $(".hero");
  const progress = $(".progress");
  const burger = $(".burger"), menu = $("#menu");
  let lastY = scrollY, maxY = 1, heroEnd = 0;
  const measure = () => { maxY = document.documentElement.scrollHeight - innerHeight; heroEnd = hero ? hero.offsetHeight - 90 : 0; };
  addEventListener("resize", measure);
  // measure after first paint (avoids a forced layout during start-up); RO keeps it fresh
  requestAnimationFrame(() => { measure(); if ("ResizeObserver" in window) new ResizeObserver(() => requestAnimationFrame(measure)).observe(document.body); });
  function onScroll() {
    const y = scrollY;
    if (progress) progress.style.setProperty("--p", maxY > 0 ? Math.min(1, y / maxY).toFixed(4) : 0);
    if (header) {
      header.classList.toggle("is-light", !hero || y > heroEnd);
      const menuOpen = menu && menu.classList.contains("open");
      header.classList.toggle("is-hidden", !menuOpen && y > 500 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
    }
    lastY = y;
  }
  onScrollFrame(onScroll);

  if (burger && menu) {
    const close = () => { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); burger.setAttribute("aria-label", "Open menu"); header.classList.remove("menu-open"); };
    burger.addEventListener("click", () => {
      const open = !menu.classList.contains("open");
      menu.classList.toggle("open", open); header.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open)); burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) $("a", menu).focus();
    });
    $$("a", menu).forEach(a => a.addEventListener("click", close));
    addEventListener("keydown", e => { if (e.key === "Escape" && menu.classList.contains("open")) { close(); burger.focus(); } });
  }

  /* =======================================================
     INTRO FILM
     ======================================================= */
  const intro = $("#intro"), iv = $("#introVideo");
  const ready = () => root.classList.add("is-ready");
  function closeIntro() {
    if (!intro || intro.hidden) { ready(); return; }
    intro.classList.add("is-out");
    ready();
    store.set("sl-intro-seen", "1", sessionStorage);
    setTimeout(() => { intro.hidden = true; root.classList.remove("intro-pending"); intro.classList.remove("is-out"); try { iv.pause(); } catch {} }, reduce ? 0 : 1300);
    const t = $("#replayIntro"); if (t && document.activeElement && intro.contains(document.activeElement)) t.focus();
  }
  function openIntro(withSound) {
    if (!intro) return;
    intro.hidden = false; intro.classList.remove("is-out");
    iv.currentTime = 0; iv.muted = !withSound;
    const sb = $("#introSound"); sb.setAttribute("aria-pressed", String(withSound)); sb.textContent = withSound ? "Sound off" : "Play with sound"; intro.classList.toggle("has-sound", withSound);
    const p = iv.play(); if (p && p.catch) p.catch(() => { iv.muted = true; iv.play().catch(closeIntro); });
    $("#introSkip").focus();
  }
  if (intro && iv) {
    const seen = store.get("sl-intro-seen", sessionStorage);
    const playable = !!(iv.canPlayType("video/mp4") || iv.canPlayType("video/webm"));
    if (!root.classList.contains("intro-pending") || reduce || seen || fromAd || !playable) { intro.hidden = true; root.classList.remove("intro-pending"); ready(); }
    else {
      openIntro(false);
      /* watchdogs: never trap a visitor behind a film that can't play */
      setTimeout(() => { if (!intro.hidden && iv.currentTime === 0) closeIntro(); }, 4000);
      setTimeout(() => { if (!intro.hidden && iv.muted) closeIntro(); }, 14000);
    }
    iv.addEventListener("ended", closeIntro);
    iv.addEventListener("error", closeIntro);
    const lastSrc = iv.querySelector("source:last-of-type");
    if (lastSrc) lastSrc.addEventListener("error", closeIntro);
    iv.addEventListener("timeupdate", () => intro.style.setProperty("--t", (iv.currentTime / (iv.duration || 10)).toFixed(3)));
    $("#introSkip").addEventListener("click", closeIntro);
    $("#introSound").addEventListener("click", e => {
      const b = e.currentTarget;
      if (iv.muted) {
        /* restart with the cinematic score so the hits land on the light */
        if (iv.currentTime > 1.2) iv.currentTime = 0;
        iv.muted = false; iv.volume = 1; iv.play().catch(() => {});
      } else iv.muted = true;
      b.setAttribute("aria-pressed", String(!iv.muted));
      b.textContent = iv.muted ? "Play with sound" : "Sound off";
      intro.classList.toggle("has-sound", !iv.muted);
    });
    intro.addEventListener("keydown", e => {
      if (e.key === "Escape") closeIntro();
      if (e.key === "Tab") { const f = $$("button", intro); const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    });
    const rp = $("#replayIntro"); if (rp) rp.addEventListener("click", () => { openIntro(true); slTrack("intro_replay", {}); });
  } else ready();

  /* =======================================================
     HERO: dust in the beam + parallax
     ======================================================= */
  const dust = $(".dust");
  let heroVisible = true;
  let heroWake = null;
  if (hero) new IntersectionObserver(([e]) => { const was = heroVisible; heroVisible = e.isIntersecting; if (heroVisible && !was && heroWake) heroWake(); }).observe(hero);
  if (dust && !reduce) {
    const ctx = dust.getContext("2d");
    let w, h, dpr, parts = [];
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2); w = dust.clientWidth; h = dust.clientHeight;
      dust.width = w * dpr; dust.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp(w * h / 14000, 40, 140));
      parts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .3, vx: (Math.random() - .5) * .15, vy: -Math.random() * .25 - .05, a: Math.random() * .6 + .2, tw: Math.random() * 6.28 }));
    };
    size(); addEventListener("resize", size);
    let px = .5, py = .5;
    if (hero) hero.addEventListener("pointermove", e => { const r = hero.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height; });
    let dustOn = false;
    const tick = t => {
      dustOn = heroVisible;
      if (heroVisible) {
        ctx.clearRect(0, 0, w, h);
        const ox = (px - .5) * 24, oy = (py - .5) * 16;
        for (const p of parts) {
          p.x += p.vx; p.y += p.vy; p.tw += .02;
          if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
          if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5;
          const al = p.a * (.6 + .4 * Math.sin(p.tw));
          ctx.beginPath(); ctx.arc(p.x + ox * p.r, p.y + oy * p.r, p.r, 0, 6.283);
          ctx.fillStyle = `rgba(255,${235 + p.r * 10 | 0},${200 + p.r * 30 | 0},${al})`; ctx.fill();
        }
        requestAnimationFrame(tick);
      }
    };
    heroWake = () => { if (!dustOn) { dustOn = true; requestAnimationFrame(tick); } };
    dustOn = true; requestAnimationFrame(tick);
  }
  if (hero && finePointer && !reduce) {
    const vid = $(".hero-video"), beam = $(".hero-beam");
    hero.addEventListener("pointermove", e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      vid.style.setProperty("--mx", (x * -18).toFixed(1) + "px"); vid.style.setProperty("--my", (y * -12).toFixed(1) + "px");
      beam.style.setProperty("--hx", (e.clientX - r.left) + "px"); beam.style.setProperty("--hy", (e.clientY - r.top) + "px");
    });
  }
  /* hero HUD values flicker like live telemetry */
  const ticks = $$("[data-hud-tick]");
  if (ticks.length && !reduce) setInterval(() => {
    if (!heroVisible) return;
    ticks.forEach(t => {
      const base = parseFloat(t.dataset.hudTick), lbl = t.textContent.replace(/[\d.]+/, "#");
      const v = base < 10 ? (base + (Math.random() - .5) * .4).toFixed(1) : Math.round(base + (Math.random() - .5) * 3);
      t.textContent = lbl.replace("#", v);
    });
  }, 1400);

  /* pause background video when off-screen (saves battery + CPU) */
  const hv = $(".hero-video");
  if (hv) {
    if (reduce) { hv.removeAttribute("autoplay"); hv.pause(); }
    else if (hero) new IntersectionObserver(([e]) => { e.isIntersecting ? hv.play().catch(() => {}) : hv.pause(); }).observe(hero);
  }

  /* =======================================================
     CUSTOM CURSOR + GEL SPOTLIGHT
     ======================================================= */
  if (finePointer && !reduce) {
    root.classList.add("has-cursor");
    const dot = $(".cursor"), ring = $(".cursor-ring"), label = $(".cursor-ring span"), spot = $(".spot");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, sx = mx, sy = my, shown = false;
    addEventListener("pointermove", e => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = sx = mx; ry = sy = my; root.classList.add("cursor-on"); }
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    }, { passive: true });
    window.SLCursor = txt => { ring.classList.toggle("is-label", !!txt); ring.classList.remove("is-hover"); label.textContent = txt || ""; };
    document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
    document.addEventListener("pointerup", () => ring.classList.remove("is-down"));
    document.addEventListener("pointerover", e => {
      const t = e.target;
      const lab = t.closest("[data-cursor]");
      const inter = t.closest("a,button,summary,[role=tab],label,select");
      ring.classList.toggle("is-label", !!lab);
      ring.classList.toggle("is-hover", !lab && !!inter);
      label.textContent = lab ? lab.dataset.cursor : "";
      const gelEl = t.closest('[style*="--gel"]');
      const gel = gelEl ? getComputedStyle(gelEl).getPropertyValue("--gel").trim() : "";
      spot.style.setProperty("--gel", gel || "#E4DBF8");
      const dark = !!t.closest(".hero,.curtain,.intro,.theatre,.nano");
      spot.style.opacity = dark ? "0" : ".4";
    });
    document.documentElement.addEventListener("pointerleave", () => root.classList.remove("cursor-on"));
    document.documentElement.addEventListener("pointerenter", () => shown && root.classList.add("cursor-on"));
    let looping = false;
    const loop = () => {
      rx = lerp(rx, mx, .2); ry = lerp(ry, my, .2);
      sx = lerp(sx, mx, .08); sy = lerp(sy, my, .08);
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      spot.style.transform = `translate3d(${sx}px,${sy}px,0)`;
      if (Math.abs(sx - mx) + Math.abs(sy - my) + Math.abs(rx - mx) + Math.abs(ry - my) > .3) requestAnimationFrame(loop);
      else looping = false;   // settled: sleep until the pointer moves again
    };
    addEventListener("pointermove", () => { if (!looping) { looping = true; requestAnimationFrame(loop); } }, { passive: true });

    /* magnetic buttons */
    $$(".magnetic").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* =======================================================
     REVEALS, SPLIT HEADINGS, COUNTERS
     ======================================================= */
  $$("[data-split]").forEach(h => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute("aria-label", h.textContent.trim());
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(" ");
  });
  const countUp = el => {
    const end = +el.dataset.count, suf = el.dataset.suffix || "", dur = 1400, t0 = performance.now();
    const step = now => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(end * e) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; el.classList.add("in"); io.unobserve(el);
      $$("[data-count]", el).forEach(c => !reduce && countUp(c));
    });
  }, { threshold: .18, rootMargin: "0px 0px -6% 0px" });
  $$("[data-reveal],[data-split]").forEach(el => io.observe(el));
  /* stagger cards automatically */
  $$(".cards .playcard").forEach((c, i) => c.style.setProperty("--d", (i % 4) * 90));

  /* manifesto: words light up as you scroll */
  const man = $("[data-manifesto]");
  if (man) {
    const html = man.textContent.trim().split(/\s+/).map(w => {
      const g = /^\*.*\*$/.test(w); const t = w.replace(/\*/g, "");
      return `<span class="mw${g ? " gold" : ""}">${t}</span>`;
    }).join(" ");
    man.innerHTML = html;
    const words = $$(".mw", man);
    let lastN = -1;
    const upd = () => {
      const r = man.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const k = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35), 0, 1);
      const n = Math.round(k * words.length);
      if (n === lastN) return; lastN = n;
      words.forEach((w, i) => w.classList.toggle("lit", reduce || i < n));
    };
    onScrollFrame(upd);
  }

  /* =======================================================
     PLAYCARDS: tilt, glare, flip (mouse, touch, keyboard)
     ======================================================= */
  $$(".playcard").forEach(card => {
    const front = $(".front", card), back = $(".back", card), fb = $(".flip-btn", card), ub = $(".unflip", card);
    const setFlip = on => {
      card.classList.toggle("is-flipped", on);
      fb.setAttribute("aria-expanded", String(on));
      front.inert = on; back.inert = !on;
      (on ? ub : fb).focus({ preventScroll: true });
      if (on) slTrack("service_view", { service: $("h3", card).textContent }, "ViewContent");
    };
    fb.addEventListener("click", () => setFlip(true));
    ub.addEventListener("click", () => setFlip(false));
    card.addEventListener("keydown", e => { if (e.key === "Escape" && card.classList.contains("is-flipped")) setFlip(false); });
    if (finePointer && !reduce) {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", ((x - .5) * 14).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((.5 - y) * 12).toFixed(2) + "deg");
        card.style.setProperty("--gx", (x * 100).toFixed(1) + "%"); card.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", () => { card.classList.remove("is-tilting"); card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
    }
  });

  /* =======================================================
     LIVE CONSOLE (demo data, purely decorative)
     ======================================================= */
  const consoleEl = $(".console");
  if (consoleEl) {
    const A = $(".lineA", consoleEl), B = $(".lineB", consoleEl), AR = $(".area", consoleEl), D = $(".dot", consoleEl);
    const N = 14; let a = [], b = [];
    for (let i = 0; i < N; i++) { a.push(110 - i * 5 + Math.random() * 18); b.push(120 - i * 2.5 + Math.random() * 10); }
    const path = arr => arr.map((v, i) => `${i ? "L" : "M"}${(i / (N - 1) * 400).toFixed(1)},${clamp(v, 12, 160).toFixed(1)}`).join(" ");
    const smooth = arr => { let d = `M0,${arr[0]}`; for (let i = 1; i < arr.length; i++) { const x0 = (i - 1) / (N - 1) * 400, x1 = i / (N - 1) * 400, xm = (x0 + x1) / 2; d += ` C${xm},${arr[i - 1]} ${xm},${arr[i]} ${x1},${arr[i]}`; } return d; };
    const draw = () => {
      const pa = smooth(a.map(v => clamp(v, 14, 158)));
      A.setAttribute("d", pa); B.setAttribute("d", path(b)); AR.setAttribute("d", pa + " L400,170 L0,170 Z");
      D.setAttribute("cy", clamp(a[N - 1], 14, 158));
    };
    draw();
    const signals = [
      ["New high-intent audience found", "Shift budget"], ["Creative B beating A by 31%", "Scale B"],
      ["Competitor launched a new offer", "Review"], ["Search interest rising for your category", "Boost"],
      ["Cost per lead dropped on Reels", "Reallocate"], ["Landing page speed improved", "Keep"],
      ["AI assistant cited your brand", "Celebrate"], ["Retargeting pool reached 12k", "Launch"]
    ];
    const sigBox = $(".signals", consoleEl); let si = 0;
    const pushSignal = () => {
      const [t, act] = signals[si++ % signals.length];
      const el = document.createElement("div"); el.className = "signal enter"; el.innerHTML = `<span>${t}</span><em>${act}</em>`;
      sigBox.prepend(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("enter")));
      while (sigBox.children.length > 3) sigBox.lastElementChild.remove();
    };
    pushSignal(); pushSignal(); pushSignal();
    const kR = $('[data-kpi="roas"]'), kL = $('[data-kpi="leads"]'), kC = $('[data-kpi="cpl"]');
    let leads = 128, roas = 4.2, cpl = 212, visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(consoleEl);
    if (!reduce) setInterval(() => {
      if (!visible || document.hidden) return;
      a.shift(); a.push(clamp(a[a.length - 1] + (Math.random() - .62) * 22, 18, 150));
      b.shift(); b.push(clamp(b[b.length - 1] + (Math.random() - .55) * 12, 40, 150));
      draw();
      leads += Math.random() < .7 ? 1 + (Math.random() * 3 | 0) : 0; roas = clamp(roas + (Math.random() - .45) * .08, 3.6, 5.4); cpl = clamp(cpl + (Math.random() - .55) * 4, 180, 240);
      kL.textContent = leads; kR.textContent = roas.toFixed(1) + "x"; kC.textContent = "₹" + Math.round(cpl);
      if (Math.random() < .5) pushSignal();
    }, 1800);
  }

  /* =======================================================
     PROCESS: the beam travels, each act lights up
     ======================================================= */
  const acts = $(".acts-wrap");
  if (acts) {
    const line = $(".beamline", acts), items = $$(".act", acts);
    const upd = () => {
      const r = acts.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const k = clamp((innerHeight * .75 - r.top) / (r.height * .9), 0, 1);
      const tops = items.map(it => it.getBoundingClientRect().top);   // read everything first…
      if (line) line.style.setProperty("--beam", reduce ? 1 : k.toFixed(3));   // …then write (no layout thrash)
      items.forEach((it, i) => it.classList.toggle("lit", reduce || tops[i] < innerHeight * .78 && (innerWidth < 880 || k >= i / items.length)));
    };
    onScrollFrame(upd); addEventListener("resize", upd);
  }

  /* =======================================================
     INSIGHTS: blog / news / events (from /api/content)
     ======================================================= */
  const postsEl = $("#posts");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const GELS = { blog: "var(--lilac)", news: "var(--sky)", event: "var(--rose)" };
  const LABEL = { blog: "Blog", news: "News", event: "Event" };
  const fmt = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  function card(p, i) {
    const ev = p.type === "event" && p.event && p.event.start;
    const d = ev ? new Date(p.event.start) : null;
    const cover = p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.coverAlt || "")}" loading="lazy" decoding="async" width="640" height="360">` : `<span class="glyph" aria-hidden="true">${esc(p.title.charAt(0))}</span>`;
    return `<article class="post" style="--gel:${GELS[p.type] || "var(--mint)"};--i:${i}">
      <div class="post-cover">${cover}<span class="post-type">${LABEL[p.type] || "Story"}</span>${ev ? `<span class="post-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString("en-IN", { month: "short" })}</small></span>` : ""}</div>
      <div class="post-body"><h3><a href="/insights/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p>
      <div class="post-meta"><span>${ev ? esc(p.event.location || "Online") : fmt(p.date)}</span>${p.readingTime ? `<span>${esc(p.readingTime)} min read</span>` : ""}</div></div></article>`;
  }
  async function loadPosts(type) {
    if (!postsEl) return;
    const limit = postsEl.dataset.limit || 6;
    postsEl.setAttribute("aria-busy", "true");
    postsEl.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const r = await fetch(`${CONFIG.POSTS_ENDPOINT}&type=${encodeURIComponent(type)}&limit=${limit}`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(r.status);
      const { posts = [] } = await r.json();
      postsEl.innerHTML = posts.length ? posts.map(card).join("") : `<p class="empty">Nothing here yet. New ${type === "all" ? "stories" : LABEL[type].toLowerCase() + " posts"} are on their way.</p>`;
    } catch {
      postsEl.innerHTML = `<p class="empty">Insights couldn't load right now. <a class="text-link" href="/insights">Open the insights page</a></p>`;
    }
    postsEl.removeAttribute("aria-busy");
  }
  const tabs = $(".tabs");
  if (tabs && postsEl) {
    const btns = $$("[role=tab]", tabs), pill = $(".pill", tabs);
    const movePill = b => { pill.style.width = b.offsetWidth + "px"; pill.style.transform = `translateX(${b.offsetLeft}px)`; };
    const select = (b, focus) => {
      btns.forEach(x => { const on = x === b; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; });
      movePill(b); if (focus) b.focus(); loadPosts(b.dataset.type);
    };
    btns.forEach(b => b.addEventListener("click", () => select(b)));
    tabs.addEventListener("keydown", e => {
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); select(btns[(i + 1) % btns.length], true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); select(btns[(i - 1 + btns.length) % btns.length], true); }
    });
    addEventListener("resize", () => movePill($('[aria-selected="true"]', tabs)));
    requestAnimationFrame(() => movePill(btns[0]));
    /* load when the section gets close, not on first paint */
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { loadPosts("all"); o.disconnect(); } }, { rootMargin: "400px" }).observe(postsEl);
  }

  /* =======================================================
     FAQ: smooth open / close
     ======================================================= */
  $$(".faq details").forEach(d => {
    const s = $("summary", d), body = $(".ans", d);
    s.addEventListener("click", e => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        const h = body.scrollHeight; body.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" }).onfinish = () => (d.open = false);
      } else {
        d.open = true; const h = body.scrollHeight;
        body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" });
        slTrack("faq_open", { question: s.textContent.trim() });
      }
    });
  });

  /* =======================================================
     AUDIT FORM: validation, spam protection, submit, tracking
     ======================================================= */
  const form = $("#auditForm");
  if (form) {
    const ts = $("#f-ts"); ts.value = Date.now();
    const status = $("#formStatus"), btn = $("button[type=submit]", form), card = form.closest(".form-card");
    const rules = {
      name: v => v.trim().length >= 2 || "Please enter your name.",
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email, like you@brand.com.",
      phone: v => !v.trim() || /^[0-9+()\-\s]{7,20}$/.test(v.trim()) || "Use digits only, e.g. +91 98765 43210.",
      website: v => !v.trim() || /^[@\w][\w.\-/:?=&%#@]*$/.test(v.trim()) || "That doesn't look like a web address or handle.",
      service: v => !!v || "Choose the service you need most.",
      message: v => v.length <= 2000 || "Please keep it under 2,000 characters."
    };
    const check = el => {
      const name = el.name, rule = rules[name]; if (!rule) return true;
      const res = rule(el.value), f = el.closest(".field"), err = $("#e-" + name);
      const ok = res === true;
      f.classList.toggle("invalid", !ok); el.setAttribute("aria-invalid", String(!ok));
      if (err) { err.textContent = ok ? "" : res; el.setAttribute("aria-describedby", "e-" + name); }
      return ok;
    };
    $$("input,select,textarea", form).forEach(el => {
      el.addEventListener("blur", () => el.value && check(el));
      el.addEventListener("input", () => el.closest(".field")?.classList.contains("invalid") && check(el));
    });

    /* optional Cloudflare Turnstile (only when a public site key is configured) */
    let tsToken = "";
    if (CONFIG.TURNSTILE_SITE_KEY) {
      const box = $("#turnstile"); box.hidden = false;
      window.onTurnstileLoad = () => window.turnstile.render(box, { sitekey: CONFIG.TURNSTILE_SITE_KEY, callback: t => (tsToken = t), theme: "light" });
      loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit");
    }

    const cookie = n => (document.cookie.match("(^|;)\\s*" + n + "=([^;]+)") || [])[2] || "";
    form.addEventListener("submit", async e => {
      e.preventDefault();
      status.className = "form-status"; status.textContent = "";
      let ok = true, first = null;
      $$("input:not([type=hidden]):not(#f-company2):not([type=checkbox]),select,textarea", form).forEach(el => { if (!check(el)) { ok = false; first = first || el; } });
      const cons = $("#f-consent"), ce = $("#e-consent");
      if (!cons.checked) { ok = false; ce.textContent = "Please tick this box so we can send your audit."; first = first || cons; } else ce.textContent = "";
      if (!ok) { first.focus(); status.className = "form-status bad"; status.textContent = "A couple of fields need a quick fix."; return; }
      if (CONFIG.TURNSTILE_SITE_KEY && !tsToken) { status.className = "form-status bad"; status.textContent = "Please complete the quick security check."; return; }

      const data = Object.fromEntries(new FormData(form));
      const eventId = "lead-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      let attr = {}; try { attr = JSON.parse(store.get("sl-attr", sessionStorage) || "{}"); } catch {}
      const payload = { ...data, consent: true, turnstile: tsToken, event_id: eventId, page: location.href, attribution: attr, fbp: cookie("_fbp"), fbc: cookie("_fbc"), marketing_consent: !!(consent && consent.m) };

      btn.disabled = true; btn.classList.add("loading"); $(".label", btn).textContent = "Sending…";
      try {
        const r = await fetch(CONFIG.CONTACT_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || "Something went wrong.");
        slTrack("generate_lead", { service: data.service }, "Lead", eventId);
        card.classList.add("done"); $("#formDone").focus();
      } catch (err) {
        status.className = "form-status bad";
        status.innerHTML = `${esc(err.message && err.message.length < 140 ? err.message : "We couldn't send that just now.")} You can also email <a href="mailto:${CONFIG.CONTACT_EMAIL}" style="text-decoration:underline">${CONFIG.CONTACT_EMAIL}</a>.`;
      } finally {
        btn.disabled = false; btn.classList.remove("loading"); $(".label", btn).textContent = "Request my free audit";
      }
    });
  }

  /* =======================================================
     FOOTER WORDMARK: a spotlight follows your cursor
     ======================================================= */
  const big = $(".bigword");
  if (big) {
    const fill = $(".fill", big);
    const set = (x, y) => { fill.style.setProperty("--fx", x + "px"); fill.style.setProperty("--fy", y + "px"); };
    big.addEventListener("pointermove", e => { const r = big.getBoundingClientRect(); set(e.clientX - r.left, e.clientY - r.top); });
    if (!finePointer || reduce) { fill.style.maskImage = fill.style.webkitMaskImage = "none"; }
    else {
      /* idle sweep so it never sits still */
      let t = 0, hovering = false, on = false, W = big.offsetWidth, H = big.offsetHeight;
      big.addEventListener("pointerenter", () => (hovering = true)); big.addEventListener("pointerleave", () => (hovering = false));
      addEventListener("resize", () => { W = big.offsetWidth; H = big.offsetHeight; });
      const sweep = () => { if (!on) return; if (!hovering) { t += .006; set((Math.sin(t) * .5 + .5) * W, H * .5); } requestAnimationFrame(sweep); };
      new IntersectionObserver(([e]) => { const was = on; on = e.isIntersecting; if (on && !was) { W = big.offsetWidth; H = big.offsetHeight; requestAnimationFrame(sweep); } }).observe(big);
    }
  }

  /* 404 beam follows the pointer */
  const nfb = $(".nf-beam");
  if (nfb && !reduce) addEventListener("pointermove", e => nfb.style.setProperty("--bx", e.clientX + "px"));
})();
