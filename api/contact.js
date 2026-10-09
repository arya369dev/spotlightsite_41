/* =========================================================
   /api/contact  —  audit form handler (Vercel function)
   - Server-side validation (never trust the browser)
   - Spam protection: honeypot, time-trap, link limit, rate limit,
     optional Cloudflare Turnstile
   - Delivers the lead to n8n (webhook) and/or email (Resend)
   - Sends a Meta Conversions API "Lead" event (deduplicated with
     the browser Pixel via event_id) when the visitor allowed marketing
   All keys come from Vercel Environment Variables. Nothing secret
   is ever sent to the browser.
   ========================================================= */
"use strict";
const crypto = require("crypto");

const ENV = {
  WEBHOOK: process.env.CONTACT_WEBHOOK_URL || "",        // n8n / Make / Zapier webhook
  WEBHOOK_SECRET: process.env.CONTACT_WEBHOOK_SECRET || "",
  RESEND_KEY: process.env.RESEND_API_KEY || "",
  NOTIFY_TO: process.env.LEAD_NOTIFY_EMAIL || "",
  NOTIFY_FROM: process.env.LEAD_FROM_EMAIL || "Spotlight Website <onboarding@resend.dev>",
  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET_KEY || "",
  PIXEL_ID: process.env.META_PIXEL_ID || "",
  CAPI_TOKEN: process.env.META_CAPI_TOKEN || "",
  CAPI_TEST: process.env.META_TEST_EVENT_CODE || "",
  GRAPH_VERSION: process.env.META_GRAPH_VERSION || "v21.0",
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)
};

/* best-effort in-memory rate limit (per warm instance) */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 5;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

const sha = v => crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);
const send = (res, code, body) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); return res.status(code).send(JSON.stringify(body)); };

function validate(b) {
  const lead = {
    name: clean(b.name, 80),
    email: clean(b.email, 120).toLowerCase(),
    phone: clean(b.phone, 20),
    website: clean(b.website, 200),
    service: clean(b.service, 80),
    message: String(b.message ?? "").replace(/\u0000/g, "").trim().slice(0, 2000)
  };
  const errors = {};
  if (lead.name.length < 2) errors.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.email = "Please enter a valid email.";
  if (lead.phone && !/^[0-9+()\-\s]{7,20}$/.test(lead.phone)) errors.phone = "Please check the phone number.";
  if (!lead.service) errors.service = "Please choose a service.";
  if (b.consent !== true && b.consent !== "on") errors.consent = "Consent is required.";
  return { lead, errors };
}

async function verifyTurnstile(token, ip) {
  if (!ENV.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: ENV.TURNSTILE_SECRET, response: token, remoteip: ip || "" })
    });
    const j = await r.json(); return !!j.success;
  } catch { return false; }
}

async function toWebhook(payload) {
  if (!ENV.WEBHOOK) return false;
  const body = JSON.stringify(payload);
  const headers = { "content-type": "application/json" };
  if (ENV.WEBHOOK_SECRET) headers["x-spotlight-signature"] = crypto.createHmac("sha256", ENV.WEBHOOK_SECRET).update(body).digest("hex");
  const r = await fetch(ENV.WEBHOOK, { method: "POST", headers, body });
  if (!r.ok) throw new Error("webhook " + r.status);
  return true;
}

async function toEmail(lead, meta) {
  if (!ENV.RESEND_KEY || !ENV.NOTIFY_TO) return false;
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = Object.entries({ ...lead, page: meta.page, source: meta.attribution.utm_source || "", campaign: meta.attribution.utm_campaign || "" })
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666">${esc(k)}</td><td style="padding:6px 12px">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${ENV.RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: ENV.NOTIFY_FROM, to: ENV.NOTIFY_TO.split(","), reply_to: lead.email, subject: `New audit request: ${lead.name} (${lead.service})`, html: `<h2>New growth audit request</h2><table>${rows}</table>` })
  });
  if (!r.ok) throw new Error("email " + r.status);
  return true;
}

async function toMetaCAPI(lead, meta, req) {
  if (!ENV.PIXEL_ID || !ENV.CAPI_TOKEN || !meta.marketingConsent) return false;
  const user_data = {
    em: [sha(lead.email)],
    client_ip_address: meta.ip || undefined,
    client_user_agent: req.headers["user-agent"] || undefined,
    fbp: meta.fbp || undefined,
    fbc: meta.fbc || (meta.attribution.fbclid ? `fb.1.${Date.now()}.${meta.attribution.fbclid}` : undefined)
  };
  if (lead.phone) user_data.ph = [sha(lead.phone.replace(/[^\d]/g, ""))];
  const [fn, ...ln] = lead.name.split(/\s+/);
  if (fn) user_data.fn = [sha(fn)];
  if (ln.length) user_data.ln = [sha(ln.join(" "))];
  const body = {
    data: [{ event_name: "Lead", event_time: Math.floor(Date.now() / 1000), event_id: meta.eventId, action_source: "website", event_source_url: meta.page, user_data, custom_data: { content_name: lead.service } }]
  };
  if (ENV.CAPI_TEST) body.test_event_code = ENV.CAPI_TEST;
  const r = await fetch(`https://graph.facebook.com/${ENV.GRAPH_VERSION}/${ENV.PIXEL_ID}/events?access_token=${encodeURIComponent(ENV.CAPI_TOKEN)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  if (!r.ok) console.warn("CAPI", r.status, await r.text().catch(() => ""));
  return r.ok;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { res.setHeader("Allow", "POST"); return res.status(204).end(); }
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { ok: false, error: "Use POST." }); }

  const origin = req.headers.origin || "";
  if (ENV.ALLOWED_ORIGINS.length && origin && !ENV.ALLOWED_ORIGINS.includes(origin)) return send(res, 403, { ok: false, error: "Not allowed." });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== "object") return send(res, 400, { ok: false, error: "Please fill in the form." });
  if (JSON.stringify(b).length > 12000) return send(res, 413, { ok: false, error: "That message is too long." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

  /* ---- spam traps: pretend success so bots learn nothing ---- */
  if (b.company_url) return send(res, 200, { ok: true });
  const started = Number(b.ts) || 0, age = Date.now() - started;
  if (!started || age < 2500) return send(res, 200, { ok: true });
  if (age > 24 * 3600 * 1000) return send(res, 400, { ok: false, error: "This form was open for a long time. Please refresh the page and try again." });
  if (limited(ip)) return send(res, 429, { ok: false, error: "Too many requests. Please try again in a few minutes." });

  const { lead, errors } = validate(b);
  if (Object.keys(errors).length) return send(res, 422, { ok: false, error: Object.values(errors)[0], fields: errors });
  if ((lead.message.match(/https?:\/\//gi) || []).length > 3) return send(res, 200, { ok: true });

  if (!(await verifyTurnstile(b.turnstile, ip))) return send(res, 400, { ok: false, error: "The security check failed. Please try again." });

  const attribution = b.attribution && typeof b.attribution === "object" ? Object.fromEntries(Object.entries(b.attribution).slice(0, 10).map(([k, v]) => [clean(k, 30), clean(v, 200)])) : {};
  const meta = {
    eventId: clean(b.event_id, 80) || "lead-" + Date.now(),
    page: clean(b.page, 300), attribution, ip,
    fbp: clean(b.fbp, 120), fbc: clean(b.fbc, 200),
    marketingConsent: b.marketing_consent === true
  };
  const payload = {
    type: "audit_request", received_at: new Date().toISOString(), lead,
    source: { page: meta.page, ...attribution, user_agent: clean(req.headers["user-agent"], 300) },
    event_id: meta.eventId
  };

  const results = await Promise.allSettled([toWebhook(payload), toEmail(lead, meta), toMetaCAPI(lead, meta, req)]);
  const delivered = results.slice(0, 2).some(r => r.status === "fulfilled" && r.value === true);
  results.forEach((r, i) => r.status === "rejected" && console.error(["webhook", "email", "capi"][i], r.reason && r.reason.message));

  if (!delivered) {
    console.error("Lead NOT delivered: set CONTACT_WEBHOOK_URL or RESEND_API_KEY + LEAD_NOTIFY_EMAIL in Vercel.");
    return send(res, 503, { ok: false, error: "Our form is being connected right now." });
  }
  return send(res, 200, { ok: true });
};
