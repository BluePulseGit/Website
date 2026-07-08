# Blue Pulse Studios — Website

The official site for Blue Pulse Studios: films, television, books, a merch shop, a community hub, and private tools for the team. This README is the onboarding guide for the founders, the VP, and any designer joining the project.

> **Two-minute mental model:** the site is plain HTML/CSS/JS (no build step). It lives in this GitHub repo, and **every commit to `main` auto-deploys to Cloudflare Pages** in about a minute. There is no server — "the admin console" is a set of in-browser tools that let you edit content, preview it in your own browser, then **export** the result so it can be committed and published for everyone.

---

## 1. The important concept: preview vs. publish

Almost every editing tool works the same way, and this is the one thing everyone must understand:

1. **You edit → it saves to *your browser* (localStorage).** You'll see your change immediately, but **only on your machine.**
2. **To publish for all visitors, you "Export" and commit the result** to the repo (or hand it to whoever manages the repo).

So if you make an edit and it "isn't showing up for other people," that's expected — it hasn't been exported/committed yet. This is a limitation of a no-server static site, and it keeps hosting free.

---

## 2. Where everything lives

| Thing | Where | Notes |
|---|---|---|
| **Live site** | `https://website-79d.pages.dev` | Auto-deploys from `main`. Custom domain to be added at launch. |
| **Source code** | this GitHub repo (`BluePulseGit/Website`) | Commit to `main` → deploys in ~1 min. |
| **Hosting** | Cloudflare Pages | Free tier. |
| **Admin console** | a hidden, unlisted page (URL + passphrase in `ADMIN-ACCESS.md`) | Not linked anywhere; noindexed. |
| **Secrets & hidden links** | `ADMIN-ACCESS.md` | **Kept private — not committed to the repo.** The founders share it directly. Contains the admin passphrase, hidden page slugs, and config notes. |
| **Shop** | Shopify (Storefront integration in `shopify.js`) | Live products: Blue Pulse Cap + Logo Tee. Everything else is a toggleable placeholder. |
| **Community** | Discord (invite is in the admin Social Links + `ADMIN-ACCESS.md`) | |

---

## 3. Publishing a change (the workflow)

**Designers / editors (no code):**
1. Open the admin console (URL + passphrase from the founders).
2. Make your change in the relevant tool (see §4). It previews live in your browser.
3. Click that tool's **Export / Copy for launch** button.
4. Send the exported text to whoever manages the repo (or paste it into the right file yourself if you have repo access — see below).

**Anyone with repo access, committing directly:**
- Edit or add the file in GitHub (web editor or upload), commit to `main`, wait ~1 min, refresh the live site.
- No build step, no framework — what you commit is what ships.

---

## 4. The admin tools (what each one does)

Open the admin console and sign in. Across the top you'll find:

- **Posts (Newswire)** — write/edit blog-style posts with images, scheduling, drafts, and a "placeholder" flag. Export RSS with the topbar button.
- **Copy Editor** — click any page in the list; it opens in edit mode where you click a headline or paragraph and type over it. Save previews it in your browser; **Export edited copy** publishes. You can also add `#bps-edit` to any page's URL to enter edit mode directly.
- **Photo swap** — while in edit mode (`#bps-edit`), hover any image to get "Upload new photo from gallery." Swap from the gallery, a pasted URL, or a device upload.
- **Social Links** — paste each platform's URL; they wire up the footer icons and Community page. **Copy for launch** → publish (bakes into `socials.js`).
- **Pitch Decks** — create password-protected screening pages for industry contacts (Canva embed or hosted MP4, per-deck access code, ambient loop, format/genre). **Export `pitch-decks.js`** to publish. See `ADMIN-ACCESS.md` for the viewer URL and the Stay Home deck's code.
- **Header/Footer code** — inject custom code sitewide (analytics snippets, meta tags, embeds). Header code loads in `<head>`; footer code at the end of `<body>`.
- **Page SEO** — set the browser title, search description, and social-share image per page. "Copy tags" exports HTML for the page `<head>`.
- **Site Settings → Placeholder Mode** — toggle OFF to hide every demo/placeholder item sitewide (preview the site as it'll look with only real content).

---

## 5. Sitewide features (in `site.js`, on every page)

These run automatically on every page; no per-page work needed.

- **Projects dropdown** — the nav "Projects" item reveals Films / Television / Books (Games & Docs later).
- **Persistent cart** — a cart icon (right of Contact) that carries items across the whole site.
- **Cookie consent** — Allow / Allow essential only / Deny banner; choice stored per visitor.
- **Accessibility** — bottom-left control: text size, high contrast, reduced motion, underline links.
- **Language** — bottom-right globe: auto-translates the whole site into ~20 languages (Google Translate).
- **Currency** — bottom-right selector: shows shop prices in USD/EUR/GBP/CAD/JPY. It reads the *displayed* price, so it tracks Shopify's live price automatically; shown as an estimate ("≈ €35") because checkout charges in USD.
- **Footer** — email signup ("Get our emails, transmissions, podcasts…") + minimalist social icons, injected into every footer.
- **"Transmission received."** — the blue-pulse confirmation that fires when a form (fan art, newsletter) is sent. Reusable via `window.bpsTransmission('…')`.
- **Web Analytics** — Cloudflare's cookieless beacon reports site traffic (view it in the Cloudflare dashboard → Web Analytics).

---

## 6. Key files

| File | What it is |
|---|---|
| `site.js` | Global behaviors: all the sitewide features in §5, plus the copy/photo editors. **Edit carefully — it loads on every page.** |
| `site.css` | Shared accessibility, focus, and link styles. Each page also has its own inline `<style>`. |
| `products.js` | Product catalog + cart logic. |
| `shopify.js` | Shopify Storefront integration (activates when a token is set). |
| `socials.js` | Published social URLs (from the admin Social Links export). |
| `pitch-decks.js` | Published pitch decks (from the admin Pitch Decks export). |
| `homepage.html`, `shop.html`, `studio.html`, `community.html`, `contact.html`, `films.html`, `moth-country.html`, `the-swell.html`, `books.html`, `journal.html`, `press.html`, … | The pages. Each is self-contained (nav + content + footer + styles). |
| `assets/` | Images, logos, key art. |

---

## 7. Pending / roadmap (as of this writing)

- **Media gallery + per-pitch-deck view-time** — need a Cloudflare R2 bucket + a small Worker. Parked pending accounting sign-off on R2 billing (free tier, but requires a card on file). Card-free fallbacks exist if preferred.
- **Discord server** — structure, channels, welcome/rules, and the invite are live; roles/permissions, onboarding config, and the free bots (Carl-bot, MonitoRSS → Newswire, events, dice) still need setup (some steps need an authorize click).
- **Shopify live data** — the integration is built; it turns on when a paid plan + Storefront token are added (see `ADMIN-ACCESS.md`).
- **Cloudflare Access** on the pitch decks — optional real-auth hardening for later.

---

## 8. Ground rules

- **Don't commit `ADMIN-ACCESS.md`, `TODO.md`, or `ROADMAP.md`** — they're in `.gitignore` for a reason (secrets / internal notes).
- **Test on the live URL after committing** — give Cloudflare ~1 minute to deploy, then hard-refresh.
- **Editor changes are per-browser until exported + committed** (see §1). If in doubt, export and commit.
- **Keep the passphrase and hidden-page slugs out of anything public** — they belong only in `ADMIN-ACCESS.md`.

---

*Questions on any of this? The founders keep the master notes in `ADMIN-ACCESS.md`.*
