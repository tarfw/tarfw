import { Hono } from 'hono';
import type { Bindings, Variables, StoreData, DesignNode } from '../lib/types';
import { getStatesDb, getInstancesDb } from '../db/client';
import {
  getProducts, getProductByUcode, getCategories, getSections,
  getPageBySlug, getProductsWithInstances, getInstanceForProduct,
} from '../db/queries';
import { buildPage, renderDesignTree } from '../lib/renderer';
import {
  homePage, catalogPage, productDetailPage, cartPage,
  checkoutPage, orderConfirmPage, cmsPage, searchPage, notFoundPage,
} from '../templates/fallback';
import { getCart, setCartCookie, addToCart, updateCartItem, removeFromCart, cartCount, type Cart } from '../lib/cart';

const store = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Cache durations (seconds) ───
const CACHE_STORE_CONFIG = 300;  // 5 min
const CACHE_PRODUCT_LIST = 60;   // 1 min
const CACHE_PRODUCT_DETAIL = 60; // 1 min
const CACHE_STATIC = 31536000;   // 1 year

function withCache(res: Response, maxAge: number, isPublic = true): Response {
  res.headers.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=${maxAge}, s-maxage=${maxAge}`);
  return res;
}

function noCache(res: Response): Response {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

/** Helper: build full HTML page using theme + body */
function wrapPage(storeConfig: StoreData['store'], title: string, bodyHtml: string): string {
  const theme = storeConfig.theme;
  const desc = storeConfig.seo?.description || storeConfig.tagline || '';
  return buildPage({
    title: `${title} — ${storeConfig.name}`,
    description: desc,
    ogImage: storeConfig.seo?.ogImage || storeConfig.coverImage,
    theme,
    bodyHtml,
    bodyCss: '',
    hasAnimations: false,
  });
}

/** Helper: try rendering from design tree sections, fallback to templates */
async function renderWithDesignTree(
  sections: { ucode: string; payload: any }[],
  data: StoreData,
  fallbackHtml: string
): Promise<{ html: string; css: string } | null> {
  // Filter sections that have design trees
  const designSections = sections
    .filter(s => s.payload?.design)
    .sort((a, b) => (a.payload?.order || 0) - (b.payload?.order || 0));

  if (designSections.length === 0) return null;

  // Collect component templates (role: "component")
  const components: Record<string, DesignNode> = {};
  for (const s of sections) {
    if (s.payload?.role === 'component' && s.payload?.design) {
      components[s.ucode] = s.payload.design;
    }
  }

  const trees = designSections.map(s => s.payload.design as DesignNode);
  return renderDesignTree(trees, data, components);
}

// ─── Homepage ───
store.get('/', async (c) => {
  const scope = c.get('scope');
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);

  const statesDb = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const instancesDb = getInstancesDb(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

  const [products, categories, sections] = await Promise.all([
    getProductsWithInstances(statesDb, instancesDb, scope, 12),
    getCategories(statesDb, scope),
    getSections(statesDb, scope),
  ]);

  const data: StoreData = {
    store: storeConfig,
    products,
    categories,
  };

  // Try design tree rendering
  const designResult = await renderWithDesignTree(sections, data, '');
  if (designResult) {
    const res = c.html(buildPage({
      title: storeConfig.name,
      description: storeConfig.seo?.description || storeConfig.tagline || '',
      ogImage: storeConfig.seo?.ogImage || storeConfig.coverImage,
      theme: storeConfig.theme,
      bodyHtml: designResult.html,
      bodyCss: designResult.css,
      hasAnimations: true,
      cartJs: cartScript(slug),
    }));
    return withCache(res, CACHE_PRODUCT_LIST);
  }

  // Fallback to static templates
  const bodyHtml = homePage(storeConfig, products, categories, slug, cart);
  return withCache(c.html(wrapPage(storeConfig, 'Home', bodyHtml + cartScript(slug))), CACHE_PRODUCT_LIST);
});

// ─── Products Catalog ───
store.get('/products', async (c) => {
  const scope = c.get('scope');
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);

  const statesDb = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const instancesDb = getInstancesDb(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

  const [products, categories] = await Promise.all([
    getProductsWithInstances(statesDb, instancesDb, scope, 50),
    getCategories(statesDb, scope),
  ]);

  const bodyHtml = catalogPage(storeConfig, products, categories, slug, cart);
  return withCache(c.html(wrapPage(storeConfig, 'Products', bodyHtml + cartScript(slug))), CACHE_PRODUCT_LIST);
});

// ─── Category ───
store.get('/category/:ucode', async (c) => {
  const scope = c.get('scope');
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);
  const ucode = decodeURIComponent(c.req.param('ucode'));

  const statesDb = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const instancesDb = getInstancesDb(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

  // Get all products and filter by category reference in payload
  const [allProducts, categories] = await Promise.all([
    getProductsWithInstances(statesDb, instancesDb, scope, 50),
    getCategories(statesDb, scope),
  ]);

  // Filter products that belong to this category
  const catId = ucode.split(':')[1];
  const products = allProducts.filter(p =>
    p.payload?.category === ucode || p.payload?.category === catId
  );

  const cat = categories.find(cc => cc.ucode === ucode);
  const bodyHtml = catalogPage(storeConfig, products, categories, slug, cart, ucode);
  return withCache(c.html(wrapPage(storeConfig, cat?.title || catId || 'Category', bodyHtml + cartScript(slug))), CACHE_PRODUCT_LIST);
});

// ─── Product Detail ───
store.get('/product/:ucode', async (c) => {
  const scope = c.get('scope');
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);
  const ucode = decodeURIComponent(c.req.param('ucode'));

  const statesDb = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const instancesDb = getInstancesDb(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

  const product = await getProductByUcode(statesDb, ucode, scope);
  if (!product) {
    return c.html(wrapPage(storeConfig, 'Not Found', notFoundPage(storeConfig, slug, cart)), 404);
  }

  const instance = await getInstanceForProduct(instancesDb, ucode, scope);
  product.instance = instance || { qty: null, value: product.payload?.price || null, currency: 'INR', available: true };

  const bodyHtml = productDetailPage(storeConfig, product, slug, cart);
  return withCache(c.html(wrapPage(storeConfig, product.title || ucode, bodyHtml + cartScript(slug))), CACHE_PRODUCT_DETAIL);
});

// ─── Cart Page ───
store.get('/cart', (c) => {
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);

  const bodyHtml = cartPage(storeConfig, cart, slug);
  return noCache(c.html(wrapPage(storeConfig, 'Cart', bodyHtml + cartScript(slug))));
});

// ─── Checkout (GET = form, POST = place order) ───
store.get('/checkout', (c) => {
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);

  const bodyHtml = checkoutPage(storeConfig, cart, slug);
  return noCache(c.html(wrapPage(storeConfig, 'Checkout', bodyHtml)));
});

store.post('/checkout', async (c) => {
  const slug = c.get('slug');
  const scope = c.get('scope');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);

  if (cart.items.length === 0) {
    return c.redirect(`/${slug}/cart`);
  }

  const body = await c.req.parseBody();
  const orderId = crypto.randomUUID().slice(0, 8);

  // Place order via taragent event API
  try {
    const total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    await fetch(`${c.env.TARAGENT_API}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opcode: 501,
        streamid: `order:${orderId}`,
        delta: 1,
        scope,
        payload: {
          customer: {
            name: body.name,
            phone: body.phone,
            email: body.email || null,
            address: body.address,
            city: body.city,
            pincode: body.pincode,
          },
          items: cart.items.map(i => ({
            ucode: i.ucode,
            title: i.title,
            qty: i.qty,
            price: i.price,
            subtotal: i.price * i.qty,
          })),
          total,
          currency: storeConfig.currency,
        },
      }),
    });

    // Stock adjustments for each item
    for (const item of cart.items) {
      fetch(`${c.env.TARAGENT_API}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opcode: 104,
          streamid: item.ucode,
          delta: -item.qty,
          scope,
          payload: { orderId, reason: 'sale' },
        }),
      }).catch(() => {}); // fire and forget
    }
  } catch (err: any) {
    console.error('[checkout] Event API error:', err.message);
  }

  // Clear cart
  const bodyHtml = orderConfirmPage(storeConfig, orderId, slug);
  const res = new Response(wrapPage(storeConfig, 'Order Confirmed', bodyHtml), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  res.headers.set('Set-Cookie', setCartCookie({ items: [] }));
  return res;
});

// ─── Order Confirmation ───
store.get('/order/:id', (c) => {
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const orderId = c.req.param('id');

  const bodyHtml = orderConfirmPage(storeConfig, orderId, slug);
  return c.html(wrapPage(storeConfig, 'Order', bodyHtml));
});

// ─── CMS Pages ───
store.get('/page/:slug', async (c) => {
  const scope = c.get('scope');
  const storeSlug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);
  const pageSlug = c.req.param('slug');

  const db = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const page = await getPageBySlug(db, pageSlug, scope);

  if (!page) {
    return c.html(wrapPage(storeConfig, 'Not Found', notFoundPage(storeConfig, storeSlug, cart)), 404);
  }

  const bodyHtml = cmsPage(storeConfig, page, storeSlug, cart);
  return withCache(c.html(wrapPage(storeConfig, page.title || pageSlug, bodyHtml)), CACHE_STORE_CONFIG);
});

// ─── Search ───
store.get('/search', async (c) => {
  const scope = c.get('scope');
  const slug = c.get('slug');
  const storeConfig = c.get('storeConfig')!;
  const cart = getCart(c);
  const query = c.req.query('q') || '';

  const statesDb = getStatesDb(c.env.STATES_DB_URL, c.env.STATES_DB_TOKEN);
  const instancesDb = getInstancesDb(c.env.INSTANCES_DB_URL, c.env.INSTANCES_DB_TOKEN);

  let products = await getProductsWithInstances(statesDb, instancesDb, scope, 50);

  if (query) {
    const q = query.toLowerCase();
    products = products.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.ucode || '').toLowerCase().includes(q) ||
      (p.payload?.brand || '').toLowerCase().includes(q) ||
      (p.payload?.description || '').toLowerCase().includes(q)
    );
  }

  const bodyHtml = searchPage(storeConfig, products, query, slug, cart);
  return withCache(c.html(wrapPage(storeConfig, query ? `Search: ${query}` : 'Search', bodyHtml)), CACHE_PRODUCT_LIST);
});

// ─── Cart API (JSON endpoints) ───

store.post('/api/cart/add', async (c) => {
  const body = await c.req.json();
  let cart = getCart(c);
  cart = addToCart(cart, {
    ucode: body.ucode,
    title: body.title,
    price: body.price,
    qty: body.qty || 1,
    image: body.image,
  });
  return new Response(JSON.stringify({ count: cartCount(cart), items: cart.items }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCartCookie(cart),
    },
  });
});

store.post('/api/cart/update', async (c) => {
  const body = await c.req.json();
  let cart = getCart(c);
  cart = updateCartItem(cart, body.ucode, body.qty);
  return new Response(JSON.stringify({ count: cartCount(cart), items: cart.items }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCartCookie(cart),
    },
  });
});

store.post('/api/cart/remove', async (c) => {
  const body = await c.req.json();
  let cart = getCart(c);
  cart = removeFromCart(cart, body.ucode);
  return new Response(JSON.stringify({ count: cartCount(cart), items: cart.items }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCartCookie(cart),
    },
  });
});

store.get('/api/cart', (c) => {
  const cart = getCart(c);
  return c.json({ count: cartCount(cart), items: cart.items });
});

// ─── Cart client JS (injected into pages) ───
function cartScript(slug: string): string {
  const base = `/${slug}`;
  return `<script>
function addToCart(u,t,p,img){
  fetch('${base}/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ucode:u,title:t,price:p,qty:1,image:img})})
  .then(r=>r.json()).then(d=>{
    var b=document.querySelector('nav a[href*="cart"] span');
    if(b)b.textContent=d.count;
    else{var a=document.querySelector('nav a[href*="cart"]');if(a)a.innerHTML='Cart <span style="background:var(--primary);color:var(--bg);font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px">'+d.count+'</span>'}
  });
}
function updateCart(u,q){
  fetch('${base}/api/cart/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ucode:u,qty:q})})
  .then(()=>location.reload());
}
function removeItem(u){
  fetch('${base}/api/cart/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ucode:u})})
  .then(()=>location.reload());
}
</script>`;
}

export default store;
