/* =========================================================
   /api/content  —  Spotlight Insights engine (Vercel function)
   One function serves, via rewrites in vercel.json:
     /insights            -> ?route=insights   (hub page, server-rendered)
     /insights/:slug      -> ?route=post       (article / news / event page)
     /api/content?route=posts                  (JSON for the homepage)
     /sitemap.xml         -> ?route=sitemap
     /feed.xml            -> ?route=feed       (RSS for readers + n8n)
     /llms-full.txt       -> ?route=llms       (full index for AI crawlers)
   Source of truth: /posts.json. Only status "published" is ever shown.
   ========================================================= */
"use strict";
const data = require("../posts.json");

const SITE = (process.env.SITE_URL || "https://spotlight.agency").replace(/\/$/, "");
const BRAND = "Spotlight";
const TYPES = { blog: "Blog", news: "News", event: "Events" };
const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/services", priority: "0.9", changefreq: "monthly" },
  { loc: "/insights", priority: "0.8", changefreq: "daily" },
  { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms", priority: "0.3", changefreq: "yearly" }
];

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const xml = esc;
const json = o => JSON.stringify(o).replace(/</g, "\\u003c");
const isPublished = p => p && p.status === "published" && p.slug && p.title;
const published = () => (data.posts || []).filter(isPublished);
const sortPosts = list => list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
const fmtDate = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const fmtTime = d => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const url = p => `${SITE}/insights/${encodeURIComponent(p.slug)}`;
const safeHref = h => (/^(https?:|mailto:|\/|#)/i.test(String(h || "")) ? String(h) : "#");

/* Small, safe Markdown -> HTML (escapes everything first, so AI-written text can't inject HTML) */
function md(src) {
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, href) => {
      const h = safeHref(href.replace(/&amp;/g, "&"));
      const ext = /^https?:/i.test(h) && !h.startsWith(SITE);
      return `<a href="${esc(h)}"${ext ? ' rel="noopener" target="_blank"' : ""}>${txt}</a>`;
    });
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  let out = "", list = null, para = [];
  const flushP = () => { if (para.length) { out += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const flushL = () => { if (list) { out += `<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join("")}</${list.t}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if (!l) { flushP(); flushL(); continue; }
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) { flushP(); flushL(); const n = m[1].length; out += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { flushP(); flushL(); out += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = l.match(/^[-*]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^\d+\.\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out;
}
const plain = s => String(s || "").replace(/[#>*`_\[\]()]/g, "").replace(/\s+/g, " ").trim();

/* ---------- page shell (matches the static pages) ---------- */
const ICON = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6DA8E"/><stop offset="1" stop-color="#C48E26"/></linearGradient><symbol id="i-star" viewBox="0 0 24 24"><path fill="url(#g-gold)" d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0z"/></symbol></defs></svg>`;

function shell({ title, description, path, image, type = "website", jsonld = [], body, extraHead = "" }) {
  const canonical = SITE + path;
  const img = image ? (image.startsWith("http") ? image : SITE + image) : `${SITE}/og-image.jpg`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#FBFAFD">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:locale" content="en_IN">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="Spotlight Insights" href="/feed.xml">
<link rel="preload" as="font" type="font/woff2" href="/font-manrope.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/font-cormorant-500.woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
<script src="/main.js" defer></script>
<script src="/spot-ai.js" defer></script>
${jsonld.map(j => `<script type="application/ld+json">${json(j)}</script>`).join("\n")}
${extraHead}
</head>
<body class="page-light">
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<div class="spot" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"></div>
<div class="cursor-ring" aria-hidden="true"><span></span></div>
<noscript><style>[data-reveal]{opacity:1;transform:none;clip-path:none}[data-split] .w>span{transform:none}</style></noscript>
${HEADER(path)}
<main id="main">
${body}
</main>
${FOOTER}
${CONSENT}
${ICON}
</body>
</html>`;
}

const HEADER = path => `<header class="site-header" id="header">
  <div class="wrap nav">
    <a href="/" class="brand"><img src="/favicon-180.png" alt="" width="40" height="40"><span class="brand-word">SPOTLIGHT<small>Where marketing meets intelligence</small></span></a>
    <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu"><i></i><i></i><i></i></button>
    <nav class="menu" id="menu" aria-label="Main">
      <a href="/services"${path.startsWith("/services") ? ' aria-current="page"' : ""}>Services</a>
      <a href="/#projects">Projects</a>
      <a href="/#scanner">Brand scan</a>
      <a href="/#ask">SPOT·AI</a>
      <a href="/insights"${path.startsWith("/insights") ? ' aria-current="page"' : ""}>Insights</a>
      <a href="/#faq">FAQ</a>
      <a href="/#audit" class="btn btn-gold magnetic" data-cta="nav">Free growth audit</a>
    </nav>
  </div>
</header>`;

const FOOTER = `<footer class="site-footer" id="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a href="/" class="brand"><img src="/favicon-180.png" alt="" width="40" height="40" loading="lazy"><span class="brand-word">SPOTLIGHT</span></a>
        <p>An AI-powered media and digital marketing agency for brands ready to be seen.</p>
        <p class="tag">WHERE MARKETING MEETS INTELLIGENCE.</p>
      </div>
      <div><h4>Explore</h4><a href="/services">Services catalogue</a><a href="/#projects">Featured project</a><a href="/#scanner">Brand scanner</a><a href="/#ask">Ask SPOT·AI</a><a href="/#intelligence">Intelligence</a><a href="/#process">Process</a><a href="/insights">Insights</a></div>
      <div><h4>Company</h4><a href="/#faq">FAQ</a><a href="/#audit">Free growth audit</a><a href="mailto:hello@spotlight.agency">hello@spotlight.agency</a></div>
      <div><h4>Legal</h4><a href="/privacy">Privacy policy</a><a href="/terms">Terms &amp; conditions</a><button type="button" data-open-consent>Cookie settings</button></div>
    </div>
    <div class="bigword" aria-hidden="true"><span class="outline">SPOTLIGHT</span><span class="fill">SPOTLIGHT</span></div>
    <div class="copyright"><span>© <span data-year>2026</span> Spotlight. All rights reserved.</span><span>Made to be seen.</span></div>
  </div>
</footer>`;

const CONSENT = `<div class="consent" id="consent" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-desc">
  <h2 id="consent-title"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"/></svg>Cookies, with your OK</h2>
  <p id="consent-desc">We'd like to use analytics and advertising cookies to understand visits and measure our ads. Essential cookies keep the site working. Read our <a href="/privacy#cookies">privacy policy</a>.</p>
  <div class="consent-opts">
    <div class="opt-row"><div><b>Essential</b><span>Required for the site to work</span></div><label class="switch"><input type="checkbox" checked disabled aria-label="Essential cookies, always on"><i></i></label></div>
    <div class="opt-row"><div><b>Analytics</b><span>Google Analytics: anonymous visit stats</span></div><label class="switch"><input type="checkbox" id="c-analytics" aria-label="Analytics cookies"><i></i></label></div>
    <div class="opt-row"><div><b>Marketing</b><span>Meta Pixel: measure and improve our ads</span></div><label class="switch"><input type="checkbox" id="c-marketing" aria-label="Marketing cookies"><i></i></label></div>
  </div>
  <div class="consent-actions">
    <button type="button" class="btn btn-line" data-consent="reject">Reject all</button>
    <button type="button" class="btn btn-line" data-consent="custom">Choose</button>
    <button type="button" class="btn btn-ink" data-consent="accept">Accept all</button>
  </div>
</div>`;

const GEL = { blog: "var(--lilac)", news: "var(--sky)", event: "var(--rose)" };
const LABEL = { blog: "Blog", news: "News", event: "Event" };

function cardHTML(p, i) {
  const ev = p.type === "event" && p.event && p.event.start;
  const d = ev ? new Date(p.event.start) : null;
  const cover = p.cover
    ? `<img src="${esc(p.cover)}" alt="${esc(p.coverAlt || "")}" loading="lazy" decoding="async" width="640" height="360">`
    : `<span class="glyph" aria-hidden="true">${esc(p.title.charAt(0))}</span>`;
  const day = ev ? d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }) : "";
  const mon = ev ? d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }) : "";
  return `<article class="post" style="--gel:${GEL[p.type] || "var(--mint)"};--i:${i}">
    <div class="post-cover">${cover}<span class="post-type">${LABEL[p.type] || "Story"}</span>${ev ? `<span class="post-date"><b>${day}</b><small>${mon}</small></span>` : ""}</div>
    <div class="post-body"><h3><a href="/insights/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p>
    <div class="post-meta"><span>${ev ? esc(p.event.location || "Online") : `<time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>`}</span>${p.readingTime ? `<span>${esc(p.readingTime)} min read</span>` : ""}</div></div></article>`;
}

/* ---------- routes ---------- */
function routePosts(q) {
  const type = TYPES[q.type] ? q.type : "all";
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 12, 1), 50);
  let list = sortPosts(published());
  if (type !== "all") list = list.filter(p => p.type === type);
  return list.slice(0, limit).map(p => ({
    slug: p.slug, type: p.type, title: p.title, excerpt: p.excerpt, date: p.date,
    cover: p.cover || "", coverAlt: p.coverAlt || "", readingTime: p.readingTime || null,
    tags: p.tags || [], event: p.type === "event" ? p.event || null : null, url: url(p)
  }));
}

function routeInsights(q) {
  const type = TYPES[q.type] ? q.type : "all";
  const all = sortPosts(published());
  const list = type === "all" ? all : all.filter(p => p.type === type);
  const tab = (t, label) => `<a${type === t ? ' aria-current="page"' : ""} href="/insights${t === "all" ? "" : "?type=" + t}" style="display:inline-flex;align-items:center;min-height:42px;padding:0 20px;border-radius:999px;font-size:.92rem;font-weight:600;${type === t ? "background:var(--ink);color:#fff" : "color:var(--ink-2)"}">${label}</a>`;
  const title = type === "all" ? "Insights: marketing, AI search and growth | Spotlight" : `${TYPES[type]} | Spotlight Insights`;
  const desc = "Practical ideas on Meta and Google ads, content, brand, SEO and AI search from the Spotlight team, plus agency news and upcoming events.";
  const body = `
<section class="page-hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Insights</span></nav>
  <h1 data-split>Fresh from the spotlight</h1>
  <p class="lede">Practical ideas on ads, content, brand and AI search. Plus our news and upcoming events.</p>
  <nav class="tabs" aria-label="Filter insights" style="margin-top:34px">${tab("all", "All")}${tab("blog", "Blog")}${tab("news", "News")}${tab("event", "Events")}</nav>
</div></section>
<section style="padding:20px 0 130px"><div class="wrap">
  <div class="posts">${list.length ? list.map(cardHTML).join("") : `<p class="empty">Nothing here yet. New stories are on their way.</p>`}</div>
</div></section>`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description: desc, url: SITE + "/insights", isPartOf: { "@id": SITE + "/#website" } },
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: url(p), name: p.title })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Insights", item: SITE + "/insights" }] }
  ];
  return shell({ title, description: desc, path: "/insights" + (type === "all" ? "" : "?type=" + type), jsonld, body });
}

function routePost(q) {
  const p = published().find(x => x.slug === String(q.slug || ""));
  if (!p) return null;
  const isEvent = p.type === "event" && p.event;
  const desc = (p.seo && p.seo.description) || p.excerpt;
  const title = (p.seo && p.seo.title) || `${p.title} | Spotlight`;
  const author = { "@type": "Organization", name: p.author || BRAND, url: SITE + "/" };
  const publisher = { "@type": "Organization", name: BRAND, logo: { "@type": "ImageObject", url: SITE + "/logo-full.png" } };
  const img = p.cover ? (p.cover.startsWith("http") ? p.cover : SITE + p.cover) : SITE + "/og-image.jpg";
  const main = isEvent
    ? {
        "@context": "https://schema.org", "@type": "Event", name: p.title, description: desc, image: [img],
        startDate: p.event.start, endDate: p.event.end || p.event.start,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: p.event.mode === "offline" ? "https://schema.org/OfflineEventAttendanceMode" : p.event.mode === "mixed" ? "https://schema.org/MixedEventAttendanceMode" : "https://schema.org/OnlineEventAttendanceMode",
        location: p.event.mode === "offline" ? { "@type": "Place", name: p.event.location, address: p.event.address || p.event.location } : { "@type": "VirtualLocation", url: url(p) },
        organizer: { "@type": "Organization", name: BRAND, url: SITE + "/" },
        offers: { "@type": "Offer", price: p.event.price && /free/i.test(p.event.price) ? "0" : String(p.event.price || "0").replace(/[^\d.]/g, "") || "0", priceCurrency: "INR", availability: "https://schema.org/InStock", url: url(p), validFrom: p.date }
      }
    : {
        "@context": "https://schema.org", "@type": p.type === "news" ? "NewsArticle" : "BlogPosting",
        headline: p.title, description: desc, image: [img], datePublished: p.date, dateModified: p.updated || p.date,
        author, publisher, mainEntityOfPage: url(p), keywords: (p.tags || []).join(", "), inLanguage: "en-IN"
      };
  const jsonld = [main, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Insights", item: SITE + "/insights" },
      { "@type": "ListItem", position: 3, name: p.title, item: url(p) }]
  }];
  if (Array.isArray(p.faq) && p.faq.length) jsonld.push({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: p.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  });

  const eventBox = isEvent ? `<div class="event-box">
      <div><small>Date</small><b>${fmtDate(p.event.start)}</b></div>
      <div><small>Time (IST)</small><b>${fmtTime(p.event.start)}${p.event.end ? " – " + fmtTime(p.event.end) : ""}</b></div>
      <div><small>Where</small><b>${esc(p.event.location || "Online")}</b></div>
    </div>
    ${p.event.registerUrl ? `<p style="margin-top:26px"><a class="btn btn-gold magnetic" href="${esc(safeHref(p.event.registerUrl))}" data-cta="event-register">Register${p.event.price ? " · " + esc(p.event.price) : ""}</a></p>` : ""}` : "";

  const faq = Array.isArray(p.faq) && p.faq.length ? `<h2>Quick answers</h2>${p.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` : "";
  const related = sortPosts(published()).filter(x => x.slug !== p.slug && x.type === p.type).slice(0, 3);
  const relatedFallback = related.length ? related : sortPosts(published()).filter(x => x.slug !== p.slug).slice(0, 3);

  const body = `
<article>
  <section class="page-hero"><div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/insights">Insights</a><span aria-hidden="true">/</span><a href="/insights?type=${esc(p.type)}">${esc(TYPES[p.type] || "Stories")}</a></nav>
    <h1 data-split>${esc(p.title)}</h1>
    <p class="lede">${esc(p.excerpt)}</p>
    <div class="article-meta"><span>${esc(p.author || BRAND)}</span><span>Published <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time></span>${p.readingTime && !isEvent ? `<span>${esc(p.readingTime)} min read</span>` : ""}</div>
    ${eventBox}
  </div></section>
  <div class="wrap"><div class="prose" data-reveal>
    ${p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.coverAlt || "")}" width="1200" height="675" style="border-radius:24px;margin-bottom:34px" decoding="async">` : ""}
    ${md(p.body)}
    ${faq}
    <p class="note" style="margin-top:44px">Want this applied to your brand? <a href="/#audit" data-cta="article">Get your free growth audit</a>, delivered within 48 hours.</p>
  </div></div>
</article>
${relatedFallback.length ? `<section class="related"><div class="wrap"><h2 style="font-size:2.4rem;margin-bottom:30px">Keep reading</h2><div class="posts">${relatedFallback.map(cardHTML).join("")}</div></div></section>` : ""}`;
  return shell({ title, description: desc, path: "/insights/" + encodeURIComponent(p.slug), image: p.cover, type: "article", jsonld, body,
    extraHead: `<meta property="article:published_time" content="${esc(p.date)}">` });
}

function notFound() {
  return shell({
    title: "Page not found | Spotlight", description: "This page has left the stage.", path: "/404",
    body: `<section class="nf"><div class="nf-beam" aria-hidden="true"></div><div class="wrap"><div class="code">4<span class="o">0</span>4</div><h1 style="font-size:clamp(2rem,4vw,3rem)">This story has left the stage</h1><p>It may have been moved or unpublished. Try the latest insights instead.</p><a class="btn btn-gold magnetic" href="/insights">Browse insights</a></div></section>`
  }).replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">');
}

function routeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const items = STATIC_PAGES.map(s => `<url><loc>${SITE}${s.loc}</loc><lastmod>${today}</lastmod><changefreq>${s.changefreq}</changefreq><priority>${s.priority}</priority></url>`)
    .concat(sortPosts(published()).map(p => `<url><loc>${xml(url(p))}</loc><lastmod>${xml(p.updated || p.date)}</lastmod><changefreq>monthly</changefreq><priority>${p.type === "event" ? "0.7" : "0.6"}</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>\n`;
}

function routeFeed() {
  const list = sortPosts(published()).slice(0, 30);
  const items = list.map(p => `<item><title>${xml(p.title)}</title><link>${xml(url(p))}</link><guid isPermaLink="true">${xml(url(p))}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${xml(TYPES[p.type] || "Stories")}</category><description>${xml(p.excerpt)}</description></item>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Spotlight Insights</title><link>${SITE}/insights</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>Marketing, AI search and growth from Spotlight.</description><language>en-in</language>${items.join("")}</channel></rss>\n`;
}

function routeLlms() {
  const list = sortPosts(published());
  const sec = t => list.filter(p => p.type === t).map(p => `- [${p.title}](${url(p)}): ${plain(p.excerpt)}`).join("\n") || "- (none yet)";
  return `# Spotlight — full content index\n\n> Spotlight is an AI-powered media and digital marketing agency. Where marketing meets intelligence.\n\nThis file lists every published page on ${SITE}. See ${SITE}/llms.txt for the summary.\n\n## Core pages\n- [Home](${SITE}/): services, process, FAQ and the free growth audit\n- [Services catalogue](${SITE}/services): 6 pillars and 19 service areas\n- [Insights](${SITE}/insights): blog, news and events\n- [Privacy policy](${SITE}/privacy)\n- [Terms & conditions](${SITE}/terms)\n\n## Blog\n${sec("blog")}\n\n## News\n${sec("news")}\n\n## Events\n${sec("event")}\n`;
}

/* ---------- handler ---------- */
module.exports = (req, res) => {
  const q = req.query || {};
  const route = String(q.route || "posts");
  const cache = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
  try {
    switch (route) {
      case "posts":
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(JSON.stringify({ posts: routePosts(q) }));
      case "insights":
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(routeInsights(q));
      case "post": {
        const html = routePost(q);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (!html) { res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60"); return res.status(404).send(notFound()); }
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(html);
      }
      case "sitemap":
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(routeSitemap());
      case "feed":
        res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(routeFeed());
      case "llms":
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", cache);
        return res.status(200).send(routeLlms());
      default:
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(400).send(JSON.stringify({ error: "Unknown route" }));
    }
  } catch (err) {
    console.error("content error", err);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).send(JSON.stringify({ error: "Content temporarily unavailable" }));
  }
};

/* exported for the local page generator (scripts are not deployed as routes) */
module.exports.shell = shell;
module.exports.md = md;
