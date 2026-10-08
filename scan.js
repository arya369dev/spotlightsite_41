/* =========================================================
   /api/scan  —  Brand scanner (Vercel function)
   Reads ONE public homepage and reports real, checkable signals:
   identity, search basics, social cards, pixels/tags, AI-search
   visibility and speed. Nothing is stored.
   Safety: only http(s), public IPs only (no internal network),
   max 4 redirects, 8 s timeout, 2 MB cap, rate-limited.
   ========================================================= */
"use strict";
const dns = require("dns").promises;
const net = require("net");

const hits = new Map();
const limited = ip => {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  arr.push(now); hits.set(ip, arr); if (hits.size > 5000) hits.clear();
  return arr.length > 12;
};
const send = (res, code, body) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); return res.status(code).send(JSON.stringify(body)); };

function privateIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168.");
}
async function safeURL(raw) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); } catch { throw new Error("That doesn't look like a website address."); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http and https websites can be scanned.");
  if (u.username || u.password) throw new Error("That address isn't supported.");
  if (u.port && !["80", "443", ""].includes(u.port)) throw new Error("That address isn't supported.");
  const host = u.hostname;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("That address isn't supported.");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new Error("We couldn't find that website. Check the spelling."); });
  if (!addrs.length || addrs.some(a => privateIP(a.address))) throw new Error("That address isn't supported.");
  return u;
}
async function get(url, { timeout = 8000, max = 2 * 1024 * 1024, accept = "text/html,application/xhtml+xml" } = {}) {
  let u = await safeURL(url), res;
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout);
  const t0 = Date.now();
  try {
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; SpotlightBrandScanner/1.0; +https://spotlight.agency)", accept } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { u = await safeURL(new URL(res.headers.get("location"), u).href); continue; }
      break;
    }
    const reader = res.body ? res.body.getReader() : null; let size = 0; const chunks = [];
    if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { ctrl.abort(); break; } chunks.push(value); }
    const text = Buffer.concat(chunks.map(c => Buffer.from(c))).toString("utf8");
    return { status: res.status, url: u.href, text, ms: Date.now() - t0, type: res.headers.get("content-type") || "" };
  } finally { clearTimeout(timer); }
}

const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : ""; };
const decode = s => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
function meta(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of tags) { const n = (attr(t, "name") || attr(t, "property")).toLowerCase(); if (n === key) return decode(attr(t, "content")); }
  return "";
}
function link(html, relWanted) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const t of tags) { const rel = attr(t, "rel").toLowerCase().split(/\s+/); if (relWanted.some(r => rel.includes(r))) return attr(t, "href"); }
  return "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Use POST." }); }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (limited(ip)) return send(res, 429, { error: "Too many scans. Please try again in a few minutes." });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const raw = String((b && b.url) || "").trim().slice(0, 300);
  if (!raw) return send(res, 400, { error: "Enter a website address." });

  let page;
  try { page = await get(raw); }
  catch (e) { return send(res, 422, { error: e.name === "AbortError" ? "That website took too long to respond." : (e.message || "We couldn't reach that website.") }); }
  if (page.status >= 400) return send(res, 422, { error: `That website answered with an error (${page.status}).` });
  if (!/html/i.test(page.type) && !/<html/i.test(page.text)) return send(res, 422, { error: "That address didn't return a web page." });

  const html = page.text, base = new URL(page.url);
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc = meta(head, "description");
  const ogTitle = meta(head, "og:title"), ogImage = meta(head, "og:image"), siteName = meta(head, "og:site_name") || meta(head, "application-name");
  const twCard = meta(head, "twitter:card"), theme = meta(head, "theme-color");
  const viewport = /<meta[^>]+name=["']?viewport/i.test(head);
  const canonical = link(head, ["canonical"]);
  const iconHref = link(head, ["apple-touch-icon"]) || link(head, ["icon", "shortcut"]) || "/favicon.ico";
  const lang = attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang");
  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  const ldTypes = [...new Set(ldBlocks.flatMap(bk => (bk.match(/"@type"\s*:\s*"([^"]+)"/g) || []).map(x => x.split('"')[3])))].slice(0, 6);
  const h1 = (html.match(/<h1\b/gi) || []).length;
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter(t => !/\balt\s*=/i.test(t)).length;
  const pixel = /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i.test(html);
  const gtag = /googletagmanager\.com\/(gtag\/js|gtm\.js)|google-analytics\.com\/analytics\.js|gtag\(\s*['"]config/i.test(html);
  const social = [];
  [["Instagram", /instagram\.com\/[a-z0-9_.]+/i], ["Facebook", /facebook\.com\/[a-z0-9_.-]+/i], ["LinkedIn", /linkedin\.com\/(company|in)\//i], ["YouTube", /youtube\.com\/(@|c\/|channel\/|user\/)/i], ["X", /(twitter|x)\.com\/[a-z0-9_]+/i], ["WhatsApp", /wa\.me\/|api\.whatsapp\.com/i]]
    .forEach(([n, re]) => { if (re.test(html)) social.push(n); });
  const platform = /wp-content|wp-includes/i.test(html) ? "WordPress" : /cdn\.shopify\.com|Shopify\.theme/i.test(html) ? "Shopify" : /static\.wixstatic\.com|wix\.com/i.test(html) ? "Wix" : /squarespace/i.test(html) ? "Squarespace" : /webflow/i.test(html) ? "Webflow" : /framerusercontent|framer\.com/i.test(html) ? "Framer" : /\/_next\//.test(html) ? "Next.js" : "";

  // AI visibility: llms.txt + robots rules for AI crawlers (quick, parallel)
  const origin = base.origin;
  const [llms, robots] = await Promise.all([
    get(origin + "/llms.txt", { timeout: 4000, max: 200000, accept: "text/plain,*/*" }).catch(() => null),
    get(origin + "/robots.txt", { timeout: 4000, max: 200000, accept: "text/plain,*/*" }).catch(() => null)
  ]);
  const hasLlms = !!(llms && llms.status === 200 && !/<html/i.test(llms.text) && llms.text.trim().length > 20);
  let aiBlocked = [];
  if (robots && robots.status === 200 && !/<html/i.test(robots.text)) {
    const groups = robots.text.split(/\n(?=\s*user-agent)/i);
    ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"].forEach(bot => {
      const g = groups.find(x => new RegExp(`user-agent:\\s*${bot}\\b`, "i").test(x));
      if (g && /disallow:\s*\/\s*($|\n)/i.test(g)) aiBlocked.push(bot);
    });
  }

  const name = (siteName || ogTitle || title || base.hostname).split(/\s[|–—-]\s/)[0].trim().slice(0, 60) || base.hostname;
  let icon = ""; try { icon = new URL(iconHref, base).href; } catch {}
  const C = [];
  const add = (id, group, label, pass, detail) => C.push({ id, group, label, pass: !!pass, detail });
  add("https", "Trust & speed", "Secure connection (HTTPS)", base.protocol === "https:", base.protocol === "https:" ? "" : "Visitors and Google see this site as not secure.");
  add("speed", "Trust & speed", "Homepage loads quickly", page.ms < 2500, `${(page.ms / 1000).toFixed(1)} s for the HTML from our server${page.ms < 2500 ? "" : ". Aim for under 2.5 s."}`);
  add("viewport", "Trust & speed", "Mobile-friendly setup", viewport, viewport ? "" : "No mobile viewport tag found.");
  add("title", "Search", "Page title", title.length >= 10 && title.length <= 65, title ? `“${title.slice(0, 70)}” (${title.length} characters${title.length > 65 ? ", a bit long" : title.length < 10 ? ", too short" : ""})` : "No title found.");
  add("description", "Search", "Meta description", desc.length >= 50 && desc.length <= 170, desc ? `${desc.length} characters${desc.length > 170 ? ", gets cut off in Google" : desc.length < 50 ? ", too short to persuade" : ""}` : "Missing: Google will pick random text instead.");
  add("h1", "Search", "One clear main heading", h1 === 1, h1 === 1 ? "" : h1 === 0 ? "No H1 heading found." : `${h1} H1 headings found; use one.`);
  add("schema", "Search", "Structured data", ldBlocks.length > 0, ldBlocks.length ? ldTypes.join(", ") : "None found: harder for Google and AI to understand you.");
  add("alt", "Search", "Image descriptions (alt text)", imgs.length === 0 || noAlt / imgs.length < .2, imgs.length ? `${imgs.length - noAlt} of ${imgs.length} images described` : "");
  add("og", "Social", "Social share preview", !!(ogTitle && ogImage), ogImage ? "Image and title set for WhatsApp, LinkedIn and Facebook." : "No share image: links look blank when shared.");
  add("twitter", "Social", "X / Twitter card", !!twCard, twCard ? twCard : "Not set.");
  add("profiles", "Social", "Social profiles linked", social.length >= 2, social.length ? social.join(", ") : "No social profiles linked from the homepage.");
  add("pixel", "Ads & analytics", "Meta Pixel", pixel, pixel ? "Detected in the page code." : "Not detected in the page code (it may load via a tag manager).");
  add("gtag", "Ads & analytics", "Google tag / Analytics", gtag, gtag ? "Detected." : "Not detected in the page code.");
  add("ai", "AI visibility", "AI crawlers allowed", aiBlocked.length === 0, aiBlocked.length ? `Blocked in robots.txt: ${aiBlocked.join(", ")}` : "Nothing blocks ChatGPT, Claude, Perplexity or Gemini.");
  add("llms", "AI visibility", "llms.txt summary for AI", hasLlms, hasLlms ? "Found." : "Not found: a quick win for AI-search visibility.");
  add("lang", "AI visibility", "Language declared", !!lang, lang || "No lang attribute on the page.");
  const passed = C.filter(c => c.pass).length;

  return send(res, 200, {
    finalUrl: page.url, timeMs: page.ms, platform, social,
    brand: { name, icon, themeColor: /^#[0-9a-f]{3,8}$|^rgb/i.test(theme) ? theme : "", canonical: canonical ? decode(canonical) : "" },
    score: Math.round(passed / C.length * 100), checks: C
  });
};
