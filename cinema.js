/* =========================================================
   SPOTLIGHT — cinema.js (homepage)
   1. Nano-assembly: thousands of particles swarm from scattered
      fragments into the Spotlight star, then the wordmark.
   2. 3D cinema: a vintage projector lights up, the beam travels
      over the seats onto a curved screen that plays the project
      (scene in theatre.js, loaded only when needed).
   3. Brand scanner: scans a public homepage (via /api/scan) with
      an AR-style environment scan and shows real findings.
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const visible = (el, cb, margin = "100px") => new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin }).observe(el);

  /* =======================================================
     1. NANO-ASSEMBLY
     ======================================================= */
  (function nano() {
    const sec = $("#nanotech"); if (!sec) return;
    const cv = $(".nano-canvas", sec), ctx = cv.getContext("2d");
    const steps = $$(".nano-steps li", sec), pctEl = $("[data-nano-pct]", sec), bar = $(".nano-progress i", sec);
    const COLORS = ["#FF8F3F", "#FFB25E", "#E2B451", "#F6E7C8", "#3FD6E3", "#FF8F3F", "#E2B451"];
    let W = 0, H = 0, dpr = 1, parts = [], on = false, raf = 0, mx = 0, my = 0, t0 = performance.now(), built = false;
    const count = () => (innerWidth < 700 ? 950 : innerWidth < 1200 ? 1500 : 1900);

    function sample(draw) {
      const oc = document.createElement("canvas"); oc.width = W; oc.height = H;
      const o = oc.getContext("2d"); o.fillStyle = "#fff"; draw(o);
      const d = o.getImageData(0, 0, W, H).data, pts = [];
      const n = count(), step = 2;
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 120) pts.push([x + Math.random() * step, y + Math.random() * step]);
      for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
      return pts.length ? pts.slice(0, n) : [[W / 2, H / 2]];
    }
    function build() {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = W / 2, cy = H * .44, S = Math.min(W, H) * (W < 700 ? .3 : .27);
      const star = sample(o => {
        o.beginPath(); o.moveTo(cx, cy - S);
        o.quadraticCurveTo(cx + S * .14, cy - S * .14, cx + S, cy); o.quadraticCurveTo(cx + S * .14, cy + S * .14, cx, cy + S);
        o.quadraticCurveTo(cx - S * .14, cy + S * .14, cx - S, cy); o.quadraticCurveTo(cx - S * .14, cy - S * .14, cx, cy - S); o.fill();
      });
      const fs = Math.min(W * (W < 700 ? .118 : .105), 150);
      const word = sample(o => {
        o.font = `500 ${fs}px Cinzel, "Trajan Pro", Georgia, serif`; o.textBaseline = "middle";
        const txt = "SPOTLIGHT", sp = fs * .16;
        const widths = [...txt].map(c => o.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) + sp * (txt.length - 1);
        let x = cx - total / 2; [...txt].forEach((c, i) => { o.fillText(c, x, cy); x += widths[i] + sp; });
        o.fillRect(cx - total * .38, cy + fs * .72, total * .76, Math.max(2, fs * .03));
      });
      const n = count();
      parts = Array.from({ length: n }, (_, i) => {
        const fl = Math.random() < .78;
        const sy = fl ? H * (.66 + .34 * Math.pow(Math.random(), .8)) : H * Math.random() * .62;
        const z = fl ? clamp((sy - H * .62) / (H * .38)) * .85 + .15 : Math.random() * .5;
        const s = star[i % star.length], w = word[i % word.length];
        return { sx: Math.random() * W * 1.3 - W * .15, sy, z, ax: s[0], ay: s[1], bx: w[0], by: w[1], d: Math.random() * .35, c: COLORS[i % COLORS.length], ph: Math.random() * 6.28, sz: 1 + Math.random() * 1.6, g: Math.random() < .14 };
      });
      built = true;
      if (reduce) frame(performance.now(), 1);
    }
    function progress() {
      const r = sec.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    }
    function frame(now, forceP) {
      if (!built) return;
      const t = (now - t0) / 1000, p = forceP ?? progress();
      const a = ease(clamp((p - .1) / .32)), b = ease(clamp((p - .52) / .3));
      ctx.clearRect(0, 0, W, H);
      // floor haze
      const g = ctx.createLinearGradient(0, H * .6, 0, H);
      g.addColorStop(0, "rgba(12,58,68,0)"); g.addColorStop(1, "rgba(12,58,68,.45)");
      ctx.fillStyle = g; ctx.fillRect(0, H * .6, W, H * .4);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        const ai = ease(clamp(a * 1.35 - q.d)), bi = ease(clamp(b * 1.35 - q.d));
        let x = lerp(q.sx, q.ax, ai), y = lerp(q.sy, q.ay, ai);
        x = lerp(x, q.bx, bi); y = lerp(y, q.by, bi);
        const sw = Math.sin(Math.PI * ai) * (1 - bi) + Math.sin(Math.PI * bi);
        x += Math.cos(t * .9 + q.ph) * 34 * sw; y += Math.sin(t * 1.1 + q.ph * 1.7) * 30 * sw - 50 * sw * (1 - q.z);
        if (ai < .02) { x += Math.sin(t * .4 + q.ph) * 2; y += Math.cos(t * .5 + q.ph) * 1.2; }
        const depth = lerp(q.z, .6, Math.max(ai, bi));
        x += mx * 22 * depth; y += my * 14 * depth;
        const s = q.sz * (.7 + depth * 1.7) * (W < 700 ? .85 : 1) * (1 + bi * .35);
        const assembled = Math.max(ai, bi);
        const shimmer = assembled > .95 ? .75 + .25 * Math.sin(t * 3 + q.ph) : 1;
        ctx.globalAlpha = (.35 + .55 * (assembled * .6 + depth * .4)) * shimmer;
        ctx.fillStyle = assembled > .6 && i % 3 ? "#F2C978" : q.c;
        ctx.fillRect(x, y, s, s);
        if (q.g) { ctx.globalAlpha *= .18; ctx.fillRect(x - s * 1.5, y - s * 1.5, s * 4, s * 4); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const stage = p < .36 ? 0 : p < .66 ? 1 : 2;
      steps.forEach((s, i) => s.classList.toggle("on", i === stage));
      if (pctEl) pctEl.textContent = String(Math.round(((a + b) / 2) * 100)).padStart(3, "0") + "%";
      if (bar) bar.style.transform = `scaleX(${p})`;
      if (on && forceP === undefined) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (on || reduce) return; on = true; raf = requestAnimationFrame(frame); };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    visible(sec, v => (v ? start() : stop()), "50px");
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 200); });
    if (fine && !reduce) sec.addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
    (document.fonts && document.fonts.load ? document.fonts.load('500 80px Cinzel').catch(() => {}) : Promise.resolve()).then(build);
    if (reduce) { steps.forEach(s => s.classList.add("on")); }
  })();

  /* =======================================================
     2. 3D CINEMA (projector → beam → screen) + PROJECT VIEW
     ======================================================= */
  /* ---------- project view (lightbox) ---------- */
  const projectView = (function () {
    const view = $("#pview"); if (!view) return null;
    const photos = $$("[data-photo-src]", view).map(n => ({ src: n.dataset.photoSrc, alt: n.dataset.photoAlt, cap: n.dataset.photoCap }));
    const img = $(".pv-img", view), cap = $(".pv-cap", view), count = $(".pv-count", view), thumbs = $(".pv-thumbs", view);
    let built = false, cur = 0, lastFocus = null, onClose = null;
    function build() {
      if (built) return; built = true;
      thumbs.innerHTML = photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="Photo ${i + 1}" style="--x:${i % 4};--y:${Math.floor(i / 4)}"></button>`).join("");
    }
    function show(i) {
      cur = (i + photos.length) % photos.length; const p = photos[cur];
      img.classList.remove("in"); void img.offsetWidth;
      img.src = p.src; img.alt = p.alt; cap.textContent = p.cap; count.textContent = `${String(cur + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
      img.classList.add("in");
      $$("button", thumbs).forEach((b, k) => b.setAttribute("aria-current", String(k === cur)));
      const nx = new Image(); nx.src = photos[(cur + 1) % photos.length].src;
    }
    function open(i, closeCb) {
      build(); lastFocus = document.activeElement; onClose = closeCb || null;
      view.hidden = false; requestAnimationFrame(() => view.classList.add("open"));
      document.documentElement.style.overflow = "hidden"; show(i); $(".pv-close", view).focus();
      if (window.slTrack) slTrack("project_view", { project: "BiggTime Entertainment" }, "ViewContent");
    }
    function close() {
      view.classList.remove("open"); document.documentElement.style.overflow = "";
      setTimeout(() => (view.hidden = true), 450); if (lastFocus) lastFocus.focus({ preventScroll: true });
      if (onClose) onClose(cur);
    }
    $(".pv-close", view).addEventListener("click", close);
    $(".pv-prev", view).addEventListener("click", () => show(cur - 1));
    $(".pv-next", view).addEventListener("click", () => show(cur + 1));
    thumbs.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) show(+b.dataset.i); });
    view.addEventListener("click", e => { if (e.target === view) close(); });
    addEventListener("keydown", e => {
      if (view.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(cur + 1);
      if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "Tab") { const f = $$("button,a[href]", view).filter(b => b.offsetParent); const k = f.indexOf(document.activeElement); e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    });
    let sx = null; view.addEventListener("touchstart", e => (sx = e.touches[0].clientX), { passive: true });
    view.addEventListener("touchend", e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
    return { open, photos };
  })();

  /* ---------- the cinema ---------- */
  (function theatre() {
    const sec = $("[data-theatre]"); if (!sec) return;
    const canvas = $(".th-canvas", sec), flat = $(".th-flat img", sec), photos = projectView ? projectView.photos : [];
    const N = photos.length;
    const capEl = $("[data-th-cap]", sec), countEl = $("[data-th-count]", sec), live = $("[data-th-live]", sec);
    const thumbs = $$("[data-th-i]", sec), pauseBtn = $("[data-th-pause]", sec);
    const phaseEl = $("[data-th-phase]", sec), tcEl = $("[data-th-tc]", sec), phases = $$(".th-phases li", sec);
    let T = null, cur = 0, ready = false, paused = false, hovering = false, timer = 0, inView = false, p = 0, loading = false;
    const pinned = () => sec.offsetHeight > innerHeight * 1.2;

    function progress() {
      if (!pinned()) return 1;
      const r = sec.getBoundingClientRect();
      return clamp(-r.top / (r.height - innerHeight));
    }
    function setPhase(v) {
      const k = v < .2 ? 0 : v < .62 ? 1 : 2;
      if (sec.dataset.phase === String(k)) return;
      sec.dataset.phase = k;
      document.documentElement.classList.toggle("th-screen", k === 2 && inView && !reduce);
      phases.forEach((li, i) => li.classList.toggle("on", i <= k));
      phaseEl.textContent = ["Lamp warming", "Projecting", "Now showing"][k];
    }
    function show(i, announce) {
      cur = (i + N) % N; const ph = photos[cur];
      capEl.textContent = ph.cap; countEl.textContent = `${String(cur + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
      thumbs.forEach((b, k) => b.setAttribute("aria-current", String(k === cur)));
      const tb = thumbs[cur]; if (tb && sec.dataset.phase === "2") { const s = tb.closest("ol"); s.scrollTo({ left: tb.offsetLeft - s.clientWidth / 2 + tb.offsetWidth / 2, behavior: reduce ? "auto" : "smooth" }); }
      if (announce) live.textContent = `Photo ${cur + 1} of ${N}: ${ph.alt}`;
      if (T) T.show(cur); else { flat.src = ph.src; flat.alt = ""; }
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (paused || hovering || !ready || !inView || reduce) return;
      timer = setTimeout(() => show(cur + 1), 5200);
    }
    function onReady() { if (ready) return; ready = true; sec.classList.add("is-showing"); show(0); }

    // controls
    $("[data-th-prev]", sec).addEventListener("click", () => { onReady(); show(cur - 1, true); });
    $("[data-th-next]", sec).addEventListener("click", () => { onReady(); show(cur + 1, true); });
    thumbs.forEach(b => b.addEventListener("click", () => { onReady(); show(+b.dataset.thI, true); }));
    pauseBtn.addEventListener("click", () => {
      paused = !paused; pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow"); schedule();
    });
    const ctr = $("[data-th-controls]", sec);
    ctr.addEventListener("pointerenter", () => { hovering = true; schedule(); });
    ctr.addEventListener("pointerleave", () => { hovering = false; schedule(); });
    ctr.addEventListener("focusin", () => { hovering = true; schedule(); });
    ctr.addEventListener("focusout", () => { hovering = false; schedule(); });
    $$("[data-th-open]", sec).forEach(b => b.addEventListener("click", () => projectView && projectView.open(ready ? cur : 0, i => { if (ready && i !== cur) show(i); })));
    $("[data-th-roll]", sec).addEventListener("click", () => {
      const end = sec.getBoundingClientRect().top + scrollY + sec.offsetHeight - innerHeight;
      if (!pinned()) { onReady(); return; }
      scrollTo({ top: end - innerHeight * .05, behavior: reduce ? "auto" : "smooth" });
    });

    // render loop driver: reads scroll progress each frame (no scroll handlers)
    let raf = 0, tc0 = 0, lastSec = -1;
    function tick(now) {
      p = progress(); setPhase(p);
      if (T) T.setProgress(p);
      else if (p > .55) onReady();
      if (!tc0) tc0 = now;
      const s = Math.floor((now - tc0) / 1000);
      if (s !== lastSec) { lastSec = s; tcEl.textContent = `00:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
      if (inView) raf = requestAnimationFrame(tick);
    }

    // decide quality and load the 3D scene shortly before the section arrives
    const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
    const lite = matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    function fallback() { sec.classList.add("no-3d"); T = null; }
    function load() {
      sec.classList.add("near");
      if (loading || !gl || reduce) { if (!gl || reduce) fallback(); return; }
      loading = true;
      if (document.fonts && document.fonts.load) ['500 34px Cinzel', '600 100px "Cormorant Garamond"', '500 26px Manrope'].forEach(f => document.fonts.load(f).catch(() => {}));
      import("/theatre.js").then(mod => new Promise(res => (window.requestIdleCallback || setTimeout)(() => res(mod), { timeout: 600 }))).then(mod => {
        const t = mod.mountTheatre(canvas, {
          lite, photos: photos.map(x => x.src),
          onShowReady: onReady,
          onScreenClick: i => projectView && projectView.open(i, j => { if (j !== cur) show(j); }),
          onHover: h => { canvas.style.cursor = h ? "pointer" : ""; if (window.SLCursor) SLCursor(h === "screen" ? "View" : h === "projector" ? "Spin" : ""); },
          onFirstFrame: () => sec.classList.add("is-3d"),
          onLost: fallback
        });
        return t.ready.then(() => {
          T = t; T.setProgress(progress(), true); if (/thdebug/.test(location.search)) window.__T = T;
          if (ready) T.show(cur);
          if (inView) T.start(); else T.renderOnce();
        });
      }).catch(fallback);
    }
    if (reduce) sec.classList.add("is-static");
    new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: "120% 0px" }).observe(sec);
    visible(sec, v => {
      inView = v;
      if (v) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); if (T && !reduce) T.start(); schedule(); }
      else { cancelAnimationFrame(raf); if (T) T.stop(); clearTimeout(timer); if (window.SLCursor) SLCursor(""); document.documentElement.classList.remove("th-screen"); delete sec.dataset.phase; }
    }, "0px");
    setPhase(reduce ? 1 : 0);
    if (reduce) onReady();
  })();

  /* =======================================================
     3. BRAND SCANNER
     ======================================================= */
  (function scanner() {
    const form = $("#scanForm"); if (!form) return;
    const sec = form.closest("section"), hud = $(".scan-hud", sec), log = $(".scan-log", sec), res = $(".scan-result", sec), urlLabel = $("[data-scan-url]", sec);
    const boxes = $$(".sv-box", sec);
    const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
    const say = async (txt, cls = "") => { const li = document.createElement("li"); li.className = cls; li.textContent = txt; log.appendChild(li); log.scrollTop = log.scrollHeight; await sleep(260); };

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("input", form), raw = input.value.trim();
      const err = $(".scan-err", form); err.textContent = "";
      if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(raw)) { err.textContent = "Enter a website address, like yourbrand.com"; input.focus(); return; }
      const btn = $("button", form); btn.disabled = true; btn.querySelector("span").textContent = "Scanning…";
      res.hidden = true; log.innerHTML = ""; hud.classList.remove("done"); hud.classList.add("scanning");
      boxes.forEach(b => b.classList.remove("ok", "bad", "hit"));
      if (urlLabel) urlLabel.textContent = raw.replace(/^https?:\/\//, "");
      const job = fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: raw }) })
        .then(r => r.json().then(j => ({ ok: r.ok, j }))).catch(() => ({ ok: false, j: { error: "The scanner couldn't connect. Please try again." } }));
      await say("› Initialising environment scan");
      await say("› Resolving host " + raw.replace(/^https?:\/\//, "").split("/")[0]);
      await say("› Fetching public homepage");
      for (const b of boxes) { b.classList.add("hit"); await sleep(170); }
      await say("› Reading identity signals: title, meta, social cards");
      await say("› Detecting pixels, tags and platform");
      await say("› Checking AI-search visibility");
      const { ok, j } = await job;
      hud.classList.remove("scanning");
      btn.disabled = false; btn.querySelector("span").textContent = "Scan again";
      if (!ok || j.error) { await say("× " + (j.error || "Scan failed."), "bad"); return; }
      await say(`✓ Brand identified: ${j.brand.name}`, "ok");
      const map = { identity: "title", search: "description", social: "og", ads: "pixel", ai: "ai", speed: "speed" };
      boxes.forEach(b => { const k = map[b.dataset.box]; const c = j.checks.find(x => x.id === k); if (c) b.classList.add(c.pass ? "ok" : "bad"); });
      hud.classList.add("done");
      render(j);
      if (window.slTrack) slTrack("brand_scan", { score: j.score });
    });

    function render(j) {
      const passed = j.checks.filter(c => c.pass).length, total = j.checks.length, pct = Math.round(passed / total * 100);
      const groups = {};
      j.checks.forEach(c => (groups[c.group] = groups[c.group] || []).push(c));
      res.innerHTML = `
        <div class="sr-id">
          ${j.brand.icon ? `<img class="sr-ico" src="${esc(j.brand.icon)}" alt="" width="40" height="40" loading="lazy">` : ""}
          <div><p class="sr-k">Brand identified</p><h3>${esc(j.brand.name)}</h3><p class="sr-u">${esc(j.finalUrl)}</p></div>
          ${j.brand.themeColor ? `<span class="sr-sw" style="background:${esc(j.brand.themeColor)}" title="Brand colour ${esc(j.brand.themeColor)}"></span>` : ""}
          <div class="sr-score" style="--p:${pct}"><b>${passed}/${total}</b><small>checks passed</small></div>
        </div>
        ${j.platform ? `<p class="sr-meta">Built with <b>${esc(j.platform)}</b> · Loaded in <b>${(j.timeMs / 1000).toFixed(1)} s</b>${j.social.length ? ` · Social profiles found: <b>${j.social.map(esc).join(", ")}</b>` : ""}</p>` : `<p class="sr-meta">Loaded in <b>${(j.timeMs / 1000).toFixed(1)} s</b>${j.social.length ? ` · Social profiles found: <b>${j.social.map(esc).join(", ")}</b>` : ""}</p>`}
        <div class="sr-groups">${Object.entries(groups).map(([g, cs]) => `<div class="sr-g"><h4>${esc(g)}</h4><ul>${cs.map(c => `<li class="${c.pass ? "ok" : "bad"}"><i aria-hidden="true">${c.pass ? "✓" : "!"}</i><span><b>${esc(c.label)}</b>${c.detail ? `<small>${esc(c.detail)}</small>` : ""}</span><span class="sr-only">${c.pass ? "passed" : "needs work"}</span></li>`).join("")}</ul></div>`).join("")}</div>
        <div class="sr-cta"><p>This is a quick automated check of one page. The free growth audit goes much deeper: ads, competitors, content and your first three moves.</p><a href="#audit" class="btn btn-gold" data-cta="scanner" data-prefill="${esc(j.finalUrl)}">Get the full audit for ${esc(j.brand.name)}</a></div>`;
      res.hidden = false;
      const ico = res.querySelector(".sr-ico"); if (ico) ico.addEventListener("error", () => ico.remove());
      res.querySelector("[data-prefill]").addEventListener("click", ev => { const w = $("#f-website"); if (w) w.value = ev.currentTarget.dataset.prefill; });
      res.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  })();
})();
