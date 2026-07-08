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

/* ——— PROJECTS nav dropdown — turns the existing "Films" nav link into a
   Projects menu (Films / Television / Books; Games & Docs to come) on every
   page, so the nav stays in one place (here) instead of every HTML file. ——— */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var linksWrap = document.querySelector('.nav .links');
    if (!linksWrap) return;
    var filmsLink = Array.prototype.filter.call(linksWrap.querySelectorAll('a'), function (a) {
      return a.textContent.trim().toLowerCase() === 'films';
    })[0];
    if (!filmsLink || filmsLink.closest('.bps-proj')) return;
    if (!document.getElementById('bpsProjCss')) {
      var st = document.createElement('style'); st.id = 'bpsProjCss';
      st.textContent =
        '.bps-proj{position:relative;display:inline-block;margin-left:28px}' +
        '.bps-proj>a{margin-left:0}' +
        '.bps-proj .bps-proj-panel{position:absolute;top:100%;left:50%;transform:translateX(-50%) translateY(6px);min-width:176px;background:rgba(2,4,10,.97);border:1px solid #132341;padding:8px 0;opacity:0;visibility:hidden;transition:opacity .3s,transform .3s;z-index:200}' +
        '.bps-proj:hover .bps-proj-panel,.bps-proj:focus-within .bps-proj-panel{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}' +
        '.bps-proj .bps-proj-panel a{display:block;margin:0;padding:11px 22px;color:#8B929C;font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;white-space:nowrap;transition:color .3s,background .3s}' +
        '.bps-proj .bps-proj-panel a:hover{color:#CFD9E4;background:rgba(29,95,184,.12)}' +
        '@media (max-width:700px){.bps-proj{margin-left:14px}}';
      document.head.appendChild(st);
    }
    var wrap = document.createElement('span');
    wrap.className = 'bps-proj';
    var trigger = document.createElement('a');
    trigger.href = 'films.html';
    trigger.textContent = 'Projects';
    if (filmsLink.classList.contains('on')) trigger.classList.add('on');
    var panel = document.createElement('div');
    panel.className = 'bps-proj-panel';
    panel.setAttribute('role', 'menu');
    panel.innerHTML =
      '<a href="films.html" role="menuitem">Films</a>' +
      '<a href="moth-country.html" role="menuitem">Television</a>' +
      '<a href="books.html" role="menuitem">Books</a>';
    wrap.appendChild(trigger); wrap.appendChild(panel);
    filmsLink.parentNode.replaceChild(wrap, filmsLink);
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
  var ICONS = {
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.3-.4-4.9a2.6 2.6 0 0 0-1.8-1.8C19.1 5 12 5 12 5s-7.1 0-8.8.3A2.6 2.6 0 0 0 1.4 7.1C1 8.7 1 12 1 12s0 3.3.4 4.9a2.6 2.6 0 0 0 1.8 1.8C4.9 19 12 19 12 19s7.1 0 8.8-.3a2.6 2.6 0 0 0 1.8-1.8C23 15.3 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.5 2h6.7l4.7 6.2L18.9 2zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a2.1 2.1 0 0 0-3.6-1.5 10.3 10.3 0 0 0-5.3-1.7l.9-4.2 3 .7a1.5 1.5 0 1 0 .2-1l-3.4-.8a.5.5 0 0 0-.6.4l-1 4.7a10.4 10.4 0 0 0-5.4 1.7A2.1 2.1 0 1 0 3.6 14v.6c0 3.1 3.8 5.6 8.4 5.6s8.4-2.5 8.4-5.6V14A2.1 2.1 0 0 0 22 12zM8 13.5A1.4 1.4 0 1 1 9.4 15 1.4 1.4 0 0 1 8 13.5zm7.6 3.9a5.3 5.3 0 0 1-3.6 1.1 5.3 5.3 0 0 1-3.6-1.1.4.4 0 0 1 .6-.6 4.6 4.6 0 0 0 3 .9 4.6 4.6 0 0 0 3-.9.4.4 0 1 1 .6.6zm-.9-2.5A1.4 1.4 0 1 1 16 13a1.4 1.4 0 0 1-1.3 1.9z"/></svg>',
    bluesky: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.8C10.9 8.6 7.9 4.7 5.1 3.1 3.8 2.3 2 2 2 4.2c0 1.3.8 5.6 1.2 6.3.6 1.2 1.8 1.5 3 1.3-2 .3-3.7 1-1.4 3.6 2.5 2.6 3.5-.7 4-2.4l.2-1 .3 1c.5 1.7 1.5 5 4 2.4 2.3-2.6.6-3.3-1.4-3.6 1.2.2 2.4-.1 3-1.3.4-.7 1.2-5 1.2-6.3 0-2.2-1.8-1.9-3.1-1.1C16.1 4.7 13.1 8.6 12 10.8z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2 1.5 3.6 3.5 3.9v2.6a6.6 6.6 0 0 1-3.5-1v5.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.9 2.9 0 1 0 2 2.8V3h2.7z"/></svg>',
    vrchat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h16a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8h-5.6L10 21v-4.9H4a1.8 1.8 0 0 1-1.8-1.8v-8A1.8 1.8 0 0 1 4 4.5z"/><path d="M6.3 8.4l1.6 4 1.6-4M12.6 8.4v4M15.2 12.4l1.4-4 1.4 4M15.6 11h2" stroke-width="1.3"/></svg>',
    discord: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4a18.3 18.3 0 0 1 4.3 1.4 16.6 16.6 0 0 0-14 0A18.3 18.3 0 0 1 9.8 3.4L9.6 3a19.8 19.8 0 0 0-4.9 1.4A20.7 20.7 0 0 0 1.3 18a19.9 19.9 0 0 0 6 3l.5-.7a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.4 0l.5.4a13 13 0 0 1-2 1l.5.7a19.9 19.9 0 0 0 6-3 20.7 20.7 0 0 0-3.4-13.6zM8.5 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>'
  };
  var LABELS = { youtube: 'YouTube', x: 'X', instagram: 'Instagram', reddit: 'Reddit', bluesky: 'Bluesky', tiktok: 'TikTok', vrchat: 'VRChat', discord: 'Discord' };
  var ORDER = ['youtube', 'instagram', 'x', 'tiktok', 'bluesky', 'reddit', 'discord', 'vrchat'];
  function socials() {
    var m = {}; try { Object.assign(m, window.BPS_SOCIALS || {}); } catch (_) {}
    try { Object.assign(m, JSON.parse(localStorage.getItem('bpsSocialLinks') || '{}')); } catch (_) {}
    return m;
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bpsFooterBand')) return;
    var footer = document.querySelector('footer');
    var st = document.createElement('style');
    st.textContent =
      '#bpsFooterBand{max-width:1200px;margin:0 auto 52px;padding:0 0 44px;border-bottom:1px solid #132341;display:flex;flex-wrap:wrap;gap:48px;align-items:center;justify-content:space-between}' +
      '#bpsFooterBand .bps-fb-signup{min-width:340px;max-width:600px;text-align:left}' +
      "#bpsFooterBand .bps-fb-copy{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:21px;line-height:1.45;color:#F2F5F8;max-width:560px;margin-bottom:22px}" +
      '#bpsFooterBand .bps-fb-form{display:flex;max-width:520px;border-bottom:2px solid #6BB4E8}' +
      '#bpsFooterBand .bps-fb-form input{flex:1;background:transparent;border:0;color:#CFD9E4;font-family:inherit;font-size:17px;padding:15px 0;outline:none}' +
      '#bpsFooterBand .bps-fb-form button{background:transparent;border:0;color:#6BB4E8;font-family:inherit;font-size:12px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;cursor:pointer;padding:0 6px;white-space:nowrap}' +
      '#bpsFooterBand .bps-fb-form button:hover{color:#CFD9E4}' +
      '#bpsFooterBand .bps-fb-socials{display:flex;gap:18px;align-items:center;flex-shrink:0}' +
      '#bpsFooterBand .bps-fb-socials a{color:#8B929C;display:inline-flex;transition:color .3s,transform .3s}' +
      '#bpsFooterBand .bps-fb-socials a:hover{color:#CFD9E4;transform:translateY(-2px)}' +
      '#bpsFooterBand .bps-fb-socials svg{width:19px;height:19px}' +
      '@media (max-width:700px){#bpsFooterBand{padding-left:24px;padding-right:24px;gap:28px}}';
    document.head.appendChild(st);
    var links = socials();
    var iconRow = ORDER.filter(function (k) { var u = links[k]; return typeof u === 'string' && /^https?:\/\//i.test(u); })
      .map(function (k) { return '<a href="' + links[k].trim() + '" target="_blank" rel="noopener noreferrer" aria-label="' + LABELS[k] + '" title="' + LABELS[k] + '">' + ICONS[k] + '</a>'; }).join('');
    var band = document.createElement('div');
    band.id = 'bpsFooterBand';
    band.innerHTML =
      (iconRow ? '<div class="bps-fb-socials">' + iconRow + '</div>' : '') +
      '<div class="bps-fb-signup"><div class="bps-fb-copy">Get our emails, transmissions, podcasts, interviews with creators, and more &mdash; delivered straight to you.</div>' +
      '<form class="bps-fb-form" id="bpsFooterSignup"><input type="email" name="email" placeholder="you@email.com" required aria-label="Email address"><button type="submit">Subscribe &rarr;</button></form></div>';
    if (footer) footer.insertBefore(band, footer.firstChild); else document.body.appendChild(band);
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
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
  var state = get();
  function apply() {
    var z = SCALES[state.size || 0] || 1;
    document.documentElement.style.zoom = (z === 1 ? '' : z);
    document.documentElement.classList.toggle('bps-hc', !!state.contrast);
    document.documentElement.classList.toggle('bps-rm', !!state.motion);
    document.documentElement.classList.toggle('bps-ul', !!state.underline);
  }
  var st = document.createElement('style');
  st.textContent =
    'html.bps-hc{filter:contrast(1.18) saturate(1.05)}' +
    'html.bps-hc a:not(.brand){text-decoration:underline}' +
    'html.bps-rm *,html.bps-rm *::before,html.bps-rm *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' +
    'html.bps-ul a{text-decoration:underline!important}' +
    '#bpsA11yBtn{position:fixed;left:18px;bottom:18px;z-index:8500;width:46px;height:46px;border-radius:50%;background:#0A1A35;border:1px solid #1D5FB8;color:#6BB4E8;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
    '#bpsA11yBtn:hover,#bpsA11yBtn:focus-visible{background:#1D5FB8;color:#fff;outline:2px solid #6BB4E8;outline-offset:3px}' +
    '#bpsA11yBtn svg{width:24px;height:24px}' +
    '#bpsA11yPanel{position:fixed;left:18px;bottom:74px;z-index:8500;width:252px;background:#060F1F;border:1px solid #1D5FB8;padding:18px;font-family:Inter,sans-serif;color:#CFD9E4;display:none;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
    '#bpsA11yPanel.on{display:block}' +
    '#bpsA11yPanel h4{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#6BB4E8;font-weight:600;margin:0 0 16px}' +
    '#bpsA11yPanel .row{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;font-size:12.5px}' +
    '#bpsA11yPanel .sizes button{width:30px;height:30px;background:transparent;border:1px solid #132341;color:#CFD9E4;cursor:pointer;margin-left:6px;font-family:inherit}' +
    '#bpsA11yPanel .sizes button:hover{border-color:#6BB4E8}' +
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

/* ——— MOBILE NAV — collapse the nav links into a slide-in hamburger menu below
   ~760px (handles the injected Projects dropdown + cart too). ——— */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.nav'); var links = nav && nav.querySelector('.links');
    if (!nav || !links || nav.querySelector('.bps-burger')) return;
    var css = document.createElement('style');
    css.textContent =
      '.bps-burger{display:none;background:none;border:0;color:var(--foam,#CFD9E4);cursor:pointer;padding:6px;margin-left:auto}' +
      '.bps-burger svg{width:26px;height:26px;display:block}' +
      '@media (max-width:760px){' +
      '.nav .bps-burger{display:block}' +
      '.nav .links{position:fixed !important;top:0;right:0;height:100vh;width:min(80vw,320px);background:#02040A;border-left:1px solid #132341;display:flex !important;flex-direction:column !important;align-items:flex-start;justify-content:flex-start;gap:4px;padding:90px 28px 28px;transform:translateX(100%);transition:transform .35s cubic-bezier(.2,.7,.2,1);overflow-y:auto;z-index:120}' +
      '.nav .links.bps-open{transform:none}' +
      '.nav .links a{margin:0 !important;padding:12px 0;font-size:12px !important;width:100%}' +
      '.nav .links .studio-menu,.nav .links .bps-proj{margin:0 !important;display:block;width:100%}' +
      '.nav .links .studio-panel,.nav .links .bps-proj-panel{position:static !important;transform:none !important;opacity:1 !important;visibility:visible !important;background:none !important;border:0 !important;padding:2px 0 6px 16px !important;min-width:0 !important}' +
      '#bpsNavCart{margin:14px 0 0 !important}' +
      '}';
    document.head.appendChild(css);
    var burger = document.createElement('button');
    burger.className = 'bps-burger'; burger.type = 'button'; burger.setAttribute('aria-label', 'Menu'); burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    nav.appendChild(burger);
    burger.addEventListener('click', function () { var open = links.classList.toggle('bps-open'); burger.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') { links.classList.remove('bps-open'); burger.setAttribute('aria-expanded', 'false'); } });
  });
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
