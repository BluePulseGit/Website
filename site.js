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
  /* Email signups → Google Form → "Email Subscribers" Google Sheet.
     Owned by production@bluepulsestudios.com. To point at a different list,
     replace url (…/formResponse) and entry (the email field's entry.NNN id). */
  newsletterForm: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSebZPJdrO4G_EMzjJ7bv9MLmfdw4-4Hb5qqOPJq0ml4j2Av5g/formResponse',
    entry: 'entry.102606424'
  },
  /* Contact messages → Google Form → "Contact Messages" sheet, with email
     notifications on, so every message emails production@bluepulsestudios.com. */
  contactForm: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSejJW7RjUpfBITdCfb1A5iE9e_cSzKw6ODYFPZhBJOc5s_NLA/formResponse',
    name: 'entry.696436405',
    email: 'entry.291236150',
    topic: 'entry.261309725',
    message: 'entry.1902630884'
  },
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

/* Newsletter signup — used by every email form on the site.
   Accepts either a <form> element (shop/product pages) OR an (email, source)
   pair (footer, account join). Preferred target is the Google Form → Sheet
   (newsletterForm); falls back to a JSON endpoint (newsletterEndpoint). */
window.bpsSubscribe = function (formOrEmail, ev) {
  let email = '', source = 'newsletter', form = null, btn = null;
  if (typeof formOrEmail === 'string') {
    email = formOrEmail.trim();
    source = (typeof ev === 'string' && ev) ? ev : 'newsletter';
  } else if (formOrEmail && formOrEmail.querySelector) {
    form = formOrEmail;
    if (ev && ev.preventDefault) ev.preventDefault();
    const input = form.querySelector('input[type=email]');
    email = input ? input.value.trim() : '';
    btn = form.querySelector('button');
  }
  const cfg = window.BPS_CONFIG || {};
  const gf = cfg.newsletterForm, ep = cfg.newsletterEndpoint;
  const done = () => { if (btn) { btn.textContent = 'Subscribed ✓'; btn.disabled = true; } };
  if (!email) { done(); return false; }
  if (btn) btn.textContent = '…';
  /* Preferred: Google Form → "Email Subscribers" Sheet (fire-and-forget) */
  if (gf && gf.url && gf.entry) {
    const body = new URLSearchParams();
    body.append(gf.entry, email);
    if (source) body.append('bps_source', source); // ignored by the form; here for future fields
    fetch(gf.url, { method: 'POST', mode: 'no-cors', body: body }).catch(function () {});
    done();
    return false;
  }
  /* Fallback: JSON endpoint (Formspree / Mailchimp / Buttondown) */
  if (ep) {
    fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: email, source: source })
    }).then(r => { r.ok ? done() : (btn && (btn.textContent = 'Try again')); })
      .catch(() => { if (btn) btn.textContent = 'Try again'; });
    return false;
  }
  done();
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
        // also add them to the subscriber list (Email Subscribers sheet)
        try { if (window.bpsSubscribe && acc.email) window.bpsSubscribe(acc.email, 'account-join'); } catch (_) {}
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

/* ——— "TRANSMISSION RECEIVED" — reusable send confirmation.
   Call window.bpsTransmission('Transmission received.') after any form sends:
   a full-screen blue pulse of light with big type so the user knows it went. ——— */
(function () {
  let injected = false;
  function inject() {
    if (injected) return; injected = true;
    const s = document.createElement('style');
    s.textContent =
      '@keyframes bpsTxPulse{0%{transform:translate(-50%,-50%) scale(.3);opacity:.9}70%{opacity:.22}100%{transform:translate(-50%,-50%) scale(2.7);opacity:0}}' +
      '@keyframes bpsTxIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
      '#bpsTx{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(2,4,10,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .4s}' +
      '#bpsTx.on{opacity:1}' +
      '#bpsTx .ring{position:absolute;top:50%;left:50%;width:200px;height:200px;border-radius:50%;border:2px solid #6BB4E8;box-shadow:0 0 70px rgba(107,180,232,.75);animation:bpsTxPulse 1.9s ease-out infinite}' +
      '#bpsTx .ring:nth-child(2){animation-delay:.63s}#bpsTx .ring:nth-child(3){animation-delay:1.26s}' +
      '#bpsTx .msg{position:relative;z-index:2;text-align:center;color:#FAFAFA;font-family:"Fraunces",Georgia,serif;font-weight:300;font-size:clamp(30px,5.5vw,56px);letter-spacing:.01em;animation:bpsTxIn .6s ease .1s both;text-shadow:0 0 46px rgba(107,180,232,.55)}' +
      '#bpsTx .sub{margin-top:16px;font-family:"Inter",sans-serif;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:#6BB4E8;font-weight:500}';
    document.head.appendChild(s);
  }
  window.bpsTransmission = function (msg) {
    inject();
    const old = document.getElementById('bpsTx'); if (old) old.remove();
    const o = document.createElement('div');
    o.id = 'bpsTx';
    o.setAttribute('role', 'status');
    o.setAttribute('aria-live', 'assertive');
    o.innerHTML = '<div class="ring"></div><div class="ring"></div><div class="ring"></div>' +
      '<div class="msg">' + (msg || 'Transmission received.') + '<div class="sub">Blue Pulse Studios</div></div>';
    document.body.appendChild(o);
    requestAnimationFrame(function () { o.classList.add('on'); });
    function close() { o.classList.remove('on'); setTimeout(function () { if (o.parentNode) o.remove(); }, 400); }
    o.addEventListener('click', close);
    setTimeout(close, 3200);
  };
})();

/* ——— SHARED: social icons + links. Used by the nav, the mobile menu and the
   footer so every surface shows the same set (no per-page socials.js needed). */
window.BPS_SOCIAL = (function () {
  var ICONS = {
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.3-.4-4.9a2.6 2.6 0 0 0-1.8-1.8C19.1 5 12 5 12 5s-7.1 0-8.8.3A2.6 2.6 0 0 0 1.4 7.1C1 8.7 1 12 1 12s0 3.3.4 4.9a2.6 2.6 0 0 0 1.8 1.8C4.9 19 12 19 12 19s7.1 0 8.8-.3a2.6 2.6 0 0 0 1.8-1.8C23 15.3 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.5 2h6.7l4.7 6.2L18.9 2zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a2.1 2.1 0 0 0-3.6-1.5 10.3 10.3 0 0 0-5.3-1.7l.9-4.2 3 .7a1.5 1.5 0 1 0 .2-1l-3.4-.8a.5.5 0 0 0-.6.4l-1 4.7a10.4 10.4 0 0 0-5.4 1.7A2.1 2.1 0 1 0 3.6 14v.6c0 3.1 3.8 5.6 8.4 5.6s8.4-2.5 8.4-5.6V14A2.1 2.1 0 0 0 22 12zM8 13.5A1.4 1.4 0 1 1 9.4 15 1.4 1.4 0 0 1 8 13.5zm7.6 3.9a5.3 5.3 0 0 1-3.6 1.1 5.3 5.3 0 0 1-3.6-1.1.4.4 0 0 1 .6-.6 4.6 4.6 0 0 0 3 .9 4.6 4.6 0 0 0 3-.9.4.4 0 1 1 .6.6zm-.9-2.5A1.4 1.4 0 1 1 16 13a1.4 1.4 0 0 1-1.3 1.9z"/></svg>',
    bluesky: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.8C10.9 8.6 7.9 4.7 5.1 3.1 3.8 2.3 2 2 2 4.2c0 1.3.8 5.6 1.2 6.3.6 1.2 1.8 1.5 3 1.3-2 .3-3.7 1-1.4 3.6 2.5 2.6 3.5-.7 4-2.4l.2-1 .3 1c.5 1.7 1.5 5 4 2.4 2.3-2.6.6-3.3-1.4-3.6 1.2.2 2.4-.1 3-1.3.4-.7 1.2-5 1.2-6.3 0-2.2-1.8-1.9-3.1-1.1C16.1 4.7 13.1 8.6 12 10.8z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2 1.5 3.6 3.5 3.9v2.6a6.6 6.6 0 0 1-3.5-1v5.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.9 2.9 0 1 0 2 2.8V3h2.7z"/></svg>',
    vrchat: '<span class="bps-vrc" aria-hidden="true"></span>',
    discord: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4a18.3 18.3 0 0 1 4.3 1.4 16.6 16.6 0 0 0-14 0A18.3 18.3 0 0 1 9.8 3.4L9.6 3a19.8 19.8 0 0 0-4.9 1.4A20.7 20.7 0 0 0 1.3 18a19.9 19.9 0 0 0 6 3l.5-.7a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.4 0l.5.4a13 13 0 0 1-2 1l.5.7a19.9 19.9 0 0 0 6-3 20.7 20.7 0 0 0-3.4-13.6zM8.5 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>'
  };
  var LABELS = { youtube: 'YouTube', x: 'X', instagram: 'Instagram', reddit: 'Reddit', bluesky: 'Bluesky', tiktok: 'TikTok', vrchat: 'VRChat', discord: 'Discord' };
  var ORDER = ['youtube', 'instagram', 'x', 'tiktok', 'bluesky', 'reddit', 'discord', 'vrchat'];
  /* Baked-in defaults so every page has icons even without socials.js */
  var DEFAULTS = {
    youtube: 'https://www.youtube.com/@BluePulseStudios',
    x: 'https://x.com/BluePulseFilms',
    instagram: 'https://www.instagram.com/bluepulsestudios',
    reddit: 'https://www.reddit.com/r/BluePulseStudios',
    bluesky: 'https://bsky.app/profile/bluepulsestudios.bsky.social',
    tiktok: 'https://www.tiktok.com/@bluepulsefilms',
    vrchat: 'https://vrc.group/HELLFR.8091',
    discord: 'https://discord.gg/mYrKDjGUQ2'
  };
  function links() {
    var m = {}; Object.assign(m, DEFAULTS);
    try { Object.assign(m, window.BPS_SOCIALS || {}); } catch (_) {}
    try { Object.assign(m, JSON.parse(localStorage.getItem('bpsSocialLinks') || '{}')); } catch (_) {}
    return m;
  }
  function row(cls) {
    var L = links();
    return ORDER.filter(function (k) { var u = L[k]; return typeof u === 'string' && /^https?:\/\//i.test(u); })
      .map(function (k) {
        return '<a href="' + L[k].trim() + '" target="_blank" rel="noopener noreferrer" aria-label="' + LABELS[k] + '" title="' + LABELS[k] + '">' + ICONS[k] + '</a>';
      }).join('');
  }
  return { ICONS: ICONS, LABELS: LABELS, ORDER: ORDER, links: links, row: row };
})();

/* ——— PAGE VISIBILITY — pages hidden from the admin are noindexed, dropped from
   the nav/footer, and show a "not available" notice if opened directly. ——— */
/* Pages hidden from the public site. Edit in the admin "Page Visibility" tab
   (preview), then paste its export here to apply for everyone. */
window.BPS_HIDDEN_PAGES = ['books.html'];
window.BPS_HIDDEN = (function () {
  function list() {
    var a = [];
    try { if (Array.isArray(window.BPS_HIDDEN_PAGES)) a = a.concat(window.BPS_HIDDEN_PAGES); } catch (_) {}
    try { var ls = JSON.parse(localStorage.getItem('bpsHiddenPages') || 'null'); if (Array.isArray(ls)) a = ls; } catch (_) {}
    return a.map(function (s) { return String(s).toLowerCase(); });
  }
  function isHidden(href) {
    if (!href) return false;
    var file = String(href).split('/').pop().split('#')[0].split('?')[0].toLowerCase();
    if (!file) return false;
    return list().indexOf(file) >= 0;
  }
  return { list: list, isHidden: isHidden };
})();
(function () {
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!here.endsWith('.html')) here += '.html';
  if (!window.BPS_HIDDEN.isHidden(here)) return;
  var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow';
  document.head.appendChild(m);
  document.addEventListener('DOMContentLoaded', function () {
    var main = document.querySelector('main, section, .hero') && document.body;
    if (!main) return;
    Array.prototype.forEach.call(document.querySelectorAll('body > *'), function (el) {
      if (el.tagName === 'NAV' || el.tagName === 'FOOTER' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      el.style.display = 'none';
    });
    var box = document.createElement('div');
    box.style.cssText = 'min-height:74vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:160px 24px 90px;font-family:Inter,sans-serif';
    box.innerHTML = '<div><div style="font-size:10.5px;letter-spacing:.5em;text-transform:uppercase;color:#6BB4E8;font-weight:500;margin-bottom:20px">Coming soon</div>' +
      '<h1 style="font-family:Fraunces,Georgia,serif;font-weight:300;font-size:clamp(32px,5vw,60px);color:#CFD9E4;margin:0 0 16px">This page isn&rsquo;t live yet.</h1>' +
      '<p style="font-family:Fraunces,Georgia,serif;font-style:italic;color:#8B929C;font-size:16px;margin:0 0 30px">Check back soon &mdash; or follow along in the community.</p>' +
      '<a href="homepage.html" style="display:inline-block;border:1px solid #CFD9E4;color:#CFD9E4;text-decoration:none;padding:16px 30px;font-size:10.5px;letter-spacing:.4em;text-transform:uppercase">Back to the site &rarr;</a></div>';
    document.body.insertBefore(box, document.querySelector('footer'));
  });
})();

/* ——— CANONICAL NAV — one nav for the whole site (desktop + mobile), rendered
   here so order, dropdowns and the mobile menu stay identical everywhere. ——— */
(function () {
  var ITEMS = [
    { label: 'Projects', href: 'films.html', children: [
      { label: 'Films', href: 'films.html' },
      { label: 'Television', href: 'television.html' },
      { label: 'Books', href: 'books.html' }
    ] },
    { label: 'Studio', href: 'studio.html', children: [
      { label: 'About Us', href: 'about.html' },
      { label: 'Press', href: 'press.html' },
      { label: 'Newswire', href: 'journal.html' }
    ] },
    { label: 'Shop', href: 'shop.html' },
    { label: 'Community', href: 'community.html' },
    { label: 'Contact', href: 'contact.html' }
  ];
  var CARET = '<svg class="bps-caret" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 1.5 5 5 9 1.5"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.nav');
    var links = nav && nav.querySelector('.links');
    if (!nav || !links || nav.querySelector('.bps-burger')) return;

    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var hidden = window.BPS_HIDDEN;

    var st = document.createElement('style');
    st.textContent =
      /* shared / desktop */
      '.nav .links{display:flex;align-items:center}' +
      '.nav .links a,.nav .links .bps-top{text-shadow:0 1px 3px rgba(0,0,0,.55),0 0 14px rgba(0,0,0,.35)}' +
      '.bps-nav-item{position:relative;display:inline-block;margin-left:28px}' +
      '.bps-nav-item > a{margin-left:0 !important;display:inline-flex;align-items:center;gap:6px}' +
      '.bps-caret{width:9px;height:6px;flex:none;opacity:.8;transition:transform .3s}' +
      '.bps-nav-item:hover .bps-caret,.bps-nav-item:focus-within .bps-caret{transform:rotate(180deg)}' +
      '.bps-sub{position:absolute;top:100%;left:50%;transform:translateX(-50%) translateY(6px);min-width:186px;background:rgba(2,4,10,.97);border:1px solid #132341;padding:8px 0;opacity:0;visibility:hidden;transition:opacity .3s,transform .3s;z-index:200}' +
      '.bps-nav-item:hover .bps-sub,.bps-nav-item:focus-within .bps-sub{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}' +
      '.bps-sub a{display:block;margin:0 !important;padding:11px 22px;color:#8B929C;font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;white-space:nowrap;transition:color .3s,background .3s;text-shadow:none}' +
      '.bps-sub a:hover{color:#CFD9E4;background:rgba(29,95,184,.12)}' +
      '.bps-mob-only{display:none}' +
      '.bps-burger{display:none;background:none;border:0;color:#CFD9E4;cursor:pointer;padding:8px;margin-left:18px;z-index:130}' +
      '.bps-burger svg{width:26px;height:26px;display:block}' +
      '#bpsNavScrim{position:fixed;inset:0;background:rgba(2,4,10,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .3s;z-index:110}' +
      '#bpsNavScrim.on{opacity:1;visibility:visible}' +
      /* mobile */
      '@media (max-width:860px){' +
        '.nav .bps-burger{display:block}' +
        '.nav .links{position:fixed !important;top:0;right:0;height:100dvh;width:min(86vw,340px);background:#02040A;border-left:1px solid #132341;display:flex !important;flex-direction:column !important;align-items:stretch !important;justify-content:flex-start;gap:0;padding:76px 24px 32px;transform:translateX(101%);transition:transform .34s cubic-bezier(.2,.7,.2,1);overflow-y:auto;z-index:120}' +
        '.nav .links.bps-open{transform:none}' +
        '.bps-nav-item{display:block;margin:0 !important;width:100%;border-bottom:1px solid #101d33}' +
        '.bps-nav-item > a,.nav .links > a{display:flex !important;align-items:center;justify-content:space-between;width:100%;margin:0 !important;padding:16px 2px !important;font-size:12.5px !important;letter-spacing:.24em;color:#CFD9E4 !important}' +
        '.nav .links > a{border-bottom:1px solid #101d33}' +
        '.bps-caret{width:12px;height:8px;transition:transform .3s}' +
        '.bps-nav-item.bps-exp .bps-caret{transform:rotate(180deg)}' +
        '.bps-sub{position:static !important;transform:none !important;opacity:1 !important;visibility:visible !important;background:none !important;border:0 !important;padding:0 !important;min-width:0 !important;max-height:0;overflow:hidden;transition:max-height .35s ease}' +
        '.bps-nav-item.bps-exp .bps-sub{max-height:340px;padding:0 0 10px !important}' +
        '.bps-sub a{padding:11px 0 11px 16px !important;font-size:10px;color:#8B929C !important}' +
        '.bps-mob-only{display:block}' +
        '#bpsNavClose{position:absolute;top:20px;right:20px;background:none;border:0;color:#8B929C;cursor:pointer;padding:6px;line-height:1}' +
        '#bpsNavClose svg{width:22px;height:22px;display:block}' +
        '#bpsNavClose:hover{color:#CFD9E4}' +
        '#bpsNavSocials{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:28px;padding-top:22px;border-top:1px solid #101d33}' +
        '#bpsNavSocials a{color:#8B929C;display:inline-flex;margin:0 !important;padding:0 !important;transition:color .3s}' +
        '#bpsNavSocials a:hover{color:#CFD9E4}' +
        '#bpsNavSocials svg{width:20px;height:20px}' +
        '#bpsNavCart{margin:18px 0 0 !important}' +
      '}';
    document.head.appendChild(st);

    /* build the link list */
    var html = ITEMS.map(function (it) {
      var kids = (it.children || []).filter(function (c) { return !hidden.isHidden(c.href); });
      var on = (here === it.href.toLowerCase()) || kids.some(function (c) { return here === c.href.toLowerCase(); });
      if (!kids.length) {
        if (hidden.isHidden(it.href)) return '';
        return '<a href="' + esc(it.href) + '"' + (on ? ' class="on"' : '') + '>' + esc(it.label) + '</a>';
      }
      return '<span class="bps-nav-item">' +
        '<a href="' + esc(it.href) + '"' + (on ? ' class="on"' : '') + '>' + esc(it.label) + CARET + '</a>' +
        '<div class="bps-sub" role="menu">' + kids.map(function (c) {
          return '<a href="' + esc(c.href) + '" role="menuitem">' + esc(c.label) + '</a>';
        }).join('') + '</div>' +
      '</span>';
    }).join('');

    links.innerHTML =
      '<button type="button" id="bpsNavClose" class="bps-mob-only" aria-label="Close menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
      html +
      '<div id="bpsNavSocials" class="bps-mob-only">' + window.BPS_SOCIAL.row() + '</div>';

    var burger = document.createElement('button');
    burger.className = 'bps-burger'; burger.type = 'button';
    burger.setAttribute('aria-label', 'Menu'); burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    nav.appendChild(burger);

    var scrim = document.createElement('div');
    scrim.id = 'bpsNavScrim';
    document.body.appendChild(scrim);

    function setOpen(open) {
      links.classList.toggle('bps-open', open);
      scrim.classList.toggle('on', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setOpen(!links.classList.contains('bps-open')); });
    document.getElementById('bpsNavClose').addEventListener('click', function () { setOpen(false); });
    scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

    /* mobile: tapping a parent toggles its submenu instead of navigating */
    links.addEventListener('click', function (e) {
      var isMobile = window.matchMedia('(max-width:860px)').matches;
      var parentLink = e.target.closest('.bps-nav-item > a');
      if (isMobile && parentLink) {
        e.preventDefault();
        parentLink.parentNode.classList.toggle('bps-exp');
        return;
      }
      if (e.target.closest('a')) setOpen(false);
    });
  });
})();

/* ——— PERSISTENT CART — a cart icon in the nav (right of Contact) on every
   page, reading the shared localStorage cart so an abandoned cart is always
   one click away from anywhere on the site. ——— */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var links = document.querySelector('.nav .links');
    if (!links) return;
    if (document.getElementById('bpsNavCart') || document.getElementById('navCartBtn')) return; // shop pages already have one
    var count = 0;
    try { count = (JSON.parse(localStorage.getItem('bpsCart') || '[]')).reduce(function (s, it) { return s + (it.qty || 0); }, 0); } catch (_) {}
    if (!document.getElementById('bpsCartCss')) {
      var st = document.createElement('style'); st.id = 'bpsCartCss';
      st.textContent =
        '#bpsNavCart{margin-left:28px;color:#8B929C;display:inline-flex;align-items:center;gap:7px;text-decoration:none;transition:color .5s;position:relative}' +
        '#bpsNavCart:hover{color:#CFD9E4}' +
        '#bpsNavCart svg{width:16px;height:16px}' +
        '#bpsNavCart .n{font-size:9px;letter-spacing:.06em;font-weight:600;color:#6BB4E8}' +
        '@media (max-width:700px){#bpsNavCart{margin-left:14px}}';
      document.head.appendChild(st);
    }
    var a = document.createElement('a');
    a.id = 'bpsNavCart'; a.href = 'cart.html'; a.setAttribute('aria-label', 'Cart' + (count ? ' (' + count + ' items)' : ''));
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="n">' + (count ? count : '') + '</span>';
    links.appendChild(a);
  });
})();

/* ——— COOKIE CONSENT — Allow / Allow essential only / Deny. Stores the choice
   in localStorage (bpsCookieConsent); non-essential scripts (e.g. analytics)
   check window.bpsConsent() === 'all' before loading. ——— */
(function () {
  var KEY = 'bpsCookieConsent';
  function saved() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  window.bpsConsent = function () { return saved(); };
  document.addEventListener('DOMContentLoaded', function () {
    if (saved()) return;
    var css = document.createElement('style');
    css.textContent =
      '#bpsCookie{position:fixed;left:0;right:0;bottom:0;z-index:9000;background:rgba(2,4,10,.97);border-top:1px solid #132341;padding:18px 24px;display:flex;flex-wrap:wrap;align-items:center;gap:18px;justify-content:center;font-family:Inter,sans-serif;animation:bpsCookieUp .5s ease both}' +
      '@keyframes bpsCookieUp{from{transform:translateY(100%)}to{transform:none}}' +
      '#bpsCookie p{color:#8B929C;font-size:12px;line-height:1.5;max-width:620px;margin:0}' +
      '#bpsCookie p a{color:#6BB4E8;text-decoration:none;border-bottom:1px solid #6BB4E8}' +
      '#bpsCookie .btns{display:flex;gap:10px;flex-wrap:wrap}' +
      '#bpsCookie button{cursor:pointer;font-family:Inter,sans-serif;font-size:9.5px;letter-spacing:.26em;text-transform:uppercase;font-weight:500;padding:11px 18px;border:1px solid #132341;background:transparent;color:#8B929C;transition:color .3s,border-color .3s,background .3s}' +
      '#bpsCookie button:hover{color:#CFD9E4;border-color:#6BB4E8}' +
      '#bpsCookie button.primary{background:#6BB4E8;color:#04121d;border-color:#6BB4E8}' +
      '#bpsCookie button.primary:hover{filter:brightness(1.08);color:#04121d}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.id = 'bpsCookie'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<p>We use cookies to run the site and, with your OK, to understand how it&rsquo;s used. Choose what you&rsquo;re comfortable with. <a href="privacy.html">Privacy policy</a>.</p>' +
      '<div class="btns"><button data-c="deny">Deny</button><button data-c="essential">Allow essential only</button><button class="primary" data-c="all">Allow</button></div>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      try { localStorage.setItem(KEY, b.getAttribute('data-c')); } catch (_) {}
      bar.remove();
      window.dispatchEvent(new CustomEvent('bps-consent', { detail: b.getAttribute('data-c') }));
    });
  });
})();

/* ——— FOOTER BAND — mailing-list signup + minimalist social icons, injected
   into every page's footer so they stay consistent from one place (here). ——— */
(function () {
  var ICONS = window.BPS_SOCIAL.ICONS, LABELS = window.BPS_SOCIAL.LABELS, ORDER = window.BPS_SOCIAL.ORDER;
  function socials() { return window.BPS_SOCIAL.links(); }
  /* Footer content is config-driven — edit it in the admin Footer tab. Order:
     localStorage bpsFooter (admin preview) → window.BPS_FOOTER (published) → default. */
  var DEFAULT_FOOTER = {
    align: 'left',
    blurb: 'An independent studio for horror and genre film, television, books, and games, based in Los Angeles and Pittsburgh.',
    signup: 'Get our emails, transmissions, podcasts, interviews with creators, and more — delivered straight to you.',
    columns: [
      { heading: 'Projects', links: [ { label: 'Films', href: 'films.html' }, { label: 'Television', href: 'moth-country.html' }, { label: 'Books', href: 'books.html' } ] },
      { heading: 'Shop', links: [ { label: 'All', href: 'shop.html' }, { label: 'Cart', href: 'cart.html' } ] },
      { heading: 'Studio', links: [ { label: 'About Us', href: 'about.html' }, { label: 'Press', href: 'press.html' }, { label: 'Newswire', href: 'journal.html' }, { label: 'Contact', href: 'contact.html' } ] }
    ],
    bottom: {
      copyright: '© 2026 Blue Pulse Studios',
      location: 'Los Angeles · Pittsburgh',
      legal: [ { label: 'Privacy', href: 'privacy.html' }, { label: 'Terms', href: 'terms.html' }, { label: 'Shipping & Returns', href: 'shipping-returns.html' } ]
    }
  };
  function footerCfg() {
    try { var ls = JSON.parse(localStorage.getItem('bpsFooter') || 'null'); if (ls && ls.columns) return ls; } catch (_) {}
    try { if (window.BPS_FOOTER && window.BPS_FOOTER.columns) return window.BPS_FOOTER; } catch (_) {}
    return DEFAULT_FOOTER;
  }
  function fesc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bpsFooterBand')) return;
    var footer = document.querySelector('footer');
    if (!footer) { footer = document.createElement('footer'); document.body.appendChild(footer); }

    var st = document.createElement('style');
    st.textContent =
      /* ONE canonical footer, rendered from here so it's identical on every page */
      /* hard reset so per-page footer rules (uppercase, letter-spacing, tiny
         font-size) can't leak in and make the footer look different per page */
      'footer{padding:0!important;margin:0!important;background:#02040A!important;color:#8B929C!important;border-top:1px solid #132341!important;text-align:left!important;font-size:14px!important;letter-spacing:normal!important;text-transform:none!important;font-style:normal!important;font-weight:400!important;line-height:1.5!important}' +
      'footer .bps-foot,footer .bps-foot *{letter-spacing:normal;text-transform:none;font-style:normal}' +
      'footer .bps-foot{max-width:1240px;margin:0 auto;padding:88px 48px 52px;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px}' +
      'footer .bps-foot .bps-foot-top{display:flex;flex-wrap:wrap;gap:44px 60px;margin-bottom:44px;align-items:flex-start}' +
      'footer .bps-foot .brand-col{flex:2 1 300px}' +
      'footer .bps-foot .fcol{flex:1 1 130px}' +
      'footer .bps-foot.a-center .bps-foot-top{justify-content:center;text-align:center}' +
      'footer .bps-foot.a-center .about,footer .bps-foot.a-center #bpsFooterBand{margin-left:auto;margin-right:auto}' +
      'footer .bps-foot.a-center #bpsFooterBand .bps-fb-form,footer .bps-foot.a-center #bpsFooterBand .bps-fb-socials{justify-content:center}' +
      'footer .bps-foot.a-right .bps-foot-top{justify-content:flex-end;text-align:right}' +
      'footer .bps-foot.a-right .about,footer .bps-foot.a-right #bpsFooterBand{margin-left:auto}' +
      'footer .bps-foot.a-right #bpsFooterBand .bps-fb-form,footer .bps-foot.a-right #bpsFooterBand .bps-fb-socials{justify-content:flex-end}' +
      'footer .bps-foot .mark{color:#CFD9E4;font-weight:600;font-size:13px;letter-spacing:.3em;margin-bottom:16px}' +
      "footer .bps-foot .about{font-family:Fraunces,Georgia,serif;font-style:italic;font-size:14px;line-height:1.55;color:#8B929C;max-width:340px;margin:0}" +
      'footer .bps-foot h4{font-weight:500;font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#CFD9E4;margin:0 0 18px}' +
      'footer .bps-foot a.link{display:block;color:#8B929C;text-decoration:none;font-size:13px;margin-bottom:10px;transition:color .4s}' +
      'footer .bps-foot a.link:hover{color:#CFD9E4}' +
      'footer .bps-foot .bps-foot-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px 24px;font-weight:500;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8B929C;padding-top:26px;border-top:1px solid #132341}' +
      'footer .bps-foot .bps-foot-bottom .legal a{color:inherit;text-decoration:none;margin-right:22px}' +
      'footer .bps-foot .bps-foot-bottom .legal a:hover{color:#CFD9E4}' +
      '.bps-vrc{width:18px;height:18px;display:inline-block;background:currentColor;-webkit-mask:url(assets/vrchat-icon.png) center/contain no-repeat;mask:url(assets/vrchat-icon.png) center/contain no-repeat}' +
      '#bpsFooterBand{margin-top:26px;max-width:380px}' +
      "#bpsFooterBand .bps-fb-copy{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:14px;line-height:1.5;color:#CFD9E4;margin-bottom:16px}" +
      '#bpsFooterBand .bps-fb-form{display:flex;border-bottom:2px solid #6BB4E8;margin-bottom:22px}' +
      '#bpsFooterBand .bps-fb-form input{flex:1;background:transparent;border:0;color:#CFD9E4;font-family:inherit;font-size:14px;padding:11px 0;outline:none}' +
      '#bpsFooterBand .bps-fb-form button{background:transparent;border:0;color:#6BB4E8;font-family:inherit;font-size:10px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;cursor:pointer;padding:0 4px;white-space:nowrap}' +
      '#bpsFooterBand .bps-fb-form button:hover{color:#CFD9E4}' +
      '#bpsFooterBand .bps-fb-socials{display:flex;gap:16px;align-items:center;flex-wrap:wrap}' +
      '#bpsFooterBand .bps-fb-socials a{color:#8B929C;display:inline-flex;transition:color .3s,transform .3s}' +
      '#bpsFooterBand .bps-fb-socials a:hover{color:#CFD9E4;transform:translateY(-2px)}' +
      '#bpsFooterBand .bps-fb-socials svg{width:18px;height:18px}' +
      '@media(max-width:820px){footer .bps-foot{padding:64px 24px 42px}footer .bps-foot .bps-foot-top{gap:30px 34px}}';
    document.head.appendChild(st);

    var cfg = footerCfg();
    var colsHtml = (cfg.columns || []).map(function (c) {
      return '<div class="fcol"><h4>' + fesc(c.heading) + '</h4>' +
        (c.links || []).map(function (l) { return '<a class="link" href="' + fesc(l.href) + '">' + fesc(l.label) + '</a>'; }).join('') +
        '</div>';
    }).join('');
    var bt = cfg.bottom || {};
    var legalHtml = (bt.legal || []).map(function (l) { return '<a href="' + fesc(l.href) + '">' + fesc(l.label) + '</a>'; }).join('');
    var al = (cfg.align === 'center' || cfg.align === 'right') ? cfg.align : 'left';
    footer.innerHTML =
      '<div class="bps-foot a-' + al + '">' +
        '<div class="bps-foot-top">' +
          '<div class="brand-col">' +
            '<div class="mark notranslate" translate="no">BLUE PULSE STUDIOS</div>' +
            '<p class="about">' + fesc(cfg.blurb) + '</p>' +
          '</div>' +
          colsHtml +
        '</div>' +
        '<div class="bps-foot-bottom">' +
          '<div>' + fesc(bt.copyright) + '</div>' +
          '<div class="legal">' + legalHtml + '</div>' +
          '<div>' + fesc(bt.location) + '</div>' +
        '</div>' +
      '</div>';

    var links = socials();
    var iconRow = ORDER.filter(function (k) { var u = links[k]; return typeof u === 'string' && /^https?:\/\//i.test(u); })
      .map(function (k) { return '<a href="' + links[k].trim() + '" target="_blank" rel="noopener noreferrer" aria-label="' + LABELS[k] + '" title="' + LABELS[k] + '">' + ICONS[k] + '</a>'; }).join('');
    var band = document.createElement('div');
    band.id = 'bpsFooterBand';
    band.innerHTML =
      '<div class="bps-fb-copy">' + fesc(cfg.signup) + '</div>' +
      '<form class="bps-fb-form" id="bpsFooterSignup"><input type="email" name="email" placeholder="you@email.com" required aria-label="Email address"><button type="submit">Subscribe &rarr;</button></form>' +
      (iconRow ? '<div class="bps-fb-socials">' + iconRow + '</div>' : '');
    footer.querySelector('.brand-col').appendChild(band);

    var form = document.getElementById('bpsFooterSignup');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      try { if (window.bpsSubscribe) window.bpsSubscribe(email, 'footer'); } catch (_) {}
      form.reset();
      if (window.bpsTransmission) window.bpsTransmission("You&rsquo;re on the list.");
    });
  });
})();

/* ——— ACCESSIBILITY — persistent control for text size, high contrast, reduced
   motion, and link underlines. Choices persist (bpsA11y) and re-apply on load.
   Pairs with the site's semantic HTML, skip links, and focus rings (WCAG). ——— */
(function () {
  var KEY = 'bpsA11y';
  var SCALES = [1, 1.15, 1.3, 1.45];
  var BRIGHT = [0.8, 0.9, 1, 1.12, 1.25, 1.4]; // brightness levels; index 2 = normal
  var BDEF = 2;
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
  var state = get();
  function apply() {
    var z = SCALES[state.size || 0] || 1;
    document.documentElement.style.zoom = (z === 1 ? '' : z);
    document.documentElement.classList.toggle('bps-hc', !!state.contrast);
    document.documentElement.classList.toggle('bps-rm', !!state.motion);
    document.documentElement.classList.toggle('bps-ul', !!state.underline);
    // compose contrast + brightness into one filter (a single CSS filter property)
    var filt = [];
    if (state.contrast) { filt.push('contrast(1.18)'); filt.push('saturate(1.05)'); }
    var b = BRIGHT[(state.bright == null ? BDEF : state.bright)] || 1;
    if (b !== 1) filt.push('brightness(' + b + ')');
    document.documentElement.style.filter = filt.length ? filt.join(' ') : '';
  }
  var st = document.createElement('style');
  st.textContent =
    'html.bps-hc a:not(.brand){text-decoration:underline}' +
    'html.bps-rm *,html.bps-rm *::before,html.bps-rm *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' +
    'html.bps-ul a{text-decoration:underline!important}' +
    '#bpsA11yBtn{position:fixed;left:20px;bottom:20px;z-index:8500;width:56px;height:56px;border-radius:50%;background:#0A1A35;border:1.5px solid #1D5FB8;color:#6BB4E8;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 0 0 rgba(107,180,232,.5);animation:bpsA11yPulse 2.6s ease-out infinite}' +
    '@keyframes bpsA11yPulse{0%{box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 0 0 rgba(107,180,232,.45)}70%{box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 0 13px rgba(107,180,232,0)}100%{box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 0 0 rgba(107,180,232,0)}}' +
    'html.bps-rm #bpsA11yBtn{animation:none}' +
    '#bpsA11yBtn:hover,#bpsA11yBtn:focus-visible{background:#1D5FB8;color:#fff;outline:2px solid #6BB4E8;outline-offset:3px}' +
    '#bpsA11yBtn svg{width:28px;height:28px}' +
    '#bpsA11yPanel{position:fixed;left:18px;bottom:74px;z-index:8500;width:252px;background:#060F1F;border:1px solid #1D5FB8;padding:18px;font-family:Inter,sans-serif;color:#CFD9E4;display:none;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
    '#bpsA11yPanel.on{display:block}' +
    '#bpsA11yPanel h4{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#6BB4E8;font-weight:600;margin:0 0 16px}' +
    '#bpsA11yPanel .row{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;font-size:12.5px}' +
    '#bpsA11yPanel .sizes button,#bpsA11yPanel .brights button{min-width:30px;height:30px;padding:0 4px;background:transparent;border:1px solid #132341;color:#CFD9E4;cursor:pointer;margin-left:6px;font-family:inherit;font-size:12px}' +
    '#bpsA11yPanel .sizes button:hover,#bpsA11yPanel .brights button:hover{border-color:#6BB4E8}' +
    '#bpsA11yPanel .tg{width:40px;height:22px;border-radius:11px;background:#132341;border:0;position:relative;cursor:pointer;flex:none}' +
    '#bpsA11yPanel .tg::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#8B929C;transition:transform .2s,background .2s}' +
    '#bpsA11yPanel .tg[aria-pressed="true"]{background:#1D5FB8}' +
    '#bpsA11yPanel .tg[aria-pressed="true"]::after{transform:translateX(18px);background:#fff}';
  document.head.appendChild(st);
  apply();

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.id = 'bpsA11yBtn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Accessibility options'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="3.8" r="2.1"/><path d="M21 8.5c0 .6-.5 1-1.9 1.2-1 .2-2.3.3-3.1.3l.5 3 .9 6.2c.1.7-.3 1.2-.9 1.3s-1.1-.3-1.2-.9L14.4 15h-.9l-.9 4c-.1.6-.6 1-1.2.9s-1-.6-.9-1.3l.9-6.2.5-3c-.8 0-2.1-.1-3.1-.3C3.5 9.5 3 9.1 3 8.5s.5-1 1.4-.9C6 7.8 9 8 12 8s6-.2 7.6-.4c.9-.1 1.4.3 1.4.9z"/></svg>';
    document.body.appendChild(btn);
    var panel = document.createElement('div');
    panel.id = 'bpsA11yPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Accessibility options');
    panel.innerHTML =
      '<h4>Accessibility</h4>' +
      '<div class="row"><span>Text size</span><span class="sizes"><button type="button" data-a="dec" aria-label="Decrease text size">A&minus;</button><button type="button" data-a="reset" aria-label="Reset text size">A</button><button type="button" data-a="inc" aria-label="Increase text size">A+</button></span></div>' +
      '<div class="row"><span>Brightness</span><span class="brights"><button type="button" data-b="dec" aria-label="Decrease brightness">&#9788;&minus;</button><button type="button" data-b="reset" aria-label="Reset brightness">&#9788;</button><button type="button" data-b="inc" aria-label="Increase brightness">&#9788;+</button></span></div>' +
      '<div class="row"><span>High contrast</span><button type="button" class="tg" data-t="contrast" aria-pressed="false" aria-label="Toggle high contrast"></button></div>' +
      '<div class="row"><span>Reduce motion</span><button type="button" class="tg" data-t="motion" aria-pressed="false" aria-label="Toggle reduced motion"></button></div>' +
      '<div class="row" style="margin-bottom:0"><span>Underline links</span><button type="button" class="tg" data-t="underline" aria-pressed="false" aria-label="Toggle underline links"></button></div>';
    document.body.appendChild(panel);
    function syncToggles() { Array.prototype.forEach.call(panel.querySelectorAll('.tg'), function (t) { t.setAttribute('aria-pressed', state[t.getAttribute('data-t')] ? 'true' : 'false'); }); }
    syncToggles();
    btn.addEventListener('click', function () { var on = panel.classList.toggle('on'); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { panel.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { panel.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); } });
    panel.querySelector('.sizes').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var a = b.getAttribute('data-a'); var s = state.size || 0;
      if (a === 'inc') s = Math.min(SCALES.length - 1, s + 1); else if (a === 'dec') s = Math.max(0, s - 1); else s = 0;
      state.size = s; save(state); apply();
    });
    panel.querySelector('.brights').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var a = b.getAttribute('data-b');
      var s = (state.bright == null ? BDEF : state.bright);
      if (a === 'inc') s = Math.min(BRIGHT.length - 1, s + 1); else if (a === 'dec') s = Math.max(0, s - 1); else s = BDEF;
      state.bright = s; save(state); apply();
    });
    Array.prototype.forEach.call(panel.querySelectorAll('.tg'), function (t) {
      t.addEventListener('click', function () { var k = t.getAttribute('data-t'); state[k] = !state[k]; save(state); apply(); syncToggles(); });
    });
  });
})();

/* ——— PERFORMANCE — lazy-load + async-decode images, and on slow connections /
   low-memory / data-saver devices drop heavy background animations, blur, and
   the grain overlay so the site paints faster ("lite mode"). ——— */
(function () {
  try {
    var i = 0;
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) {
      i++;
      if (!im.hasAttribute('loading') && i > 1) im.setAttribute('loading', 'lazy');
      if (!im.hasAttribute('decoding')) im.setAttribute('decoding', 'async');
    });
  } catch (_) {}
  var lite = false;
  try {
    var c = navigator.connection || {};
    if (c.saveData) lite = true;
    if (c.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) lite = true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) lite = true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches) lite = true;
  } catch (_) {}
  if (lite) {
    document.documentElement.classList.add('bps-lite');
    var s = document.createElement('style');
    s.textContent =
      'html.bps-lite *,html.bps-lite *::before,html.bps-lite *::after{animation:none!important}' +
      'html.bps-lite body::before{display:none!important}' +
      'html.bps-lite .bg-bubbles,html.bps-lite .drift,html.bps-lite .drift-2,html.bps-lite .portal .bubbles,html.bps-lite .portal .bubbles2,html.bps-lite .scene .bg-bubbles,html.bps-lite .hero .bg-bubbles{display:none!important}' +
      'html.bps-lite .vig,html.bps-lite [class*="blur"]{filter:none!important}';
    document.head.appendChild(s);
  }
})();

/* (Studio dropdown is now part of the canonical nav above.) */

/* ——— SCROLL V-ARROW — a V-shaped down button, bottom-center, that smooth-scrolls
   to the next section (non-scroll navigation). Glows blue on hover, blue pulse on
   click, and hides once you reach the bottom. Replaces the old "Scroll" text cue. */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent =
      '.hero .scroll-cue{display:none!important}' +
      '#bpsScrollV{position:fixed;left:50%;transform:translateX(-50%);bottom:22px;z-index:8400;width:48px;height:48px;display:none;align-items:center;justify-content:center;cursor:pointer;border:0;background:transparent;color:#6BB4E8;opacity:.82;transition:opacity .3s,color .3s,transform .3s}' +
      '#bpsScrollV.show{display:flex}' +
      '#bpsScrollV svg{width:32px;height:32px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}' +
      '#bpsScrollV:hover,#bpsScrollV:focus-visible{opacity:1;color:#9BD1FF;outline:none;transform:translateX(-50%) translateY(3px)}' +
      '#bpsScrollV:hover svg,#bpsScrollV:focus-visible svg{filter:drop-shadow(0 0 9px rgba(107,180,232,.95))}' +
      '#bpsScrollV .ring{position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}' +
      '#bpsScrollV.pulse .ring{animation:bpsSvPulse .62s ease-out}' +
      '@keyframes bpsSvPulse{0%{box-shadow:0 0 0 0 rgba(107,180,232,.6)}100%{box-shadow:0 0 0 28px rgba(107,180,232,0)}}' +
      '#bpsScrollV.bounce svg{animation:bpsSvBounce 2s ease-in-out infinite}' +
      '@keyframes bpsSvBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}' +
      'html.bps-rm #bpsScrollV.bounce svg{animation:none}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'bpsScrollV'; btn.type = 'button'; btn.className = 'bounce';
    btn.setAttribute('aria-label', 'Scroll to next section');
    btn.innerHTML = '<span class="ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 8 12 16 19 8"/></svg>';
    document.body.appendChild(btn);

    function targets() {
      var out = [], seen = [];
      Array.prototype.forEach.call(document.querySelectorAll('main section, body > section, section[id], [data-anchor], footer'), function (el) {
        if (seen.indexOf(el) < 0) { seen.push(el); out.push(el); }
      });
      return out;
    }
    function atBottom() { return (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 130); }
    function tall() { return document.documentElement.scrollHeight > window.innerHeight * 1.4; }
    function update() {
      var cookie = document.getElementById('bpsCookie');
      if (cookie && cookie.offsetParent !== null) { btn.classList.remove('show'); return; }
      if (tall() && !atBottom()) btn.classList.add('show'); else btn.classList.remove('show');
    }
    btn.addEventListener('click', function () {
      btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
      var y = window.scrollY + 8, next = null;
      targets().forEach(function (el) {
        var top = el.getBoundingClientRect().top + window.scrollY;
        if (top > y + 4 && (next === null || top < next)) next = top;
      });
      if (next === null) next = document.documentElement.scrollHeight;
      window.scrollTo({ top: Math.max(0, next - 2), behavior: 'smooth' });
    });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    setTimeout(update, 350); update();
  });
})();

/* ——— POSTER CAROUSEL — a minimal, cinematic slate. Markup:
   <div class="bps-carousel" data-items='[{"title","year","note","href","img"}]'></div>
   The centre poster is enlarged and lit; the others fall back and dim. ——— */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var mounts = document.querySelectorAll('.bps-carousel');
    if (!mounts.length) return;
    var css = document.createElement('style');
    css.textContent =
      /* the carousel is the feature on these pages — give it the room */
      '.bps-carousel{position:relative;width:100%;padding:6px 0 8px}' +
      '.bpc-stage{position:relative;height:min(74vh,680px);display:flex;align-items:center;justify-content:center;perspective:1600px}' +
      /* compact, unobtrusive page header above a carousel */
      '.proj-head{max-width:1200px;margin:0 auto;padding:118px 48px 0;text-align:center}' +
      '.proj-head .eyebrow{font-size:9.5px;letter-spacing:.5em;text-transform:uppercase;color:#6BB4E8;font-weight:600;margin-bottom:10px}' +
      ".proj-head h1{font-family:Fraunces,Georgia,serif;font-weight:300;font-size:clamp(24px,2.6vw,38px);letter-spacing:-.01em;color:#CFD9E4;line-height:1.05;margin:0}" +
      ".proj-head p{margin:10px auto 0;font-family:Fraunces,Georgia,serif;font-style:italic;font-size:14px;line-height:1.5;color:#8B929C;max-width:520px}" +
      '.proj-tabs{display:flex;gap:26px;justify-content:center;margin:18px 0 0;flex-wrap:wrap}' +
      '.proj-tabs a{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#8B929C;text-decoration:none;padding-bottom:6px;border-bottom:1px solid transparent;transition:color .35s,border-color .35s}' +
      '.proj-tabs a:hover{color:#CFD9E4}' +
      '.proj-tabs a.on{color:#CFD9E4;border-bottom-color:#6BB4E8}' +
      '@media(max-width:700px){.proj-head{padding:96px 24px 0}}' +
      '.bpc-item{position:absolute;top:50%;left:50%;width:min(300px,58vw);aspect-ratio:2/3;margin:0;text-decoration:none;color:inherit;' +
        'transition:transform .75s cubic-bezier(.22,.7,.2,1),opacity .75s,filter .75s;will-change:transform;cursor:pointer}' +
      '.bpc-item .bpc-art{position:absolute;inset:0;overflow:hidden;background:linear-gradient(150deg,#0d1a2e,#050a14);border:1px solid #132341;box-shadow:0 30px 70px rgba(0,0,0,.6)}' +
      '.bpc-item .bpc-art img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.bpc-item .bpc-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:22px;' +
        "font-family:Fraunces,Georgia,serif;font-style:italic;font-size:15px;color:#6BB4E8;opacity:.75}" +
      '.bpc-item.is-active{z-index:5}' +
      '.bpc-item:not(.is-active){filter:saturate(.55) brightness(.5)}' +
      '.bpc-item:not(.is-active):hover{filter:saturate(.8) brightness(.72)}' +
      '.bpc-meta{margin-top:26px;text-align:center;min-height:92px}' +
      '.bpc-meta .t{font-family:Fraunces,Georgia,serif;font-weight:300;font-size:clamp(28px,4vw,46px);letter-spacing:-.02em;color:#CFD9E4;line-height:1.05}' +
      '.bpc-meta .y{margin-top:10px;font-family:Inter,sans-serif;font-size:10px;letter-spacing:.42em;text-transform:uppercase;color:#6BB4E8;font-weight:600}' +
      '.bpc-meta .n{margin-top:12px;font-family:Fraunces,Georgia,serif;font-style:italic;font-size:15px;color:#8B929C}' +
      '.bpc-meta .go{display:inline-block;margin-top:18px;font-family:Inter,sans-serif;font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#CFD9E4;text-decoration:none;border-bottom:1px solid #6BB4E8;padding-bottom:5px}' +
      '.bpc-nav{position:absolute;top:min(31vh,280px);width:100%;display:flex;justify-content:space-between;pointer-events:none;z-index:9}' +
      '.bpc-nav button{pointer-events:auto;background:rgba(2,4,10,.5);border:1px solid #132341;color:#CFD9E4;width:46px;height:46px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .3s,background .3s}' +
      '.bpc-nav button:hover{border-color:#6BB4E8;background:rgba(29,95,184,.2)}' +
      '.bpc-nav svg{width:18px;height:18px}' +
      '.bpc-dots{display:flex;gap:9px;justify-content:center;margin-top:22px}' +
      '.bpc-dots button{width:7px;height:7px;border-radius:50%;border:0;padding:0;background:#243352;cursor:pointer;transition:background .3s,transform .3s}' +
      '.bpc-dots button.on{background:#6BB4E8;transform:scale(1.4)}' +
      '@media(max-width:700px){.bpc-stage{height:min(54vh,430px)}.bpc-item{width:min(230px,62vw)}.bpc-nav{top:min(26vh,210px)}}';
    document.head.appendChild(css);

    mounts.forEach(function (mount) {
      var items = [];
      try { items = JSON.parse(mount.getAttribute('data-items') || '[]'); } catch (_) {}
      items = items.filter(function (it) { return !window.BPS_HIDDEN.isHidden(it.href); });
      if (!items.length) { mount.style.display = 'none'; return; }

      var stage = document.createElement('div'); stage.className = 'bpc-stage';
      var meta = document.createElement('div'); meta.className = 'bpc-meta';
      var dots = document.createElement('div'); dots.className = 'bpc-dots';
      var nav = document.createElement('div'); nav.className = 'bpc-nav';
      nav.innerHTML =
        '<button type="button" data-d="-1" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg></button>' +
        '<button type="button" data-d="1" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg></button>';

      var els = items.map(function (it, i) {
        var a = document.createElement('a');
        a.className = 'bpc-item';
        a.href = it.href || '#';
        a.setAttribute('data-i', i);
        a.innerHTML = '<div class="bpc-art">' +
          (it.img ? '<img src="' + it.img + '" alt="' + (it.title || '') + '" loading="lazy">'
                  : '<div class="bpc-ph">' + (it.title || '') + '<br>artwork coming soon</div>') +
          '</div>';
        stage.appendChild(a);
        return a;
      });

      items.forEach(function (_, i) {
        var b = document.createElement('button'); b.type = 'button';
        b.setAttribute('aria-label', 'Go to item ' + (i + 1));
        b.addEventListener('click', function () { go(i); });
        dots.appendChild(b);
      });

      mount.appendChild(stage); mount.appendChild(nav); mount.appendChild(meta); mount.appendChild(dots);

      var cur = 0;
      function layout() {
        els.forEach(function (el, i) {
          var d = i - cur;
          var n = items.length;
          if (d > n / 2) d -= n; if (d < -n / 2) d += n;   // shortest way round
          var abs = Math.abs(d);
          var x = d * 58, sc = d === 0 ? 1 : 0.72 - (abs - 1) * 0.06, rot = d === 0 ? 0 : (d > 0 ? -16 : 16);
          el.style.transform = 'translate(-50%,-50%) translateX(' + x + '%) scale(' + Math.max(sc, 0.4) + ') rotateY(' + rot + 'deg)';
          el.style.opacity = abs > 2 ? 0 : 1;
          el.style.zIndex = String(20 - abs);
          el.classList.toggle('is-active', d === 0);
          el.style.pointerEvents = abs > 2 ? 'none' : 'auto';
        });
        var it = items[cur];
        meta.innerHTML = '<div class="t">' + (it.title || '') + '</div>' +
          (it.year ? '<div class="y">' + it.year + '</div>' : '') +
          (it.note ? '<div class="n">' + it.note + '</div>' : '') +
          (it.href ? '<a class="go" href="' + it.href + '">Enter &rarr;</a>' : '');
        Array.prototype.forEach.call(dots.children, function (b, i) { b.classList.toggle('on', i === cur); });
      }
      function go(i) { cur = (i + items.length) % items.length; layout(); }

      nav.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        go(cur + (+b.getAttribute('data-d')));
      });
      els.forEach(function (el, i) {
        el.addEventListener('click', function (e) { if (i !== cur) { e.preventDefault(); go(i); } });
      });
      /* swipe */
      var sx = null;
      stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (sx === null) return;
        var dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
        sx = null;
      });
      layout();
    });
  });
})();

/* ——— BANNERS — layered hero art (background / logo / foreground), positionable
   and parallax-able from the admin "Banners" tab. Any element with
   data-bps-banner="<key>" gets its layers rendered and kept in sync. ——— */
window.BPS_BANNERS_DEFAULT = {
  'moth-country': {
    parallax: true,
    layers: [
      { name: 'Key art',    img: 'assets/moth-country-key.jpg',        mode: 'cover', x: 0,      y: 0,      scale: 100,  parallax: 0,  fade: true },
      { name: 'Logo',       img: 'assets/moth-country-title.png',      mode: 'logo',  x: 0,      y: -32,    scale: 74,   parallax: 26, fade: false },
      { name: 'Characters', img: 'assets/moth-country-characters.png', mode: 'place', x: 29.219, y: 27.685, scale: 40.365, parallax: 0, fade: false, ar: '775/633' }
    ]
  }
};
window.BPS_BANNERS = (function () {
  function all() {
    var d = {};
    try { Object.assign(d, window.BPS_BANNERS_DEFAULT || {}); } catch (_) {}
    try { Object.assign(d, window.BPS_BANNERS_PUBLISHED || {}); } catch (_) {}
    try {
      var ls = JSON.parse(localStorage.getItem('bpsBanners') || 'null');
      if (ls && typeof ls === 'object') Object.assign(d, ls);
    } catch (_) {}
    return d;
  }
  function get(key) { return all()[key] || null; }
  function save(key, cfg) {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('bpsBanners') || '{}') || {}; } catch (_) {}
    cur[key] = cfg;
    try { localStorage.setItem('bpsBanners', JSON.stringify(cur)); return true; } catch (_) { return false; }
  }
  function clear(key) {
    try {
      var cur = JSON.parse(localStorage.getItem('bpsBanners') || '{}') || {};
      delete cur[key]; localStorage.setItem('bpsBanners', JSON.stringify(cur));
    } catch (_) {}
  }
  /* Build (or rebuild) the layer stack inside a mount element. */
  function render(mount) {
    var key = mount.getAttribute('data-bps-banner');
    var cfg = get(key);
    if (!cfg) return;
    mount.innerHTML = '';
    mount.classList.add('bps-banner');
    (cfg.layers || []).forEach(function (L, i) {
      var el = document.createElement('div');
      el.className = 'bpsb-layer bpsb-' + (L.mode || 'cover');
      el.setAttribute('data-i', i);
      el.style.zIndex = String(i);
      el.style.backgroundImage = L.img ? "url('" + L.img + "')" : 'none';
      if (L.mode === 'cover') {
        el.style.cssText += ';position:absolute;inset:0;background-size:cover;background-position:' +
          (50 + (+L.x || 0)) + '% ' + (50 + (+L.y || 0)) + '%;background-repeat:no-repeat';
        if (L.fade) {
          var g = 'linear-gradient(to right, transparent 0, #000 7%, #000 93%, transparent 100%)';
          el.style.webkitMaskImage = g; el.style.maskImage = g;
        }
      } else if (L.mode === 'logo') {
        el.style.cssText += ';position:absolute;left:' + (50 + (+L.x || 0)) + '%;top:' + (50 + (+L.y || 0)) +
          '%;width:' + (+L.scale || 60) + '%;aspect-ratio:' + (L.ar || '1600/541') +
          ';transform:translate(-50%,-50%);background-size:contain;background-position:center;background-repeat:no-repeat;' +
          'filter:drop-shadow(0 12px 46px rgba(150,90,220,.45))';
      } else { /* place — anchored to the artwork by percentage */
        el.style.cssText += ';position:absolute;left:' + (+L.x || 0) + '%;top:' + (+L.y || 0) +
          '%;width:' + (+L.scale || 40) + '%;aspect-ratio:' + (L.ar || '1/1') +
          ';background-size:contain;background-position:center;background-repeat:no-repeat';
      }
      el.setAttribute('data-par', String(+L.parallax || 0));
      mount.appendChild(el);
    });
    startParallax(mount, cfg);
  }
  function startParallax(mount, cfg) {
    if (mount._bpsRaf) return;
    if (!cfg.parallax) return;
    if (document.documentElement.classList.contains('bps-rm')) return;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
    function raf() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      Array.prototype.forEach.call(mount.querySelectorAll('.bpsb-layer'), function (el) {
        var p = +el.getAttribute('data-par') || 0;
        if (!p) return;
        var base = el.classList.contains('bpsb-logo') ? 'translate(-50%,-50%) ' : '';
        el.style.transform = base + 'translate3d(' + (cx * p).toFixed(1) + 'px,' + (cy * p * 0.6).toFixed(1) + 'px,0)';
      });
      mount._bpsRaf = requestAnimationFrame(raf);
    }
    mount._bpsRaf = requestAnimationFrame(raf);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent =
      '.bps-banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max(106%,calc(100vh*16/9*1.06));aspect-ratio:16/9;z-index:0;pointer-events:none}' +
      '.bpsb-layer{will-change:transform}';
    document.head.appendChild(st);
    Array.prototype.forEach.call(document.querySelectorAll('[data-bps-banner]'), render);
  });
  return { all: all, get: get, save: save, clear: clear, render: render };
})();

/* ——— PROJECT TABS — Films / Television / Books links so the three carousel
   pages feel like one section. Hidden pages drop out automatically. ——— */
(function () {
  var TABS = [
    { label: 'Films', href: 'films.html' },
    { label: 'Television', href: 'television.html' },
    { label: 'Books', href: 'books.html' }
  ];
  document.addEventListener('DOMContentLoaded', function () {
    var mount = document.querySelector('.proj-tabs');
    if (!mount) return;
    var here = (location.pathname.split('/').pop() || '').toLowerCase();
    mount.innerHTML = TABS.filter(function (t) { return !window.BPS_HIDDEN.isHidden(t.href); })
      .map(function (t) {
        var on = here === t.href.toLowerCase() ? ' class="on"' : '';
        return '<a href="' + t.href + '"' + on + '>' + t.label + '</a>';
      }).join('');
  });
})();

/* ——— MOBILE HERO — full-bleed hero art gets cropped hard on phones; scale it
   to fit and shorten the hero so nothing important is cut off. ——— */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '@media (max-width:860px){' +
      '.hero{min-height:78vh !important}' +
      '.hero .bg-img,.feat-slide{background-size:contain !important;background-position:center 42% !important;background-repeat:no-repeat !important;background-color:#05070c}' +
      '.hero .title-logo,.hero .swell-logo{width:min(92%,520px) !important}' +
      '.feat-slide .flogo{width:min(82vw,420px) !important;max-height:38% !important}' +
      '.hero{padding-left:24px !important;padding-right:24px !important}' +
    '}';
  document.addEventListener('DOMContentLoaded', function () { document.head.appendChild(st); });
})();

/* ——— LANGUAGE — auto-translate switcher (Google Translate). A globe control
   (bottom-right) lets visitors read the whole site in dozens of languages.
   The choice is stored in the googtrans cookie and applied on load. ——— */
(function () {
  window.googleTranslateElementInit = function () {
    try { new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'bpsGT'); } catch (_) {}
  };
  function currentLang() { var m = document.cookie.match(/googtrans=\/en\/([\w-]+)/); return m ? m[1] : ''; }
  document.addEventListener('DOMContentLoaded', function () {
    var st = document.createElement('style');
    st.textContent =
      '.goog-te-banner-frame,.goog-te-gadget-icon,.skiptranslate iframe,#goog-gt-tt{display:none !important}' +
      'body{top:0 !important;position:static !important}' +
      '#bpsLang{position:fixed;right:18px;bottom:18px;z-index:8500;display:flex;align-items:center;gap:7px;background:#0A1A35;border:1px solid #1D5FB8;border-radius:999px;padding:8px 12px 8px 14px;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
      '#bpsLang svg{width:15px;height:15px;color:#6BB4E8;flex:none}' +
      '#bpsLang select{background:transparent;border:0;color:#CFD9E4;font:500 11px/1 Inter,sans-serif;letter-spacing:.06em;cursor:pointer;outline:none}' +
      '#bpsLang select option{background:#0A1A35;color:#CFD9E4}';
    document.head.appendChild(st);
    var mount = document.createElement('div'); mount.id = 'bpsGT'; mount.style.cssText = 'position:absolute;left:-9999px;top:-9999px'; document.body.appendChild(mount);
    var LANGS = [['', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['ja', '日本語'], ['zh-CN', '中文'], ['pt', 'Português'], ['it', 'Italiano'], ['ko', '한국어'], ['ru', 'Русский'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['vi', 'Tiếng Việt'], ['id', 'Indonesia'], ['th', 'ไทย'], ['uk', 'Українська'], ['sv', 'Svenska']];
    var wrap = document.createElement('div'); wrap.id = 'bpsLang'; wrap.className = 'notranslate';
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z"/></svg>';
    var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Choose language');
    LANGS.forEach(function (l) { var o = document.createElement('option'); o.value = l[0]; o.textContent = l[1]; sel.appendChild(o); });
    wrap.appendChild(sel); document.body.appendChild(wrap);
    sel.value = currentLang();
    var host = location.hostname;
    sel.addEventListener('change', function () {
      var lang = sel.value;
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + host;
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + host;
      if (lang) {
        document.cookie = 'googtrans=/en/' + lang + ';path=/';
        document.cookie = 'googtrans=/en/' + lang + ';path=/;domain=.' + host;
      }
      location.reload();
    });
    var sc = document.createElement('script'); sc.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'; document.body.appendChild(sc);
  });
})();

/* ——— CLOUDFLARE WEB ANALYTICS — cookieless page-view analytics for the whole
   site. Skipped only if the visitor chose "Deny" in the cookie banner. Data
   lives in the Cloudflare dashboard (linked from the admin Analytics tab). ——— */
(function () {
  try { if (localStorage.getItem('bpsCookieConsent') === 'deny') return; } catch (_) {}
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token": "bdf0c881c9404c73acf908971b1b8ef9"}');
  (document.head || document.documentElement).appendChild(s);
})();

/* ——— HEADER / FOOTER CODE — custom code set from the admin (Header & Footer
   tab). Header code injects into <head>; footer code at the end of <body>;
   embedded <script> executes. Admin preview via localStorage; bake
   window.BPS_HEADER_CODE / BPS_FOOTER_CODE to publish for all visitors. ——— */
(function () {
  function inject(html, mount) {
    if (!html || !mount) return;
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    Array.prototype.slice.call(tpl.content.childNodes).forEach(function (n) {
      if (n.tagName === 'SCRIPT') {
        var s = document.createElement('script');
        Array.prototype.forEach.call(n.attributes, function (a) { try { s.setAttribute(a.name, a.value); } catch (_) {} });
        if (!n.src) s.textContent = n.textContent;
        mount.appendChild(s);
      } else {
        mount.appendChild(document.importNode(n, true));
      }
    });
  }
  var head = '', foot = '';
  try { head = localStorage.getItem('bpsHeaderCode') || ''; } catch (_) {}
  try { foot = localStorage.getItem('bpsFooterCode') || ''; } catch (_) {}
  head = head || (window.BPS_HEADER_CODE || '');
  foot = foot || (window.BPS_FOOTER_CODE || '');
  if (head) inject(head, document.head);
  if (foot) document.addEventListener('DOMContentLoaded', function () { inject(foot, document.body); });
})();

/* ——— CURRENCY — show shop prices in the visitor's currency. Reads whatever
   price is on the page (so it tracks Shopify's live price automatically) and
   converts with daily FX rates. Estimate only — checkout charges in USD. ——— */
(function () {
  var CUR = { USD: { s: '$', d: 2 }, EUR: { s: '€', d: 2 }, GBP: { s: '£', d: 2 }, CAD: { s: 'CA$', d: 2 }, JPY: { s: '¥', d: 0 } };
  var KEY = 'bpsCurrency', RKEY = 'bpsFxRates', PRICE_RE = /^\s*\$\s?([\d,]+(?:\.\d{1,2})?)\s*$/;
  function cur() { try { return localStorage.getItem(KEY) || 'USD'; } catch (_) { return 'USD'; } }
  var rates = null, observer = null;
  function convert() {
    var code = cur();
    if (observer) observer.disconnect();
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nodes = [], n;
    while (n = w.nextNode()) nodes.push(n);
    nodes.forEach(function (t) {
      var el = t.parentElement; if (!el) return;
      if (el.closest('script,style,input,textarea,#bpsCur,#bpsLang,#bpsA11yPanel,#bpsCookie,#bpsGalleryPicker')) return;
      var stored = el.getAttribute('data-bps-usd');
      if (!stored) {
        var raw = t.nodeValue || '';
        if (!PRICE_RE.test(raw)) return;
        stored = raw; el.setAttribute('data-bps-usd', raw); el.classList.add('notranslate');
      }
      var m = stored.match(PRICE_RE); if (!m) return;
      var usd = parseFloat(m[1].replace(/,/g, ''));
      if (code === 'USD' || !rates || !rates[code]) { if (t.nodeValue !== stored) t.nodeValue = stored; }
      else { var c = CUR[code]; t.nodeValue = '≈ ' + c.s + (usd * rates[code]).toLocaleString(undefined, { minimumFractionDigits: c.d, maximumFractionDigits: c.d }); }
    });
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }
  var _t; function schedule() { clearTimeout(_t); _t = setTimeout(convert, 250); }
  function loadRates(cb) {
    if (rates) { cb(); return; }
    try { var c = JSON.parse(localStorage.getItem(RKEY) || 'null'); if (c && (Date.now() - c.t) < 86400000) { rates = c.r; cb(); return; } } catch (_) {}
    fetch('https://open.er-api.com/v6/latest/USD').then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.rates) { rates = j.rates; try { localStorage.setItem(RKEY, JSON.stringify({ t: Date.now(), r: rates })); } catch (_) {} }
      cb();
    }).catch(cb);
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.nav .brand, footer .mark, .brand-col .mark').forEach(function (e) { e.classList.add('notranslate'); e.setAttribute('translate', 'no'); });
    var st = document.createElement('style');
    st.textContent =
      '#bpsCur{position:fixed;right:18px;bottom:62px;z-index:8500;display:flex;align-items:center;gap:7px;background:#0A1A35;border:1px solid #1D5FB8;border-radius:999px;padding:8px 12px 8px 14px;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
      '#bpsCur svg{width:14px;height:14px;color:#6BB4E8;flex:none}' +
      '#bpsCur select{background:transparent;border:0;color:#CFD9E4;font:500 11px/1 Inter,sans-serif;letter-spacing:.06em;cursor:pointer;outline:none}' +
      '#bpsCur select option{background:#0A1A35;color:#CFD9E4}';
    document.head.appendChild(st);
    var wrap = document.createElement('div'); wrap.id = 'bpsCur'; wrap.className = 'notranslate';
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    var s = document.createElement('select'); s.setAttribute('aria-label', 'Currency');
    Object.keys(CUR).forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; s.appendChild(o); });
    wrap.appendChild(s); document.body.appendChild(wrap);
    s.value = cur();
    s.addEventListener('change', function () { try { localStorage.setItem(KEY, s.value); } catch (_) {} rates = null; loadRates(convert); });
    if (cur() !== 'USD') loadRates(convert); else convert();
    setTimeout(function () { convert(); }, 700);
    try { observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
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
      if (el.closest('nav, .nav, .meta-bar, script, style, .legal, #bpsCopyBar, .hero, .feat-list, .feat-slides')) return false;
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

/* ——— IMAGE SWAP (admin) — in #bps-edit mode, hover any image to replace it
   from the media gallery, a pasted URL, or a device upload. Overrides persist
   per page (bpsImageOverrides) and are re-applied on every load. ——— */
(function () {
  var KEY = 'bpsImageOverrides';
  var page = (location.pathname.split('/').pop() || 'index.html');
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function put(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (_) { return false; } }
  function gallery() { try { return JSON.parse(localStorage.getItem('bpsGallery') || '[]'); } catch (_) { return []; } }
  function imgs() {
    return Array.prototype.slice.call(document.querySelectorAll('img')).filter(function (im) {
      return !im.closest('#bpsTx,#bpsCookie,#bpsFooterBand,#bpsGalleryPicker,#bpsImgOverlay');
    });
  }
  function keyOf(i) { return page + '::' + i; }

  // Apply saved image overrides on every load
  (function apply() { var o = store(); imgs().forEach(function (im, i) { var k = keyOf(i); if (o[k]) im.src = o[k]; }); })();

  if (location.hash !== '#bps-edit') return;

  var css = document.createElement('style');
  css.textContent =
    'img[data-bps-img]{outline:1px dashed rgba(107,180,232,.7);outline-offset:3px}' +
    '#bpsImgOverlay{position:absolute;z-index:190000;display:none;align-items:center;justify-content:center;text-align:center;background:rgba(2,4,10,.55);border:1px solid #6BB4E8;cursor:pointer;color:#CFD9E4;font:600 10px/1.5 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:10px}' +
    '#bpsImgOverlay:hover{background:rgba(2,4,10,.7)}';
  document.head.appendChild(css);

  var ov = document.createElement('div');
  ov.id = 'bpsImgOverlay';
  ov.innerHTML = '<span>&#8679; Upload new<br>photo from gallery</span>';
  document.body.appendChild(ov);
  var target = null;
  function showOver(im) {
    target = im; var r = im.getBoundingClientRect();
    ov.style.top = (window.scrollY + r.top) + 'px'; ov.style.left = (window.scrollX + r.left) + 'px';
    ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px'; ov.style.display = 'flex';
  }
  function hideOver() { ov.style.display = 'none'; target = null; }
  imgs().forEach(function (im, i) { im.setAttribute('data-bps-img', ''); im.setAttribute('data-bps-idx', i); im.addEventListener('mouseenter', function () { showOver(im); }); });
  ov.addEventListener('mouseleave', hideOver);
  ov.addEventListener('click', function () { if (target) openPicker(target); });
  window.addEventListener('scroll', function () { if (target) showOver(target); }, { passive: true });

  function downscale(file, cb) {
    var img = new Image();
    img.onload = function () {
      var MAX = 1600, sc = Math.min(1, MAX / Math.max(img.width, img.height));
      var c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  function openPicker(im) {
    var g = gallery();
    var thumbs = g.length
      ? g.map(function (u) { return '<button class="pk-thumb" data-u="' + u + '" style="border:1px solid #132341;background:#0A1A35;padding:0;cursor:pointer;aspect-ratio:1;overflow:hidden"><img src="' + u + '" style="width:100%;height:100%;object-fit:cover" alt=""></button>'; }).join('')
      : '<div style="grid-column:1/-1;color:#8B929C;font-style:italic;font-family:Fraunces,serif;font-size:14px">Your gallery is empty. Paste an image URL or upload from your device below &mdash; set up the media gallery to build a reusable library.</div>';
    var modal = document.createElement('div');
    modal.id = 'bpsGalleryPicker';
    modal.style.cssText = 'position:fixed;inset:0;z-index:210000;background:rgba(2,4,10,.9);display:flex;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML =
      '<div style="width:min(92vw,720px);max-height:88vh;overflow:auto;background:#060F1F;border:1px solid #132341;padding:28px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><span style="color:#6BB4E8;font:600 10px/1 Inter,sans-serif;letter-spacing:.3em;text-transform:uppercase">Swap photo</span><button id="pkClose" style="background:none;border:0;color:#8B929C;font-size:24px;cursor:pointer" aria-label="Close">&times;</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;margin-bottom:24px">' + thumbs + '</div>' +
      '<label style="display:block;color:#8B929C;font:500 10px/1 Inter,sans-serif;letter-spacing:.28em;text-transform:uppercase;margin-bottom:8px">Or paste an image URL</label>' +
      '<div style="display:flex;gap:10px;margin-bottom:18px"><input id="pkUrl" type="url" placeholder="https://…" style="flex:1;background:transparent;border:0;border-bottom:1px solid #132341;color:#CFD9E4;font:14px Inter,sans-serif;padding:10px 0;outline:none"><button id="pkUse" style="background:#6BB4E8;color:#04121d;border:0;font:600 10px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:0 16px;cursor:pointer">Use</button></div>' +
      '<label style="display:inline-block;color:#6BB4E8;font:600 10px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;cursor:pointer;border-bottom:1px solid #6BB4E8;padding-bottom:3px">Upload from this device<input id="pkFile" type="file" accept="image/*" style="display:none"></label>';
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    function set(u) { im.src = u; var o = store(); o[keyOf(+im.getAttribute('data-bps-idx'))] = u; if (!put(o)) alert('Could not save — image too large for local storage. Use the gallery/URL instead.'); close(); hideOver(); }
    modal.querySelector('#pkClose').onclick = close;
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    Array.prototype.forEach.call(modal.querySelectorAll('.pk-thumb'), function (b) { b.onclick = function () { set(b.getAttribute('data-u')); }; });
    modal.querySelector('#pkUse').onclick = function () { var u = modal.querySelector('#pkUrl').value.trim(); if (u) set(u); };
    modal.querySelector('#pkFile').onchange = function (e) { var f = e.target.files[0]; if (f) downscale(f, set); };
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
