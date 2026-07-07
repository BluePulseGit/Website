/* ============================================================
   shopify.js — Storefront API integration (the "handshake")

   When a Storefront API token is set below, this file:
     1. Reads live products from Shopify (title, description, price,
        sizes/variants, availability, image) and merges them into
        window.PRODUCTS by matching the Shopify product HANDLE to the
        product id used across the site (e.g. handle "bps-tee" -> id "bps-tee").
     2. Routes cart checkout to Shopify's secure hosted checkout.

   When the token is blank (or a fetch fails), the site falls back to the
   built-in data in products.js and the demo checkout — so nothing breaks.

   ── TO GO LIVE ──────────────────────────────────────────────
   After you pick a Shopify plan, install the first-party "Headless"
   sales channel (Shopify Admin -> Apps -> Headless). It shows a
   "Public access token" for the Storefront API. Paste it into `token`
   below. Domain is already set. That's the whole activation.
   ============================================================ */
window.BPS_SHOPIFY = {
  domain: 'blue-pulse-studios-store.myshopify.com',
  token: '',            // <-- paste the Storefront API PUBLIC access token here
  apiVersion: '2025-01'
};

(function () {
  const cfg = window.BPS_SHOPIFY;
  const ready = () => !!(cfg && cfg.domain && cfg.token);

  window.bpsShopify = {
    configured: ready,
    variantMap: {},       // { productHandle: { sizeValue: variantGID } }
    _loaded: false
  };
  if (!ready()) return;   // not configured yet — site uses products.js + demo checkout

  const endpoint = `https://${cfg.domain}/api/${cfg.apiVersion}/graphql.json`;

  async function gql(query, variables) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': cfg.token
      },
      body: JSON.stringify({ query, variables })
    });
    const j = await r.json();
    if (j.errors) throw new Error(JSON.stringify(j.errors));
    return j.data;
  }

  /* ——— 1. Pull products and merge into window.PRODUCTS ——— */
  const PRODUCTS_QUERY = `
    query {
      products(first: 60) {
        edges { node {
          handle
          title
          description
          featuredImage { url }
          priceRange { minVariantPrice { amount } }
          options { name values }
          variants(first: 30) { edges { node {
            id
            availableForSale
            price { amount }
            selectedOptions { name value }
          } } }
        } }
      }
    }`;

  async function syncProducts() {
    const data = await gql(PRODUCTS_QUERY);
    const edges = (data.products && data.products.edges) || [];
    edges.forEach(({ node }) => {
      const handle = node.handle;
      const target = window.PRODUCTS && window.PRODUCTS[handle];
      // Only merge into products the site already knows about
      if (!target) return;

      // Size option (if any)
      const sizeOpt = (node.options || []).find(o => /size/i.test(o.name));
      const variants = (node.variants.edges || []).map(e => e.node);

      // Build variant map: sizeValue (or 'Default') -> variant GID
      const vmap = {};
      variants.forEach(v => {
        const so = (v.selectedOptions || []).find(o => /size/i.test(o.name));
        const key = so ? so.value : 'Default Title';
        vmap[key] = v.id;
      });
      window.bpsShopify.variantMap[handle] = vmap;

      // Merge live fields (Shopify is the source of truth)
      target.name = node.title || target.name;
      if (node.description) target.description = node.description;
      const price = node.priceRange && node.priceRange.minVariantPrice && node.priceRange.minVariantPrice.amount;
      if (price) target.price = Math.round(parseFloat(price) * 100) / 100;
      if (sizeOpt && sizeOpt.values && sizeOpt.values.length && !(sizeOpt.values.length === 1 && sizeOpt.values[0] === 'Default Title')) {
        target.sizes = sizeOpt.values;
      }
      if (node.featuredImage && node.featuredImage.url) target.image = node.featuredImage.url;
      // A product live in Shopify is real, never a placeholder
      target.comingSoon = false;
      target._shopify = true;
      const anyAvailable = variants.some(v => v.availableForSale);
      target._soldOut = !anyAvailable;
    });
    window.bpsShopify._loaded = true;
    document.dispatchEvent(new CustomEvent('bps:products-updated'));
  }

  /* ——— 2. Checkout: build a Shopify cart and redirect to hosted checkout ——— */
  const CART_CREATE = `
    mutation cartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }`;

  window.bpsShopify.checkout = async function (items) {
    // items: [{ id, size, qty }]
    const lines = [];
    const unmatched = [];
    (items || []).forEach(it => {
      const vmap = window.bpsShopify.variantMap[it.id];
      const vid = vmap && (vmap[it.size] || vmap['Default Title'] || Object.values(vmap)[0]);
      if (vid) lines.push({ merchandiseId: vid, quantity: it.qty || 1 });
      else unmatched.push(it);
    });
    if (!lines.length) throw new Error('No Shopify variants matched the cart.');
    const data = await gql(CART_CREATE, { lines });
    const res = data.cartCreate;
    if (res.userErrors && res.userErrors.length) throw new Error(res.userErrors[0].message);
    return { url: res.cart.checkoutUrl, unmatched };
  };

  // Kick off the product sync as soon as products.js is available
  function start() {
    if (!window.PRODUCTS) { setTimeout(start, 60); return; }
    syncProducts().catch(err => console.warn('[shopify] product sync failed:', err));
  }
  start();
})();
