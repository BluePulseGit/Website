/* ============================================================
   site.js — site-wide behavior
   - Page transition (fade-to-black → navigate → fade-from-black)
   - Respects prefers-reduced-motion
   ============================================================ */
/* ——— LAUNCH CONFIG — fill these in to go live (see ADMIN-ACCESS.md) ———
   formEndpoint:       contact form POST target, e.g. https://formspree.io/f/xxxxxxx
   newsletterEndpoint: email signup POST target (Formspree/Mailchimp/Buttondown)
   analyticsDomain:    your domain, e.g. 'bluepulsestudios.com' — enables Plausible
   Leave any value '' and that feature stays in demo mode. */
window.BPS_CONFIG = {
  formEndpoint: '',
  newsletterEndpoint: '',
  analyticsDomain: '',
  /* YouTube video IDs — set these and the trailer buttons go live */
  trailers: {
    'stay-home': '',
    'the-painting': ''
  },
  /* Next merch drop date for drops.html countdown, e.g. '2026-10-31T09:00:00' */
  nextDropAt: ''
};

/* Analytics — loads Plausible only when a domain is configured */
(function () {
  const d = window.BPS_CONFIG.analyticsDomain;
  if (!d) return;
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = d;
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
})();

/* Newsletter signup — used by the email forms on shop/product pages.
   POSTs to newsletterEndpoint when configured; demo-confirms otherwise. */
window.bpsSubscribe = function (form, e) {
  if (e) e.preventDefault();
  const btn = form.querySelector('button');
  const input = form.querySelector('input[type=email]');
  const ep = (window.BPS_CONFIG || {}).newsletterEndpoint;
  const done = () => { btn.textContent = 'Subscribed ✓'; btn.disabled = true; };
  if (!ep) { done(); return false; }
  btn.textContent = '…';
  fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: input ? input.value : '', source: 'newsletter' })
  }).then(r => { r.ok ? done() : (btn.textContent = 'Try again'); })
    .catch(() => { btn.textContent = 'Try again'; });
  return false;
};

/* ——— PAGE METADATA OVERRIDES — set per-page title/description/og tags
   from the admin console (Page SEO). Demo behavior: overrides live in
   this browser's localStorage; the admin's "copy tags" export is for
   baking them into the HTML at launch. ——— */
(function () {
  try {
    const all = JSON.parse(localStorage.getItem('bpsPageMeta') || '{}');
    const page = (location.pathname.split('/').pop() || 'index.html');
    const m = all[page];
    if (!m) return;
    function setMeta(attr, key, val) {
      if (!val) return;
      let el = document.querySelector('meta[' + attr + '="' + key + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', val);
    }
    if (m.title) {
      document.title = m.title;
      setMeta('property', 'og:title', m.title);
      setMeta('name', 'twitter:title', m.title);
    }
    if (m.description) {
      setMeta('name', 'description', m.description);
      setMeta('property', 'og:description', m.description);
      setMeta('name', 'twitter:description', m.description);
    }
    if (m.ogImage) {
      setMeta('property', 'og:image', m.ogImage);
      setMeta('name', 'twitter:image', m.ogImage);
    }
  } catch (_) {}
})();

/* ——— SHOP SEARCH — product search overlay (shop pages only).
   Shows the full catalog on open with image previews; filters as you type. ——— */
(function () {
  let built = false, catalog = null;

  function loadScript(src) {
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
  }

  async function getCatalog() {
    if (catalog) return catalog;
    if (!window.PRODUCTS) await loadScript('products.js');
    const order = window.PRODUCT_ORDER || Object.keys(window.PRODUCTS || {});
    catalog = order.map(k => {
      const p = window.PRODUCTS[k];
      if (!p) return null;
      return {
        id: k, name: p.name, kicker: p.kicker || '', price: p.price,
        image: p.image || '', soon: !!p.comingSoon,
        hay: (p.name + ' ' + (p.kicker || '') + ' ' + (p.category || '') + ' ' + (p.description || '')).toLowerCase()
      };
    }).filter(Boolean);
    return catalog;
  }

  function rowHTML(p) {
    const thumb = p.image
      ? '<img src="' + p.image + '" alt="" loading="lazy" style="max-width:88%;max-height:88%;object-fit:contain">'
      : '<span style="font-size:8px;letter-spacing:.25em;text-transform:uppercase;color:#B0B0B0">Coming<br>Soon</span>';
    return '<a href="product.html?id=' + p.id + '" style="display:flex;gap:18px;align-items:center;padding:12px 4px;border-bottom:1px solid #E5E5E5;text-decoration:none">'
      + '<span style="flex:none;width:64px;height:80px;background:#F2F2F2;border:1px solid #E5E5E5;display:flex;align-items:center;justify-content:center;text-align:center">' + thumb + '</span>'
      + '<span style="flex:1;min-width:0">'
      + '<span style="display:block;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#6B6B6B;font-weight:500">' + p.kicker.split(' · ')[0] + (p.soon ? ' &middot; coming soon' : '') + '</span>'
      + '<span style="display:block;font-family:\'Fraunces\',serif;font-size:17px;color:#0F0F0F;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + p.name + '</span>'
      + '</span>'
      + '<span style="flex:none;font-size:13px;font-weight:600;color:#0F0F0F">$' + p.price + '</span></a>';
  }

  async function render(q) {
    const out = document.getElementById('bpsSearchResults');
    let items = await getCatalog();
    // respect Placeholder Mode: hide coming-soon items when the toggle is on
    if (document.documentElement.classList.contains('bps-hide-ph')) items = items.filter(p => !p.soon);
    if (q) items = items.filter(p => q.split(/\s+/).every(w => p.hay.includes(w)));
    out.innerHTML = items.length
      ? items.map(rowHTML).join('')
      : '<p style="font-family:\'Fraunces\',serif;font-style:italic;color:#6B6B6B;padding:20px 4px">Nothing in the shop matches that. Try &ldquo;figure&rdquo;, &ldquo;poster&rdquo;, &ldquo;hoodie&rdquo;&hellip;</p>';
  }

  function build() {
    if (built) return;
    built = true;
    const el = document.createElement('div');
    el.innerHTML = '<div style="position:fixed;inset:0;z-index:100000;display:none;background:rgba(15,15,15,0.55);backdrop-filter:blur(6px)" id="bpsSearchScrim">'
      + '<div style="max-width:600px;margin:9vh auto 0;padding:36px 40px 28px;background:#FAFAFA;border:1px solid #0F0F0F;max-height:76vh;display:flex;flex-direction:column">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#6B6B6B;font-weight:600">Search the shop</span><button id="bpsSearchClose" style="background:none;border:0;font-size:20px;cursor:pointer;color:#0F0F0F" aria-label="Close">&times;</button></div>'
      + '<input id="bpsSearchInput" type="search" placeholder="hoodie, figure, poster, Red Winter…" autocomplete="off" style="width:100%;font-family:\'Fraunces\',serif;font-size:22px;font-weight:300;padding:14px 2px;background:transparent;border:0;border-bottom:1px solid #0F0F0F;color:#0F0F0F;outline:none;margin-top:10px">'
      + '<div id="bpsSearchResults" style="margin-top:8px;overflow-y:auto;flex:1"></div>'
      + '</div></div>';
    document.body.appendChild(el.firstChild);
    const scrim = document.getElementById('bpsSearchScrim');
    const input = document.getElementById('bpsSearchInput');
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
    document.getElementById('bpsSearchClose').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    input.addEventListener('input', () => render(input.value.trim().toLowerCase()));
  }
  function open() { build(); document.getElementById('bpsSearchScrim').style.display = 'block'; document.getElementById('bpsSearchInput').focus(); render(''); }
  function close() { const s = document.getElementById('bpsSearchScrim'); if (s) { s.style.display = 'none'; document.getElementById('bpsSearchInput').value = ''; } }
  window.bpsOpenSearch = open;

  let hasTrigger = false;
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href="#"]').forEach(a => {
      const isSearch = /^\s*search\s*$/i.test(a.textContent) || a.getAttribute('aria-label') === 'Search';
      if (isSearch) { hasTrigger = true; a.addEventListener('click', (e) => { e.preventDefault(); open(); }); }
    });
  });
  // "/" opens search only on shop pages (pages that have a Search link)
  document.addEventListener('keydown', (e) => {
    if (hasTrigger && e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || ''))) { e.preventDefault(); open(); }
  });
})();

/* ——— SHOP ACCOUNTS (demo) — makes Log In / Join work until Shopify
   customer accounts replace it. Stores the account in this browser. ——— */
(function () {
  const KEY = 'bpsAccount';
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } }
  let built = false;

  function labelAll() {
    const acc = get();
    document.querySelectorAll('a.auth').forEach(a => {
      if (acc) a.innerHTML = 'Hi, ' + (acc.name.split(' ')[0] || 'you');
      // default markup left as-is when signed out
    });
  }

  function build() {
    if (built) return;
    built = true;
    const el = document.createElement('div');
    el.innerHTML = '<div style="position:fixed;inset:0;z-index:100000;display:none;background:rgba(15,15,15,0.55);backdrop-filter:blur(6px)" id="bpsAccScrim">'
      + '<div style="max-width:420px;margin:14vh auto 0;padding:40px;background:#FAFAFA;border:1px solid #0F0F0F;color:#0F0F0F" id="bpsAccPanel"></div></div>';
    document.body.appendChild(el.firstChild);
    document.getElementById('bpsAccScrim').addEventListener('click', (e) => { if (e.target.id === 'bpsAccScrim') close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function renderPanel() {
    const p = document.getElementById('bpsAccPanel');
    const acc = get();
    if (acc) {
      p.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#6B6B6B;font-weight:600">Your account</span><button onclick="document.getElementById(\'bpsAccScrim\').style.display=\'none\'" style="background:none;border:0;font-size:20px;cursor:pointer" aria-label="Close">&times;</button></div>'
        + '<h3 style="font-family:\'Fraunces\',serif;font-weight:400;font-size:26px;margin:18px 0 4px">' + acc.name + '</h3>'
        + '<p style="font-size:13px;color:#6B6B6B;margin:0 0 24px">' + acc.email + '</p>'
        + '<p style="font-size:12.5px;color:#6B6B6B;font-style:italic;line-height:1.6;margin-bottom:28px">Order history, saved details, and early drop access arrive when the full store launches. Your cart already saves itself on this device.</p>'
        + '<button id="bpsAccOut" style="padding:14px 28px;background:#0F0F0F;color:#FAFAFA;border:0;font-size:10px;letter-spacing:.35em;text-transform:uppercase;font-weight:600;cursor:pointer">Log out</button>';
      document.getElementById('bpsAccOut').addEventListener('click', () => {
        localStorage.removeItem(KEY); close(); location.reload();
      });
    } else {
      p.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#6B6B6B;font-weight:600">Log in / Join</span><button onclick="document.getElementById(\'bpsAccScrim\').style.display=\'none\'" style="background:none;border:0;font-size:20px;cursor:pointer" aria-label="Close">&times;</button></div>'
        + '<h3 style="font-family:\'Fraunces\',serif;font-weight:400;font-size:26px;margin:18px 0 24px">Join the <em style="color:#1D5FB8">watchers.</em></h3>'
        + '<form id="bpsAccForm">'
        + '<label style="display:block;font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:#6B6B6B;font-weight:500;margin-bottom:8px">Name</label>'
        + '<input id="bpsAccName" required style="width:100%;font:inherit;font-size:15px;padding:10px 2px;border:0;border-bottom:1px solid #B0B0B0;background:transparent;outline:none;margin-bottom:22px">'
        + '<label style="display:block;font-size:10px;letter-spacing:.35em;text-transform:uppercase;color:#6B6B6B;font-weight:500;margin-bottom:8px">Email</label>'
        + '<input id="bpsAccEmail" type="email" required style="width:100%;font:inherit;font-size:15px;padding:10px 2px;border:0;border-bottom:1px solid #B0B0B0;background:transparent;outline:none;margin-bottom:30px">'
        + '<button type="submit" style="width:100%;padding:16px;background:#0F0F0F;color:#FAFAFA;border:0;font-size:10px;letter-spacing:.35em;text-transform:uppercase;font-weight:600;cursor:pointer">Continue &rarr;</button>'
        + '</form>'
        + '<p style="font-size:11px;color:#6B6B6B;font-style:italic;margin-top:18px;line-height:1.5">One step, no password. Full accounts (orders, addresses, drop history) arrive with the store launch.</p>';
      document.getElementById('bpsAccForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const acc = { name: document.getElementById('bpsAccName').value.trim(), email: document.getElementById('bpsAccEmail').value.trim() };
        try { localStorage.setItem(KEY, JSON.stringify(acc)); } catch (_) {}
        // also feed the newsletter endpoint if configured
        const ep = (window.BPS_CONFIG || {}).newsletterEndpoint;
        if (ep) fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ email: acc.email, name: acc.name, source: 'account-join' }) }).catch(() => {});
        labelAll(); renderPanel();
      });
    }
  }
  function open() { build(); renderPanel(); document.getElementById('bpsAccScrim').style.display = 'block'; }
  function close() { const s = document.getElementById('bpsAccScrim'); if (s) s.style.display = 'none'; }

  document.addEventListener('DOMContentLoaded', () => {
    labelAll();
    document.querySelectorAll('a.auth').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });
  });
})();

/* ——— THE FREQUENCY — type the name of the one at the door. ——— */
(function () {
  let buf = '';
  document.addEventListener('keydown', (e) => {
    if (/input|textarea|select/i.test(e.target.tagName || '')) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf === 'ashen') window.location.href = 'signal-30hz.html';
  });
})();

/* ——— SOCIAL LINKS — set from the admin console (Social Links).
   Any element tagged data-social="youtube|x|instagram|reddit|bluesky|
   tiktok|vrchat|discord" gets its href from the saved links. ——— */
(function () {
  // Published links (socials.js → window.BPS_SOCIALS) as the base, with the
  // admin console's in-browser saves (localStorage) layered on top for preview.
  let links = {};
  try { links = Object.assign({}, (window.BPS_SOCIALS || {})); } catch (_) {}
  try { Object.assign(links, JSON.parse(localStorage.getItem('bpsSocialLinks') || '{}')); } catch (_) {}
  function isRealUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u.trim()); }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-social]').forEach(function (a) {
      const url = links[a.getAttribute('data-social')];
      if (isRealUrl(url)) {
        a.href = url.trim();
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.removeAttribute('data-placeholder');   // a real link is no longer a placeholder
        a.removeAttribute('aria-disabled');
      } else {
        // Not configured yet — mark as placeholder and stop the "#" href from
        // reloading the page when clicked.
        a.setAttribute('data-placeholder', '');
        a.setAttribute('aria-disabled', 'true');
        a.addEventListener('click', function (e) { e.preventDefault(); });
      }
    });
  });
})();

/* ——— COPY EDITOR — page-by-page in-place text editing.
   Overrides saved from edit mode are re-applied on every load, so copy
   changes show without touching the HTML. To publish for all visitors,
   use "Export" in the admin console and bake the text into the page.
   Enter edit mode: open any page with #bps-edit (the admin console has
   one-click links), or the admin "Copy Editor" tab. ——— */
(function () {
  const KEY = 'bpsCopyOverrides';
  const page = (location.pathname.split('/').pop() || 'index.html');
  const SEL = 'h1,h2,h3,h4,p,li,blockquote,.lede,.sub,.tagline,.blurb,.logline,.kicker,.eyebrow,.drop';
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function put(o) { localStorage.setItem(KEY, JSON.stringify(o)); }
  function editable() {
    return Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (el) {
      if (el.closest('nav, .nav, .meta-bar, script, style, .legal, #bpsCopyBar')) return false;
      if (el.querySelector(SEL)) return false;              // only leaf text blocks
      return el.textContent.trim().length > 0;
    });
  }
  function keyOf(i) { return page + '::' + i; }

  // Re-apply saved overrides on every load
  (function apply() {
    const o = store(), els = editable();
    els.forEach(function (el, i) { const k = keyOf(i); if (o[k] != null) el.innerHTML = o[k]; });
  })();

  // Edit mode
  if (location.hash === '#bps-edit') enterEditMode();
  function enterEditMode() {
    const els = editable();
    els.forEach(function (el) { el.setAttribute('contenteditable', 'true'); el.style.outline = '1px dashed rgba(107,180,232,.6)'; el.style.outlineOffset = '3px'; });
    const bar = document.createElement('div');
    bar.id = 'bpsCopyBar';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:200000;background:#02040A;border-top:1px solid #1D5FB8;color:#CFD9E4;font-family:Inter,sans-serif;font-size:12px;letter-spacing:.05em;display:flex;gap:14px;align-items:center;justify-content:center;padding:12px';
    bar.innerHTML = '<span style="color:#6BB4E8;letter-spacing:.3em;text-transform:uppercase;font-size:10px;font-weight:600">Copy edit mode</span>'
      + '<span style="color:#8B929C">Click any text to edit it.</span>'
      + '<button id="bpsCopySave" style="padding:8px 18px;background:#CFD9E4;color:#02040A;border:0;font-weight:600;font-size:10px;letter-spacing:.3em;text-transform:uppercase;cursor:pointer">Save</button>'
      + '<button id="bpsCopyReset" style="padding:8px 18px;background:transparent;color:#C94F4F;border:1px solid #C94F4F;font-size:10px;letter-spacing:.3em;text-transform:uppercase;cursor:pointer">Reset page</button>'
      + '<button id="bpsCopyExit" style="padding:8px 18px;background:transparent;color:#8B929C;border:1px solid #132341;font-size:10px;letter-spacing:.3em;text-transform:uppercase;cursor:pointer">Exit</button>';
    document.body.appendChild(bar);
    document.body.style.paddingBottom = '64px';
    document.getElementById('bpsCopySave').onclick = function () {
      const o = store();
      editable().forEach(function (el, i) { o[keyOf(i)] = el.innerHTML; });
      put(o);
      this.textContent = 'Saved ✓';
      setTimeout(function () { location.hash = ''; location.reload(); }, 600);
    };
    document.getElementById('bpsCopyReset').onclick = function () {
      if (!confirm('Reset all copy on this page to the original?')) return;
      const o = store();
      Object.keys(o).forEach(function (k) { if (k.indexOf(page + '::') === 0) delete o[k]; });
      put(o);
      location.hash = ''; location.reload();
    };
    document.getElementById('bpsCopyExit').onclick = function () { location.hash = ''; location.reload(); };
  }
})();

/* Placeholder mode — flag is set from the admin console (Site Settings).
   When on, content tagged data-placeholder is hidden sitewide. */
(function () {
  try {
    if (localStorage.getItem('bpsHidePlaceholders') === '1') {
      document.documentElement.classList.add('bps-hide-ph');
    }
  } catch (_) {}
})();

(function () {
  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;

  // Remove the .entering class after the fade-from-black completes so
  // the overlay returns to opacity 0 / pointer-events none cleanly.
  if (overlay.classList.contains('entering')) {
    setTimeout(() => overlay.classList.remove('entering'), 650);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  // Intercept same-origin navigation, fade overlay, then navigate.
  document.addEventListener('click', (e) => {
    // Ignore clicks with modifier keys (open new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;

    // Hash, mailto, tel, javascript — pass through
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

    // External http(s) link — pass through
    if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (u.host !== location.host) return;
      } catch (_) { return; }
    }

    // Open-in-new-tab links — pass through
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    // Same-document anchor — pass through
    try {
      const u = new URL(link.href, location.href);
      if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search) return;
    } catch (_) {}

    // Fade and navigate
    e.preventDefault();
    overlay.classList.add('fade-in');
    setTimeout(() => { window.location.href = link.href; }, 320);
  });

  // If the user navigates back via browser, ensure the overlay clears
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) overlay.classList.remove('fade-in');
  });
})();
