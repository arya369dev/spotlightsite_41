/* =========================================================
   SPOTLIGHT — book.js  (only on /services)
   A 3D page-turning catalogue: drag, swipe, click, keyboard.
   Two-page spreads on wide screens, single pages on phones.
   Without JavaScript the pages simply show as a readable list.
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const book = $("[data-book]"), wrap = $("[data-book-wrap]");
  if (!book) return;

  const pages = $$(".page", book);
  const N = pages.length;                 // 32 pages
  const S = Math.ceil(N / 2);             // 16 sheets
  const status = $("[data-bk-status]"), bar = $(".bk-progress i");
  const labelOf = i => (pages[i].getAttribute("aria-label") || "").replace(/^Page \d+ of \d+: /, "");
  let mode = "", sheets = [], k = 0, p = 0, busy = 0;

  /* ---------- tiny page-turn sound (WebAudio, only after the visitor interacts) ---------- */
  let actx = null, soundOn = true;
  function rustle() {
    if (!soundOn || reduce) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const len = .28, buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * (0.5 + 0.5 * Math.sin(t * 40)); }
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = .7;
      const g = actx.createGain(); g.gain.value = .07;
      src.connect(f).connect(g).connect(actx.destination); src.start();
    } catch {}
  }

  /* ---------- layout ---------- */
  function build() {
    const want = innerWidth >= 900 ? "spread" : "single";
    if (want === mode) return;
    mode = want;
    // unwrap everything back to a flat list
    pages.forEach(pg => { pg.classList.remove("bface", "bfront", "bback", "is-on", "gone"); pg.style.zIndex = ""; book.appendChild(pg); });
    sheets.forEach(s => s.remove()); sheets = [];
    book.classList.toggle("is-spread", mode === "spread");
    book.classList.toggle("is-single", mode === "single");
    if (mode === "spread") {
      for (let i = 0; i < S; i++) {
        const sh = document.createElement("div"); sh.className = "sheet";
        const f = pages[2 * i], b = pages[2 * i + 1];
        f.classList.add("bface", "bfront"); sh.appendChild(f);
        if (b) { b.classList.add("bface", "bback"); sh.appendChild(b); }
        book.appendChild(sh); sheets.push(sh);
      }
    }
    book.classList.add("is-ready");
    show(p, true);
  }

  const kFor = pg => (pg % 2 === 0 ? pg / 2 : (pg + 1) / 2);

  /* ---------- render ---------- */
  function show(target, instant) {
    target = Math.max(0, Math.min(N - 1, target));
    const prevK = k, prevP = p;
    p = target;
    if (instant) { book.classList.add("instant"); requestAnimationFrame(() => requestAnimationFrame(() => book.classList.remove("instant"))); }
    if (mode === "spread") {
      k = kFor(p);
      const dir = k > prevK ? 1 : -1, span = Math.abs(k - prevK);
      sheets.forEach((s, i) => {
        const flipped = i < k;
        const moving = (dir > 0 && i >= prevK && i < k) || (dir < 0 && i >= k && i < prevK);
        const order = dir > 0 ? i - prevK : prevK - 1 - i;
        const dl = instant || !moving ? 0 : Math.min(order, 12) * (span > 3 ? 70 : 120);
        s.style.transitionDelay = dl + "ms"; s.style.setProperty("--dl", dl + "ms");
        s.classList.toggle("flipped", flipped);
        s.style.zIndex = flipped ? i + 1 : S - i + (moving ? S : 0);
        s.style.setProperty("--drag", "0deg");
      });
      // after the flip settles, normal stacking
      clearTimeout(busy);
      busy = setTimeout(() => sheets.forEach((s, i) => { s.style.zIndex = i < k ? i + 1 : S - i; }), instant ? 0 : 1000 + span * 120);
      book.style.setProperty("--shift", k === 0 ? "-25%" : k === S ? "25%" : "0%");
      const on = [2 * k - 1, 2 * k].filter(i => i >= 0 && i < N);
      pages.forEach((pg, i) => { const vis = on.includes(i); pg.classList.toggle("is-on", vis); pg.inert = !vis; });
      const txt = on.length === 2 ? `Pages ${on[0] + 1}–${on[1] + 1} of ${N} · ${labelOf(on[1])}` : `Page ${on[0] + 1} of ${N} · ${labelOf(on[0])}`;
      if (status) status.textContent = txt;
      if (bar) bar.style.transform = `scaleX(${k / S})`;
      if (!instant && k !== prevK) rustle();
    } else {
      pages.forEach((pg, i) => {
        pg.classList.toggle("gone", i < p);
        pg.classList.toggle("is-on", i === p);
        pg.inert = i !== p;
        pg.style.zIndex = i < p ? i : N - i + (i === p ? N : 0);
      });
      if (status) status.textContent = `Page ${p + 1} of ${N} · ${labelOf(p)}`;
      if (bar) bar.style.transform = `scaleX(${p / (N - 1)})`;
      if (!instant && p !== prevP) rustle();
    }
    $$(".bk-tabs [data-goto]").forEach(b => {
      const g = +b.dataset.goto, nextG = [0, 3, 9, 28, 31, 99][[0, 3, 9, 28, 31].indexOf(g) + 1];
      b.setAttribute("aria-current", p >= g && p < nextG ? "true" : "false");
    });
  }

  const next = () => (mode === "spread" ? show(Math.min(N - 1, 2 * Math.min(S, k + 1) - (k + 1 === S ? 1 : 0))) : show(p + 1));
  const prev = () => (mode === "spread" ? show(Math.max(0, 2 * (k - 1))) : show(p - 1));

  /* ---------- controls ---------- */
  $("[data-next]").addEventListener("click", next);
  $("[data-prev]").addEventListener("click", prev);
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-goto]"); if (!g) return;
    show(+g.dataset.goto);
    wrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  });
  let inView = false;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: .35 }).observe(wrap);
  addEventListener("keydown", e => {
    if (!inView || /input|textarea|select/i.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    if (e.key === "Home") { e.preventDefault(); show(0); }
    if (e.key === "End") { e.preventDefault(); show(N - 1); }
  });

  /* drag to turn (spread) / swipe (single) / click a page edge */
  let down = null;
  wrap.addEventListener("pointerdown", e => {
    if (e.target.closest("a,button")) return;
    down = { x: e.clientX, y: e.clientY, t: Date.now(), sheet: null };
    if (mode === "spread") {
      const r = wrap.getBoundingClientRect(), right = e.clientX > r.left + r.width / 2;
      const idx = right ? k : k - 1;
      if (sheets[idx]) { down.sheet = sheets[idx]; down.right = right; down.sheet.classList.add("dragging"); down.sheet.style.zIndex = 99; }
    }
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", e => {
    if (!down || !down.sheet) return;
    const r = wrap.getBoundingClientRect(), dx = e.clientX - down.x;
    const prog = Math.max(0, Math.min(1, (down.right ? -dx : dx) / (r.width / 2)));
    down.sheet.style.setProperty("--drag", `${(down.right ? -1 : 1) * prog * 160}deg`);
    const past = down.right ? prog > .56 : prog < .44;   // which face is toward the viewer
    down.sheet.classList.toggle("past", past); down.sheet.classList.toggle("before", !past);
  });
  const end = e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y, quick = Date.now() - down.t < 300;
    if (down.sheet) { down.sheet.classList.remove("dragging", "past", "before"); down.sheet.style.setProperty("--drag", "0deg"); }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); }
    else if (quick && Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      const r = wrap.getBoundingClientRect();
      (e.clientX > r.left + r.width / 2) ? next() : prev();
    } else show(p, true);
    down = null;
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);

  /* glossy light follows the cursor across the paper */
  if (!reduce && matchMedia("(hover: hover)").matches) {
    wrap.addEventListener("pointermove", e => {
      const r = wrap.getBoundingClientRect();
      wrap.style.setProperty("--lx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      wrap.style.setProperty("--ly", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      wrap.style.setProperty("--tx", (((e.clientY - r.top) / r.height - .5) * -6).toFixed(2) + "deg");
      wrap.style.setProperty("--ty", (((e.clientX - r.left) / r.width - .5) * 8).toFixed(2) + "deg");
    });
    wrap.addEventListener("pointerleave", () => { wrap.style.setProperty("--tx", "0deg"); wrap.style.setProperty("--ty", "0deg"); });
  }

  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });
  build();

  /* the book opens itself once, the first time it comes into view */
  if (!reduce) {
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return; o.disconnect();
      setTimeout(() => { if (p === 0) { soundOn = false; show(mode === "spread" ? 2 : 1); soundOn = true; } }, 1400);
    }, { threshold: .5 }).observe(wrap);
  }

  /* ---------- "All 19 services" filter ---------- */
  const chips = $$(".fchip"), cards = $$(".scard");
  chips.forEach(c => c.addEventListener("click", () => {
    const f = c.dataset.filter;
    chips.forEach(x => x.setAttribute("aria-pressed", String(x === c)));
    cards.forEach((card, i) => {
      const on = f === "all" || card.dataset.pillar === f;
      card.hidden = !on;
      if (on) { card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop"); card.classList.add("in"); }
    });
  }));

  /* HUD readout on the stage */
  const hud = $("[data-hud-read]");
  if (hud && !reduce) {
    const msgs = ["SYS · CATALOGUE ONLINE", "PILLARS · 06 LOADED", "SERVICES · 19 INDEXED", "AI · ASSIST MODE", "HUMAN · APPROVAL ON", "SIGNAL · STRONG"];
    let m = 0; setInterval(() => { hud.textContent = msgs[++m % msgs.length]; }, 2600);
  }
})();
