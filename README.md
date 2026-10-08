# Spotlight website v5

*Where marketing meets intelligence.*

The site opens on a dark, cinematic stage where your intro film plays. When you scroll, it moves into a light, pastel world lit by stage-light colours. It is a static site with two small Vercel functions. You can deploy it to Vercel as it is.

---

## 1. Folder layout

Put the files exactly like this. Everything sits in the root folder except the two files inside `api/`.

```
spotlight/
├── index.html            Home page (cinematic intro, AR HUD hero, SPOT·AI chat)
├── services.html         Services catalogue: 3D page-turning book  → /services
├── services-data.json    The 6 pillars + 19 services (feeds the chat assistant)
├── book.js               Catalogue book engine (drag, swipe, keys, click)
├── boot.js               Tiny first-paint helper: shows the intro only when it will play
├── cinema.js             Homepage scenes: nano-assembly particles, 3D cinema controller, brand scanner
├── theatre.js            Real-time 3D cinema (projector, beam, screen). Built with three.js, loaded only when needed
├── theatre-poster.jpg    Still of the 3D projector, shown while the 3D scene loads (and as a fallback)
├── project-01.jpg … project-16.jpg   BiggTime Entertainment event photos (1280×960, compressed)
├── project-thumbs.jpg    All 16 photos as small thumbnails in one image (fast thumbnail strip)
├── spot-ai.js            SPOT·AI chat + 4D hologram + HUD (all pages)
├── privacy.html          Privacy policy        → /privacy
├── terms.html            Terms & conditions    → /terms
├── 404.html              Custom "not found" page
├── style.css             All styles
├── main.js               Motion, cursor, consent, analytics, form
├── posts.json            Blog / News / Events content (source of truth)
├── robots.txt            Crawler rules (AI crawlers allowed)
├── llms.txt              Summary for AI assistants
├── site.webmanifest      App icon / colour info
├── vercel.json           HTTPS, security headers, clean URLs, routes
├── package.json
├── env-example.txt       List of secret settings for Vercel
├── intro.mp4 / intro.webm        Intro film with your music track (watermark removed), two formats for every browser
├── hero-loop.mp4 / hero-loop.webm Silent slow-motion loop of the beam, seamless
├── hero-poster.jpg       First frame shown while video loads
├── intro-poster.jpg
├── og-image.jpg          Social preview (1200×630)
├── logo-full.png  logo-mark.png  logo-wordmark.png
├── favicon-32.png  favicon-180.png  favicon-512.png
├── font-cormorant-500.woff2  font-cormorant-600.woff2  font-manrope.woff2  font-cinzel-500.woff2
│                         Self-hosted fonts (faster + no Google Fonts privacy issue)
└── api/
    ├── chat.js           Optional live-AI answers for SPOT·AI (needs ANTHROPIC_API_KEY)
    ├── scan.js           Brand scanner: reads one public homepage and reports real signals
    ├── contact.js        Audit form handler (validation, spam, n8n, email, Meta CAPI)
    └── content.js        Insights pages, sitemap.xml, feed.xml, llms-full.txt
```

`sitemap.xml`, `feed.xml`, `llms-full.txt` and every `/insights/...` page are **generated on the fly** by `api/content.js`. Each new post is added to them automatically, so there are no files for these.

---

## 2. Deploy to Vercel (about 10 minutes)

1. Create a new GitHub repository and upload all the files, keeping `api/` as a folder.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework preset as **Other**. You don't need a build command.
3. In **Settings → Environment Variables**, add the values from `env-example.txt`. At minimum, add:
   - `SITE_URL`: your domain
   - `CONTACT_WEBHOOK_URL`, **or** `RESEND_API_KEY` + `LEAD_NOTIFY_EMAIL`. Until one of these is set, the form shows visitors your email address instead.
4. Deploy. Then add your domain under **Settings → Domains**.

### Replace the placeholder domain and email
The code uses `spotlight.agency` and `hello@spotlight.agency` as placeholders. Use find & replace across all files to swap in your real domain and email. Also fill in the bracketed items `[registered company name]`, `[registered address]`, `[city]` and `[name]` in `privacy.html` and `terms.html`. Ask a lawyer to review both pages before launch.

### Turn on analytics and Meta ads
Open `main.js` and fill in the `CONFIG` block at the top:

```js
GA4_ID: "G-XXXXXXX",          // Google Analytics 4
META_PIXEL_ID: "123456789",   // Meta Pixel
TURNSTILE_SITE_KEY: "",       // optional Cloudflare Turnstile
```

These IDs are **public by design**, so they are safe in the browser. The secret keys (the Meta CAPI token and the Turnstile secret) go **only** in Vercel environment variables.

---

## 3. The launch checklist, and where each item lives

| Item | How it's done |
|---|---|
| Privacy policy | `privacy.html`, written for India's DPDP Act 2023 + GDPR, with a cookie table |
| Terms & conditions | `terms.html` |
| Remove frontend secrets | No keys in HTML/JS. All secrets are env vars read only by `api/*.js` (see `env-example.txt`) |
| Enforce HTTPS | Vercel auto-redirects HTTP → HTTPS. `vercel.json` adds HSTS (2 years, preload) + CSP `upgrade-insecure-requests` |
| Cookie consent banner | Accept / Reject / Choose. GA4 and the Meta Pixel **don't load** until consent is given. "Cookie settings" in the footer re-opens it |
| Meta titles/descriptions | A unique title and description on every page, including each generated post |
| Social preview image | `og-image.jpg` 1200×630 + Open Graph + X/Twitter tags + `og:video` |
| Favicon | 32, 180 (Apple) and 512 px + `site.webmanifest` |
| Sitemap & robots.txt | `/sitemap.xml` (auto, includes every published post) + `robots.txt` |
| Image alt text | Every content image has alt text. Decorative images use `alt=""` |
| Image compression | PNGs quantised (~40% smaller), JPGs optimised. Intro video 1.8 MB → 0.7 MB (MP4) / 0.39 MB (WebM), background loop 63–112 KB, fonts self-hosted as WOFF2 |
| Page load speed | Lighthouse (tested before delivery): desktop **100** performance, mobile **89** on a plain local server with no compression (Vercel adds Brotli + edge caching, so expect higher). Accessibility, Best practices and SEO all **100**. Poster and fonts preloaded, fonts `display=swap`, insights load only when scrolled near, videos pause off-screen, no frameworks |
| Colour contrast | Text colours chosen and checked for WCAG AA (4.5:1+) on both light and dark backgrounds |
| Mobile responsiveness | Fluid type, 3 breakpoints, touch-friendly 44px+ targets, no sideways scroll |
| Custom 404 page | `404.html`, with a swinging spotlight that follows the cursor |
| Broken link fixes | All internal links checked automatically before delivery |
| Form validation | Live, friendly errors in the browser **and** strict validation on the server |
| Spam protection | Hidden honeypot field, time trap, link-count filter, rate limit, optional Cloudflare Turnstile |
| Analytics setup | GA4 + Meta Pixel (consent-gated) + Meta Conversions API (server side, deduplicated) |
| Single clear CTA | Every button leads to one action: **Get your free growth audit** |

**Also included:** structured data (Organization, FAQPage, VideoObject, BlogPosting, NewsArticle, Event, Breadcrumbs), `llms.txt` + `llms-full.txt`, an RSS feed, a skip link, visible keyboard focus, and `prefers-reduced-motion` support.

---

## 4. Blog / News / Events and automation (n8n or an AI agent)

All content lives in **`posts.json`**. Each item looks like this:

```json
{
  "slug": "my-post-url",
  "type": "blog",                 // blog | news | event
  "status": "pending_review",     // draft | pending_review | published
  "title": "…",
  "excerpt": "One or two sentences for cards and search results",
  "date": "2026-10-03",
  "author": "Spotlight Team",
  "tags": ["SEO"],
  "readingTime": 5,
  "cover": "",                    // optional image URL
  "coverAlt": "",
  "body": "Markdown text: ## headings, lists, **bold**, [links](https://…)",
  "faq": [{ "q": "…", "a": "…" }],   // optional, becomes FAQ rich results
  "event": { "start": "2026-11-12T16:00:00+05:30", "end": "…", "mode": "online", "location": "…", "registerUrl": "…", "price": "Free" },
  "generatedBy": "ai"             // human | ai
}
```

**Only `"status": "published"` ever appears on the site.** That status is the human approval gate.

### Recommended n8n workflow
1. **Trigger:** a schedule (e.g. every Monday), an RSS/news source, or a form.
2. **AI node** (OpenAI / Anthropic): drafts the post in the JSON shape above, with `status: "pending_review"`.
3. **GitHub node:** reads `posts.json`, appends the new item, and commits it back.
4. **Notify** (email, Slack or WhatsApp): "New draft ready for review".
5. **A person reviews and edits** the post on GitHub, changes the status to `published`, and commits.
6. Vercel redeploys automatically within about 30 seconds. The post goes live at `/insights/<slug>`, and the sitemap, RSS feed, `llms-full.txt` and homepage cards all update by themselves.

The Markdown converter escapes all HTML, so AI-written text can't inject scripts into your pages.

### Leads into n8n
Set `CONTACT_WEBHOOK_URL` to an n8n **Webhook** node. Each audit request arrives as:

```json
{ "type": "audit_request", "received_at": "…", "lead": { "name": "…", "email": "…", "phone": "…", "website": "…", "service": "…", "message": "…" },
  "source": { "page": "…", "utm_source": "…", "utm_campaign": "…", "fbclid": "…" }, "event_id": "lead-…" }
```

If you set `CONTACT_WEBHOOK_SECRET`, check the `x-spotlight-signature` header (HMAC-SHA256 of the body) in n8n. From there you can push to a CRM or Google Sheets, auto-reply, or start the audit research agent.

---

## 5. Meta ads readiness
- Pixel `PageView`, `ViewContent` (when someone flips a service card), `Contact` (when someone clicks a CTA) and `Lead` (when someone submits the form).
- Conversions API `Lead` is sent from the server with the **same `event_id`**, so Meta counts each lead once. Emails and phone numbers are SHA-256 hashed first.
- UTM tags, `fbclid` and `gclid` are captured on arrival and attached to the lead.
- Visitors who click an ad (any UTM or fbclid in the URL) **skip the intro film** and land straight on the offer.
- Use `META_TEST_EVENT_CODE` to watch events in Events Manager → Test events.

---

## 6. Motion & accessibility notes
- **Intro film:** plays once per visit and starts muted. It has *Sound on* and *Skip intro* buttons, and **Esc** skips it. When it ends, the film "irises out" into the lamp. *Watch the intro with sound* replays it.
- **Custom cursor:** a gold ring plus a soft coloured stage-light glow that changes colour with each section. It only appears on mouse/trackpad devices, so touch devices keep normal behaviour.
- **Playcards:** they tilt with the cursor and flip with a click, tap, Enter or Space. **Esc** flips back. The hidden side is made `inert` so screen readers only read the visible side.
- If a visitor's device asks for reduced motion, the film, particles, tilt and scroll effects are switched off.

---

## 7. Editing quickly
- **Text:** edit `index.html` directly. The FAQ appears twice, once on the page and once in the JSON-LD at the top, so update both.
- **Colours:** change the `:root` variables at the top of `style.css`.
- **Services:** each card is an `<article class="playcard">` in `index.html`.
- **The sample posts and events** in `posts.json` are placeholders. Replace them, or set their status to `draft`, before launch.

---

## 8. What's new in v3

**Cinematic intro.** The intro film now carries an original trailer-style score composed to the picture: heartbeat drums in the dark, a riser into the first light burst (≈3 s), ticking tension while the title forms, and a big brass "braam" impact when the logo lands (≈7 s). Browsers only allow sound after a click, so the film starts muted with a pulsing **Play with sound** button that restarts it from the top with the score. Cinematic letterbox bars slide in.

**AR HUD hero.** On wide screens the spotlight gets a target-lock ring and four live telemetry tags (Strategy, Content, Paid media, Listening).

**/services: the catalogue book.** A 32-page 3D book built from the *Spotlight Digital Marketing Services* document: cover, our promise, contents, the 6 pillars, all 19 service areas (what we provide + the AI role), the growth loop, how an engagement runs, positioning and a back cover with the audit button. It opens itself, and visitors can turn pages by dragging a corner, swiping, clicking a page edge, using the arrow keys, or jumping by chapter. Two-page spreads on desktop, single pages on phones. Every page is real HTML, so Google and AI assistants can read it, and it has Service structured data. Below the book: the six pillars, the growth loop and a filterable grid of all 19 services.

**SPOT·AI: the holographic chat.** A real 4-dimensional tesseract is projected 4D → 3D → 2D on a canvas, with an AR HUD (radar, reticle, live rotation readouts, scanlines). You can spin it with the cursor or a tap. The chat answers from a built-in knowledge base straight away. Add `ANTHROPIC_API_KEY` in Vercel and it switches to live AI answers through `/api/chat`, keeping the key on the server. A floating **Ask SPOT·AI** button opens the chat on every page.

**Smoothness.** No libraries. The hologram and dust only animate while on screen, the frame rate is capped for high-DPI screens, and everything respects "reduce motion". Tested at 60 fps in the chat section.

To change the catalogue text, edit `services.html`. To change what the chat knows, edit `services-data.json` and the `localAnswer` section in `spot-ai.js`.


---

## 9. What's new in v4: cinematic, Hollywood-grade

**Colour.** The site now uses a Hollywood "teal and orange" grade: deep blue-black shadows, teal highlights, warm orange light and the Spotlight gold. The hero background film is colour-graded the same way. The light reading sections use matching teal and peach pastels.

**Nano-assembly (inspired by the particle film).** Right after the hero, thousands of tiny particles lie scattered like debris. As you scroll they swarm into the Spotlight star, then rebuild into the SPOTLIGHT wordmark. Three captions tell the story: *Scattered → Gathered → Assembled*. The particles drift with your cursor for parallax depth.

**Featured project: the projector film reel (built from your storyboard).** It follows the four steps in your reference video:
1. **Initial view:** a vintage projector with spinning reels.
2. **Reel animation:** a 3D film strip flows out of the lens carrying the 8 BiggTime Entertainment photos plus title cards, then curls into a spinning reel.
3. **Frame focus:** hover a frame to pause it and lift it forward.
4. **Project view:** click any frame for a full-screen gallery with project details, thumbnails, arrows, swipe and keyboard support.

Visitors can drag to spin it or switch between *Film strip* and *Reel*.

**Brand scanner (environmental scan).** Visitors enter their website and watch an AR-style scan of a wireframe page. The server (`api/scan.js`) really reads their homepage and identifies the brand (name, icon, colour, platform, social profiles). It then checks 16 real signals: HTTPS, speed, mobile setup, title, description, H1, structured data, alt text, social preview, X card, social links, Meta Pixel, Google tag, AI crawlers, llms.txt and language. Each result is explained, and the button pre-fills the audit form. It only reads public pages, blocks private network addresses, times out after 8 seconds and stores nothing.

**SPOT·AI voice assistant.** A rotating AI "core" of rings and waveforms surrounds the 4D hologram. Tap the **mic** to speak a question, or turn on **spoken replies** and choose a voice: *Atlas* (deep) or *Nova* (bright). This is the JARVIS / FRIDAY feel without using Marvel's names. The core shows LISTENING, PROCESSING and SPEAKING states. Voice uses the browser's built-in speech features, so nothing extra is installed (mic input works in Chrome, Edge and Safari).

**3D transitions.** Moving between pages (Home ↔ Services ↔ Insights) uses a 3D swing transition in Chrome and Edge, and other browsers navigate normally. Big panels tilt up into place in 3D as you scroll to them.

**Smoothness.** Every animation pauses when it's off screen. Colour grading is baked into the video rather than applied live. All effects switch off for visitors who prefer reduced motion.

---

## 10. What's new in v5: a real 3D cinema

**Featured project, rebuilt as a real-time 3D scene** (adapted from the projector → beam → screen reference video). As you scroll through the section:
1. **Projector:** a realistic vintage 35 mm projector with brass cooling fins, a chrome lens, spinning reels whose film winds from one reel to the other, and a SPOTLIGHT name plate. The lamp warms up and the lens flares.
2. **Beam:** the camera swings behind the projector and the light beam travels down the hall over the seats, with drifting dust in the light.
3. **Screen:** the camera glides to a curved cinema screen between red velvet curtains. A classic 3‑2‑1 countdown leader plays, then a title card, then the 16 BiggTime Entertainment photos with a film-burn transition, gentle flicker and gate weave.

You can use the arrows, the thumbnail strip and pause, or click the screen to open the full gallery. Hovering over the projector and clicking it makes the reels spin faster.

**Built to stay smooth:**
- The 3D code (`theatre.js`) only downloads when you get close to the section.
- Shaders compile in the background before the first frame.
- Rendering stops whenever the section is off screen.
- Image quality adjusts itself to keep the frame rate steady.
- Phones get a lighter scene.
- Scroll handling across the site is batched into one frame, and offscreen animations sleep.
- If a device has no 3D support, or the visitor prefers reduced motion, the section shows a still cinema with the photos instead.

### To edit the project
- **Photos:** replace `project-01.jpg` … `project-16.jpg` (keep the names; 1280×960, 4:3).
  - If you change them, also rebuild `project-thumbs.jpg`, a 4×4 grid of 240×180 thumbnails in the same order.
  - Then bump `?v=5` to `?v=6` in `index.html` so returning visitors see the new images.
- **Captions and alt text:** in `index.html`, search for `data-photo-cap` (inside `pview`) and `th-strip`.
- **Section text:** search for `data-theatre`.
