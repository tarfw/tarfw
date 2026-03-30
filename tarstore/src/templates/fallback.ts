import type { StoreData, ProductData, CategoryData, ThemeConfig } from '../lib/types';
import type { Cart } from '../lib/cart';
import { cartCount, cartTotal } from '../lib/cart';

/** Escape HTML entities */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtPrice(val: number | null | undefined, sym: string): string {
  if (val === null || val === undefined) return '';
  return `${sym}${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ─── Shared Layout Pieces ───

export function nav(store: StoreData['store'], slug: string, cart: Cart): string {
  const base = `/${slug}`;
  const count = cartCount(cart);
  return `<nav style="display:flex;align-items:center;justify-content:space-between;padding:16px 40px;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)">
  <a href="${base}" style="font-family:var(--font-display);font-size:22px;font-weight:600;text-decoration:none;color:var(--text)">${esc(store.name)}</a>
  <div style="display:flex;gap:24px;align-items:center;font-size:14px">
    <a href="${base}/products" style="text-decoration:none;color:var(--text-muted)">Products</a>
    <a href="${base}/cart" style="text-decoration:none;color:var(--text-muted);position:relative">Cart${count > 0 ? ` <span style="background:var(--primary);color:var(--bg);font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px">${count}</span>` : ''}</a>
  </div>
</nav>`;
}

export function footer(store: StoreData['store'], slug: string): string {
  const base = `/${slug}`;
  return `<footer style="padding:48px 40px;border-top:1px solid var(--border);text-align:center;color:var(--text-muted);font-size:13px;margin-top:80px">
  <div style="display:flex;gap:24px;justify-content:center;margin-bottom:16px">
    <a href="${base}/page/about" style="text-decoration:none;color:var(--text-muted)">About</a>
    <a href="${base}/page/contact" style="text-decoration:none;color:var(--text-muted)">Contact</a>
    <a href="${base}/page/returns" style="text-decoration:none;color:var(--text-muted)">Returns</a>
  </div>
  <p>&copy; ${new Date().getFullYear()} ${esc(store.name)}</p>
</footer>`;
}

// ─── Pages ───

export function homePage(store: StoreData['store'], products: ProductData[], categories: CategoryData[], slug: string, cart: Cart): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;

  const heroHtml = `<section style="min-height:60vh;display:flex;align-items:center;padding:80px 40px;background:linear-gradient(135deg,var(--bg) 0%,var(--surface) 100%)">
  <div style="max-width:600px">
    ${store.tagline ? `<p style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--text-muted);margin-bottom:16px">${esc(store.tagline)}</p>` : ''}
    <h1 style="font-family:var(--font-display);font-size:clamp(36px,5vw,64px);font-weight:300;line-height:1.1;color:var(--text);margin-bottom:32px">${esc(store.name)}</h1>
    <a href="${base}/products" style="display:inline-block;padding:14px 40px;background:var(--primary);color:var(--bg);text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;transition:opacity 0.3s">Shop Now</a>
  </div>
</section>`;

  const catsHtml = categories.length > 0 ? `<section style="padding:60px 40px">
  <h2 style="font-family:var(--font-display);font-size:28px;font-weight:400;margin-bottom:32px;color:var(--text)">Categories</h2>
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    ${categories.map(c => `<a href="${base}/category/${encodeURIComponent(c.ucode)}" style="padding:10px 24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text);font-size:14px;transition:border-color 0.2s">${esc(c.title || c.ucode.split(':')[1])}</a>`).join('')}
  </div>
</section>` : '';

  const prodsHtml = products.length > 0 ? `<section style="padding:60px 40px">
  <h2 style="font-family:var(--font-display);font-size:28px;font-weight:400;margin-bottom:32px;color:var(--text)">Products</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px">
    ${products.map(p => productCard(p, sym, base)).join('')}
  </div>
</section>` : '';

  return nav(store, slug, cart) + heroHtml + catsHtml + prodsHtml + footer(store, slug);
}

export function productCard(p: ProductData, sym: string, base: string): string {
  const img = p.payload?.images?.[0];
  const price = p.instance?.value ?? p.payload?.price;
  return `<a href="${base}/product/${encodeURIComponent(p.ucode)}" style="text-decoration:none;color:inherit;background:var(--surface);border-radius:var(--radius);overflow:hidden;transition:transform 0.3s;display:block">
  ${img ? `<div style="aspect-ratio:1;overflow:hidden"><img src="${esc(img)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;transition:transform 0.4s" loading="lazy"></div>` : `<div style="aspect-ratio:1;background:var(--border)"></div>`}
  <div style="padding:16px">
    <h3 style="font-size:15px;font-weight:500;margin-bottom:4px">${esc(p.title || p.ucode.split(':')[1])}</h3>
    ${price != null ? `<span style="font-size:14px;color:var(--text-muted)">${fmtPrice(price, sym)}</span>` : ''}
  </div>
</a>`;
}

export function catalogPage(store: StoreData['store'], products: ProductData[], categories: CategoryData[], slug: string, cart: Cart, activeCategory?: string): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;

  return nav(store, slug, cart) + `<section style="padding:40px">
  <h1 style="font-family:var(--font-display);font-size:32px;font-weight:400;margin-bottom:24px">Products</h1>
  ${categories.length > 0 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px">
    <a href="${base}/products" style="padding:8px 20px;border-radius:20px;font-size:13px;text-decoration:none;${!activeCategory ? 'background:var(--primary);color:var(--bg)' : 'background:var(--surface);color:var(--text);border:1px solid var(--border)'}"}>All</a>
    ${categories.map(c => `<a href="${base}/category/${encodeURIComponent(c.ucode)}" style="padding:8px 20px;border-radius:20px;font-size:13px;text-decoration:none;${activeCategory === c.ucode ? 'background:var(--primary);color:var(--bg)' : 'background:var(--surface);color:var(--text);border:1px solid var(--border)'}">${esc(c.title || c.ucode.split(':')[1])}</a>`).join('')}
  </div>` : ''}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px">
    ${products.map(p => productCard(p, sym, base)).join('')}
  </div>
  ${products.length === 0 ? '<p style="color:var(--text-muted);padding:40px 0;text-align:center">No products yet.</p>' : ''}
</section>` + footer(store, slug);
}

export function productDetailPage(store: StoreData['store'], product: ProductData, slug: string, cart: Cart): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;
  const p = product.payload || {};
  const price = product.instance?.value ?? p.price;
  const images: string[] = p.images || [];
  const sizes: string[] = p.sizes || [];
  const colors: string[] = p.colors || [];
  const qty = product.instance?.qty;
  const available = product.instance?.available !== false;

  return nav(store, slug, cart) + `<section style="padding:60px 40px;display:grid;grid-template-columns:1fr 1fr;gap:60px;max-width:1100px;margin:0 auto">
  <div>
    ${images.length > 0 ? `<img src="${esc(images[0])}" alt="${esc(product.title)}" style="width:100%;border-radius:var(--radius);aspect-ratio:1;object-fit:cover">` : `<div style="aspect-ratio:1;background:var(--surface);border-radius:var(--radius)"></div>`}
    ${images.length > 1 ? `<div style="display:flex;gap:8px;margin-top:12px">${images.slice(1, 5).map(img => `<img src="${esc(img)}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid var(--border);cursor:pointer" loading="lazy">`).join('')}</div>` : ''}
  </div>
  <div>
    ${p.brand ? `<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">${esc(p.brand)}</p>` : ''}
    <h1 style="font-family:var(--font-display);font-size:32px;font-weight:400;margin-bottom:16px">${esc(product.title || product.ucode.split(':')[1])}</h1>
    ${price != null ? `<p style="font-size:24px;color:var(--text);margin-bottom:24px">${fmtPrice(price, sym)}</p>` : ''}
    ${p.description ? `<p style="color:var(--text-muted);line-height:1.7;margin-bottom:24px">${esc(p.description)}</p>` : ''}
    ${sizes.length > 0 ? `<div style="margin-bottom:20px"><p style="font-size:13px;font-weight:600;margin-bottom:8px">Size</p><div style="display:flex;gap:8px">${sizes.map(s => `<span style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;font-size:13px;cursor:pointer">${esc(s)}</span>`).join('')}</div></div>` : ''}
    ${colors.length > 0 ? `<div style="margin-bottom:24px"><p style="font-size:13px;font-weight:600;margin-bottom:8px">Color</p><div style="display:flex;gap:8px">${colors.map(c => `<span style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;font-size:13px;cursor:pointer">${esc(c)}</span>`).join('')}</div></div>` : ''}
    ${available
      ? `<button onclick="addToCart('${esc(product.ucode)}','${esc(product.title)}',${price || 0},'${esc(images[0] || '')}')" style="display:block;width:100%;padding:16px;background:var(--primary);color:var(--bg);border:none;font-size:14px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:var(--radius);transition:opacity 0.3s;margin-bottom:16px">Add to Cart</button>`
      : `<button disabled style="display:block;width:100%;padding:16px;background:var(--border);color:var(--text-muted);border:none;font-size:14px;cursor:not-allowed;border-radius:var(--radius)">Out of Stock</button>`}
    ${qty != null ? `<p style="font-size:13px;color:var(--text-muted);text-align:center">${qty > 0 ? `${qty} in stock` : 'Out of stock'}</p>` : ''}
    ${p.sku ? `<p style="font-size:12px;color:var(--text-muted);margin-top:24px">SKU: ${esc(p.sku)}</p>` : ''}
  </div>
</section>` + footer(store, slug);
}

export function cartPage(store: StoreData['store'], cart: Cart, slug: string): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;
  const total = cartTotal(cart);

  return nav(store, slug, cart) + `<section style="padding:40px;max-width:800px;margin:0 auto">
  <h1 style="font-family:var(--font-display);font-size:32px;font-weight:400;margin-bottom:32px">Your Cart</h1>
  ${cart.items.length === 0 ? `<div style="text-align:center;padding:60px 0">
    <p style="color:var(--text-muted);margin-bottom:24px">Your cart is empty.</p>
    <a href="${base}/products" style="display:inline-block;padding:12px 32px;background:var(--primary);color:var(--bg);text-decoration:none;border-radius:var(--radius);font-size:14px">Browse Products</a>
  </div>` : `<div>
    ${cart.items.map(item => `<div style="display:flex;align-items:center;gap:16px;padding:20px 0;border-bottom:1px solid var(--border)">
      ${item.image ? `<img src="${esc(item.image)}" style="width:64px;height:64px;object-fit:cover;border-radius:4px">` : `<div style="width:64px;height:64px;background:var(--surface);border-radius:4px"></div>`}
      <div style="flex:1">
        <p style="font-weight:500">${esc(item.title)}</p>
        <p style="font-size:13px;color:var(--text-muted)">${fmtPrice(item.price, sym)} x ${item.qty}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="updateCart('${esc(item.ucode)}',${item.qty - 1})" style="width:32px;height:32px;border:1px solid var(--border);background:var(--bg);border-radius:4px;cursor:pointer;font-size:16px">-</button>
        <span style="min-width:20px;text-align:center">${item.qty}</span>
        <button onclick="updateCart('${esc(item.ucode)}',${item.qty + 1})" style="width:32px;height:32px;border:1px solid var(--border);background:var(--bg);border-radius:4px;cursor:pointer;font-size:16px">+</button>
      </div>
      <p style="font-weight:600;min-width:80px;text-align:right">${fmtPrice(item.price * item.qty, sym)}</p>
      <button onclick="removeItem('${esc(item.ucode)}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px">&times;</button>
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:16px">
      <span style="font-size:18px;font-weight:600">Total</span>
      <span style="font-size:22px;font-weight:600">${fmtPrice(total, sym)}</span>
    </div>
    <a href="${base}/checkout" style="display:block;text-align:center;padding:16px;background:var(--primary);color:var(--bg);text-decoration:none;border-radius:var(--radius);font-size:14px;letter-spacing:1px;text-transform:uppercase;transition:opacity 0.3s">Proceed to Checkout</a>
  </div>`}
</section>` + footer(store, slug);
}

export function checkoutPage(store: StoreData['store'], cart: Cart, slug: string): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;
  const total = cartTotal(cart);

  if (cart.items.length === 0) {
    return nav(store, slug, cart) + `<section style="padding:60px 40px;text-align:center">
      <p>Your cart is empty.</p>
      <a href="${base}/products" style="display:inline-block;margin-top:16px;padding:12px 32px;background:var(--primary);color:var(--bg);text-decoration:none;border-radius:var(--radius)">Shop Now</a>
    </section>` + footer(store, slug);
  }

  return nav(store, slug, cart) + `<section style="padding:40px;max-width:700px;margin:0 auto">
  <h1 style="font-family:var(--font-display);font-size:32px;font-weight:400;margin-bottom:32px">Checkout</h1>
  <form method="POST" action="${base}/checkout">
    <fieldset style="border:none;padding:0;margin-bottom:32px">
      <legend style="font-size:16px;font-weight:600;margin-bottom:16px">Contact</legend>
      <input name="name" placeholder="Full Name" required style="display:block;width:100%;padding:12px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
      <input name="phone" type="tel" placeholder="Phone" required style="display:block;width:100%;padding:12px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
      <input name="email" type="email" placeholder="Email (optional)" style="display:block;width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
    </fieldset>
    <fieldset style="border:none;padding:0;margin-bottom:32px">
      <legend style="font-size:16px;font-weight:600;margin-bottom:16px">Delivery Address</legend>
      <textarea name="address" placeholder="Address" required rows="3" style="display:block;width:100%;padding:12px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit;resize:vertical"></textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <input name="city" placeholder="City" required style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
        <input name="pincode" placeholder="Pincode" required style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
      </div>
    </fieldset>
    <div style="border-top:1px solid var(--border);padding-top:24px;margin-bottom:24px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Order Summary</h3>
      ${cart.items.map(i => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:var(--text-muted)"><span>${esc(i.title)} &times; ${i.qty}</span><span>${fmtPrice(i.price * i.qty, sym)}</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:600;border-top:1px solid var(--border);margin-top:8px"><span>Total</span><span>${fmtPrice(total, sym)}</span></div>
    </div>
    <button type="submit" style="display:block;width:100%;padding:16px;background:var(--primary);color:var(--bg);border:none;font-size:14px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:var(--radius);margin-bottom:12px">Place Order</button>
    ${store.phone ? `<a href="https://wa.me/${store.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('New Order:\n' + cart.items.map(i => `${i.qty}x ${i.title} ${fmtPrice(i.price * i.qty, sym)}`).join('\n') + `\nTotal: ${fmtPrice(total, sym)}`)}" target="_blank" style="display:block;text-align:center;padding:14px;background:#25D366;color:white;text-decoration:none;border-radius:var(--radius);font-size:14px">Order via WhatsApp</a>` : ''}
  </form>
</section>` + footer(store, slug);
}

export function orderConfirmPage(store: StoreData['store'], orderId: string, slug: string): string {
  const base = `/${slug}`;
  return nav(store, slug, { items: [] }) + `<section style="padding:80px 40px;text-align:center;max-width:600px;margin:0 auto">
  <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
  <h1 style="font-family:var(--font-display);font-size:28px;font-weight:400;margin-bottom:12px">Order Placed!</h1>
  <p style="color:var(--text-muted);margin-bottom:8px">Order ID: <code style="background:var(--surface);padding:2px 8px;border-radius:4px">${esc(orderId)}</code></p>
  <p style="color:var(--text-muted);margin-bottom:32px">We'll reach out with updates soon.</p>
  <a href="${base}" style="display:inline-block;padding:12px 32px;background:var(--primary);color:var(--bg);text-decoration:none;border-radius:var(--radius)">Back to Store</a>
</section>` + footer(store, slug);
}

export function cmsPage(store: StoreData['store'], page: { title: string; payload: Record<string, any> }, slug: string, cart: Cart): string {
  const content = page.payload?.content || '';
  return nav(store, slug, cart) + `<section style="padding:60px 40px;max-width:700px;margin:0 auto">
  <h1 style="font-family:var(--font-display);font-size:32px;font-weight:400;margin-bottom:24px">${esc(page.title || '')}</h1>
  <div style="line-height:1.8;color:var(--text-muted)">${content}</div>
</section>` + footer(store, slug);
}

export function searchPage(store: StoreData['store'], products: ProductData[], query: string, slug: string, cart: Cart): string {
  const sym = store.currencySymbol || '₹';
  const base = `/${slug}`;

  return nav(store, slug, cart) + `<section style="padding:40px">
  <form action="${base}/search" method="GET" style="margin-bottom:32px">
    <input name="q" value="${esc(query)}" placeholder="Search products..." style="width:100%;max-width:400px;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit">
  </form>
  ${query ? `<p style="color:var(--text-muted);margin-bottom:24px">${products.length} result${products.length !== 1 ? 's' : ''} for "${esc(query)}"</p>` : ''}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px">
    ${products.map(p => productCard(p, sym, base)).join('')}
  </div>
  ${products.length === 0 && query ? '<p style="text-align:center;padding:40px;color:var(--text-muted)">No products found.</p>' : ''}
</section>` + footer(store, slug);
}

export function notFoundPage(store: StoreData['store'], slug: string, cart: Cart): string {
  const base = `/${slug}`;
  return nav(store, slug, cart) + `<section style="padding:80px 40px;text-align:center">
  <h1 style="font-size:48px;font-weight:300;margin-bottom:16px">404</h1>
  <p style="color:var(--text-muted);margin-bottom:24px">Page not found.</p>
  <a href="${base}" style="display:inline-block;padding:12px 32px;background:var(--primary);color:var(--bg);text-decoration:none;border-radius:var(--radius)">Back to Store</a>
</section>` + footer(store, slug);
}
