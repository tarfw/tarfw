# TAR Storefront — Plan A: Single Worker + Dynamic Routing

## Overview

Each store owner (user with a scope like `shop:ramstore`) gets a public-facing ecommerce website powered by a **single Cloudflare Worker** that dynamically renders storefronts based on the URL.

```
Customer visits:  https://ramstore.tarshop.com
                  or https://tarshop.com/ramstore

Worker extracts:  slug = "ramstore" → scope = "shop:ramstore"

Worker fetches:   States DB  → products, categories, store config, pages
                  Instances DB → stock levels, prices, availability

Worker renders:   Full HTML storefront with products, cart, checkout
```

The store owner manages everything from the **TAR mobile app** (or admin frontend). Customers only see the public storefront.

---

## Architecture

### URL Routing Strategy

**Option 1 — Subdomain routing (recommended for production)**
```
https://{slug}.tarshop.com → scope: shop:{slug}
```
- Requires wildcard DNS: `*.tarshop.com → Cloudflare Worker`
- Cloudflare Worker Route: `*.tarshop.com/*`
- Each store feels like its own independent site
- Better for SEO, branding, and customer trust

**Option 2 — Path-based routing (simpler for development)**
```
https://tarshop.com/{slug}          → scope: shop:{slug}
https://tarshop.com/{slug}/product/coffee  → product detail
```
- Single domain, single DNS record
- Easier to set up initially
- Can migrate to subdomains later

**We'll support both.** The Worker checks for subdomain first, falls back to path.

### Request Flow

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Customer   │────▶│  tarstore Worker  │────▶│  States DB    │
│   Browser    │     │  (Hono SSR)       │     │  (Turso)      │
│              │◀────│                   │────▶│  Instances DB │
│              │     │  Extracts slug    │     │  (Turso)      │
│              │     │  Renders HTML     │     └───────────────┘
│              │     │  Handles cart     │
│              │     │  Places orders    │────▶│  OrderDO      │
└──────────────┘     └──────────────────┘     │  (events)     │
                                               └───────────────┘
```

---

## Pages & Routes

The storefront Worker serves these routes per store:

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Home** | Store banner, featured products, categories |
| `/products` | **Catalog** | All products grid with category filter |
| `/product/:ucode` | **Product Detail** | Single product with images, price, add-to-cart |
| `/category/:ucode` | **Category** | Products filtered by category |
| `/cart` | **Cart** | Client-side cart review, quantity edit |
| `/checkout` | **Checkout** | Customer info form, place order |
| `/order/:id` | **Order Confirmation** | Thank you + order summary |
| `/page/:slug` | **Custom Page** | CMS pages (about, contact, returns policy) |
| `/search?q=` | **Search** | Text search across products |

---

## Data Model — What Already Exists vs What's New

### Already exists in TAR (no changes needed)

| Entity | State Type | Key Payload Fields |
|--------|-----------|-------------------|
| Products | `product:*` | price, currency, brand, sku, sizes, colors, images |
| Categories | `category:*` | parentCategory, icon, displayOrder |
| Brands | `brand:*` | logo, website, country |
| Collections | `collection:*` | description, tags, productIds |
| Store Config | `store:*` | address, lat/lng, phone, hours |
| Pages | `page:*` | slug, content, seoTitle, seoDesc |
| Media | `media:*` | url, mimeType, size, alt |
| Instances | `instance` table | qty, value, currency, available, location |

### New: Store Theme/Config (extend `store` state payload)

The `store:main` state (or `store:ramstore`) payload gets additional fields for storefront rendering:

```json
{
  "address": "123 Main St",
  "phone": "+91-9876543210",
  "hours": "9am-9pm",

  "storeName": "Ram's Store",
  "tagline": "Quality products at fair prices",
  "logo": "https://cdn.example.com/logo.png",
  "favicon": "https://cdn.example.com/favicon.ico",
  "coverImage": "https://cdn.example.com/banner.jpg",

  "theme": {
    "primaryColor": "#007AFF",
    "accentColor": "#FF9500",
    "fontFamily": "Inter",
    "layout": "grid"
  },

  "seo": {
    "title": "Ram's Store - Quality Products",
    "description": "Shop the best products at Ram's Store",
    "ogImage": "https://cdn.example.com/og.jpg"
  },

  "currency": "INR",
  "currencySymbol": "₹",

  "social": {
    "instagram": "https://instagram.com/ramstore",
    "whatsapp": "+91-9876543210"
  },

  "features": {
    "search": true,
    "categories": true,
    "cart": true,
    "checkout": true,
    "whatsappOrder": true
  }
}
```

No schema migration needed — this goes in the existing `payload` JSON column of the `state` table.

---

## New Worker: `tarstore`

### Directory Structure

```
tarstore/
├── src/
│   ├── index.ts              # Hono app, route definitions
│   ├── middleware/
│   │   └── store.ts          # Extract slug → scope, load store config
│   ├── routes/
│   │   ├── home.ts           # GET / → homepage
│   │   ├── catalog.ts        # GET /products, /category/:ucode
│   │   ├── product.ts        # GET /product/:ucode
│   │   ├── cart.ts           # Cart API (client-side + endpoints)
│   │   ├── checkout.ts       # GET /checkout, POST /checkout
│   │   ├── order.ts          # GET /order/:id
│   │   ├── page.ts           # GET /page/:slug
│   │   └── search.ts         # GET /search?q=
│   ├── templates/
│   │   ├── layout.ts         # Base HTML shell (head, nav, footer)
│   │   ├── home.ts           # Homepage template
│   │   ├── productCard.ts    # Reusable product card
│   │   ├── productDetail.ts  # Product detail page
│   │   ├── catalog.ts        # Product grid
│   │   ├── cart.ts           # Cart page
│   │   ├── checkout.ts       # Checkout form
│   │   ├── orderConfirm.ts   # Order confirmation
│   │   └── page.ts           # CMS page
│   ├── db/
│   │   └── client.ts         # Turso client (reuse from taragent)
│   └── lib/
│       ├── cart.ts           # Cart logic (cookie-based)
│       └── helpers.ts        # Price formatting, image URLs, etc.
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

### Tech Stack

- **Hono** — Same framework as taragent, SSR with `c.html()`
- **Template strings** — Pure TypeScript HTML templates (no JSX/React dependency)
- **Turso** — Same DB client, read-only for storefront
- **Cookie-based cart** — No login required for customers to browse/add to cart
- **OrderDO** — Existing Durable Object receives orders via event API

### Why a Separate Worker (not routes in taragent)?

1. **Security isolation** — Storefront is fully public; taragent has admin APIs
2. **Independent scaling** — Storefront traffic patterns differ from admin
3. **Custom domains** — Each Worker can have its own domain/route bindings
4. **Simpler codebase** — Read-only public frontend vs. read-write admin API

---

## Detailed Page Designs

### 1. Homepage (`/`)

```
┌─────────────────────────────────────────┐
│  [Logo]  Ram's Store     [🔍] [🛒 2]   │  ← Nav bar
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     COVER IMAGE / BANNER        │    │  ← store.payload.coverImage
│  │     "Quality products at        │    │
│  │      fair prices"               │    │  ← store.payload.tagline
│  └─────────────────────────────────┘    │
│                                         │
│  ── Categories ────────────────────     │
│  [👟 Footwear] [👕 Clothing] [☕ Food]  │  ← state type=category
│                                         │
│  ── Featured Products ─────────────     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  │img │ │img │ │img │ │img │          │  ← state type=product
│  │name│ │name│ │name│ │name│          │     + instance (price, stock)
│  │₹299│ │₹499│ │₹199│ │₹799│          │
│  │[Add]│ │[Add]│ │[Add]│ │[Add]│      │
│  └────┘ └────┘ └────┘ └────┘          │
│                                         │
│  ── Footer ────────────────────────     │
│  About | Contact | Returns | Instagram  │
│  © 2026 Ram's Store                     │
└─────────────────────────────────────────┘
```

**Data fetched:**
- `GET states?type=store&scope=shop:ramstore` → store config + theme
- `GET states?type=category&scope=shop:ramstore` → categories
- `GET states?type=product&scope=shop:ramstore&limit=12` → featured products
- For each product: instance data (price from `instance.value`, stock from `instance.qty`)

### 2. Product Detail (`/product/product:coffee`)

```
┌─────────────────────────────────────────┐
│  [Logo]  Ram's Store     [🔍] [🛒 2]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  Product Name             │
│  │          │  Brand: Nescafe            │
│  │  IMAGE   │  SKU: NCF-001             │
│  │          │                           │
│  │          │  ₹299.00                  │
│  └──────────┘                           │
│  [img1] [img2] [img3]                   │
│                                         │
│  Size:  [S] [M] [L] [XL]               │
│  Color: [Red] [Blue] [Black]            │
│                                         │
│  Qty: [- 1 +]                           │
│                                         │
│  [  ADD TO CART  ]                      │
│                                         │
│  In Stock: 45 units                     │
│                                         │
└─────────────────────────────────────────┘
```

**Data fetched:**
- `GET state/product:coffee?scope=shop:ramstore` → product details
- `GET instance/product:coffee?scope=shop:ramstore` → price, qty, availability

### 3. Cart (`/cart`) — Client-Side

Cart state stored in a **cookie** (JSON-encoded, HttpOnly):

```json
{
  "items": [
    { "ucode": "product:coffee", "title": "Nescafe Coffee", "price": 299, "qty": 2, "image": "..." },
    { "ucode": "product:shoes1", "title": "Running Shoes", "price": 1499, "qty": 1, "image": "..." }
  ]
}
```

Cart operations are handled by **client-side JavaScript** + a small cart API:

```
POST /api/cart/add     { ucode, qty }     → Adds to cookie, returns updated cart
POST /api/cart/update  { ucode, qty }     → Updates quantity
POST /api/cart/remove  { ucode }          → Removes item
GET  /api/cart         → Returns current cart from cookie
```

### 4. Checkout (`/checkout`)

```
┌─────────────────────────────────────────┐
│  Checkout                               │
├─────────────────────────────────────────┤
│                                         │
│  Contact Information                    │
│  ┌─────────────────────────────────┐    │
│  │ Name:  [________________]       │    │
│  │ Phone: [________________]       │    │
│  │ Email: [________________]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Delivery Address                       │
│  ┌─────────────────────────────────┐    │
│  │ Address: [__________________]   │    │
│  │ City:    [__________________]   │    │
│  │ Pincode: [__________________]   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Order Summary                          │
│  ─────────────────────────────────      │
│  Nescafe Coffee × 2        ₹598.00     │
│  Running Shoes × 1        ₹1,499.00    │
│  ─────────────────────────────────      │
│  Subtotal                 ₹2,097.00     │
│  Delivery                     ₹50.00   │
│  Total                    ₹2,147.00     │
│                                         │
│  [    PLACE ORDER    ]                  │
│                                         │
│  ── or ──                               │
│  [  ORDER VIA WHATSAPP  📱 ]           │
│                                         │
└─────────────────────────────────────────┘
```

**On "Place Order":**

1. Worker validates cart items against current stock (instances DB)
2. Creates order event: `POST event` with opcode `501 ORDERCREATE`
   ```json
   {
     "opcode": 501,
     "streamid": "order:uuid",
     "delta": 1,
     "scope": "shop:ramstore",
     "payload": {
       "customer": { "name": "...", "phone": "...", "email": "...", "address": "..." },
       "items": [
         { "ucode": "product:coffee", "qty": 2, "price": 299, "subtotal": 598 },
         { "ucode": "product:shoes1", "qty": 1, "price": 1499, "subtotal": 1499 }
       ],
       "subtotal": 2097,
       "delivery": 50,
       "total": 2147,
       "currency": "INR"
     }
   }
   ```
3. For each item, emits stock adjustment: opcode `104 STOCKADJUST` with negative delta
4. Store owner sees order **instantly** on mobile app via WebSocket
5. Customer redirected to `/order/:id` confirmation page

**WhatsApp fallback:**
Generates a pre-filled WhatsApp message link:
```
https://wa.me/919876543210?text=New%20Order%0A%0A2x%20Coffee%20₹598%0A1x%20Shoes%20₹1499%0ATotal%20₹2147
```

---

## Public API Endpoints (New)

The storefront needs **read-only public endpoints** that don't require auth. Two approaches:

### Approach A: Add public routes to existing taragent (simpler)

Add to `taragent/src/index.ts`:

```typescript
// ─── Public Storefront API (no auth required) ───

// GET /api/public/store/:slug — Store config
app.get('/api/public/store/:slug', async (c) => {
  const slug = c.req.param('slug');
  const scope = `shop:${slug}`;
  // Fetch store state
  // Return: store name, theme, logo, social links
});

// GET /api/public/products/:slug — All products for a store
app.get('/api/public/products/:slug', async (c) => {
  const slug = c.req.param('slug');
  const scope = `shop:${slug}`;
  // Fetch states where type=product AND scope=scope
  // Join with instances for price/stock
  // Return: product list with prices
});

// GET /api/public/product/:slug/:ucode — Single product detail
// GET /api/public/categories/:slug — Categories for a store
// POST /api/public/order/:slug — Place order (creates event)
```

### Approach B: tarstore Worker fetches directly from Turso (recommended)

The `tarstore` Worker has its own Turso bindings (read-only tokens) and queries directly. No extra API layer. Faster, fewer hops.

```
Customer → tarstore Worker → Turso DB (direct read)
                           → OrderDO (write orders via taragent)
```

**We go with Approach B** — tarstore reads DB directly, only calls taragent's event API for order placement.

---

## Infrastructure Setup

### 1. Cloudflare DNS (Wildcard)

```
*.tarshop.com    CNAME    tarstore.wetarteam.workers.dev
tarshop.com      CNAME    tarstore.wetarteam.workers.dev
```

### 2. Worker Route Binding

In `tarstore/wrangler.jsonc`:
```jsonc
{
  "name": "tarstore",
  "main": "src/index.ts",
  "compatibility_date": "2024-03-20",
  "routes": [
    { "pattern": "*.tarshop.com/*", "zone_name": "tarshop.com" },
    { "pattern": "tarshop.com/*", "zone_name": "tarshop.com" }
  ],
  "vars": {
    // Read-only Turso tokens (create separate read-only tokens for security)
    "STATES_DB_URL": "libsql://states-tarframework.aws-eu-west-1.turso.io",
    "STATES_DB_TOKEN": "<read-only-token>",
    "INSTANCES_DB_URL": "libsql://instances-tarframework.aws-eu-west-1.turso.io",
    "INSTANCES_DB_TOKEN": "<read-only-token>",
    // taragent API base for order placement
    "TARAGENT_API": "https://taragent.wetarteam.workers.dev"
  }
}
```

### 3. Read-Only DB Tokens

Generate read-only Turso tokens for the storefront:
```bash
turso db tokens create states-tarframework --permission read-only
turso db tokens create instances-tarframework --permission read-only
```

This ensures the public storefront **can never modify** product data — only the mobile app (taragent) can.

---

## Cart Implementation

### Cookie-Based (No Login Required)

```typescript
// Cart stored as JSON in a signed cookie
// Cookie name: tar_cart_{scope_hash}

interface CartItem {
  ucode: string;      // "product:coffee"
  title: string;
  price: number;
  qty: number;
  image?: string;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
}
```

**Why cookies?**
- No database needed for anonymous carts
- Works without JavaScript (SSR cart page)
- Persists across page refreshes
- Auto-expires (7-day TTL)
- Scoped per store (cookie path = `/{slug}`)

**Cart operations via small client-side JS:**
```javascript
// Inline <script> in product pages — minimal, no framework
function addToCart(ucode, title, price, image) {
  fetch('/api/cart/add', {
    method: 'POST',
    body: JSON.stringify({ ucode, title, price, qty: 1, image })
  }).then(r => r.json()).then(data => {
    updateCartBadge(data.count);
  });
}
```

---

## Order Flow (End-to-End)

```
1. Customer browses storefront (tarstore Worker)
2. Adds items to cart (cookie)
3. Goes to /checkout, fills form
4. Clicks "Place Order"

5. tarstore Worker:
   a. Reads cart from cookie
   b. Validates stock: queries instances DB for each item
   c. If stock OK:
      - POST https://taragent.wetarteam.workers.dev/api/event
        { opcode: 501, streamid: "order:{uuid}", scope: "shop:ramstore", payload: {...} }
      - For each item: POST /api/event
        { opcode: 104, streamid: item.ucode, delta: -item.qty, scope: "shop:ramstore" }
   d. Clears cart cookie
   e. Redirects to /order/{uuid}

6. Store owner's mobile app:
   - WebSocket receives opcode 501 event instantly
   - Shows new order notification
   - Owner can process/ship from the app

7. Customer sees order confirmation page
   - Order ID, items, total
   - "You'll receive updates via WhatsApp/SMS"
```

---

## SEO & Performance

### Server-Side Rendered (SSR)
- Every page is full HTML from the Worker — no client-side rendering needed
- Google can crawl and index all product pages
- Fast First Contentful Paint (< 200ms from edge)

### SEO Tags per Page
```html
<title>Nescafe Coffee - Ram's Store</title>
<meta name="description" content="Buy Nescafe Coffee at ₹299. Free delivery on orders above ₹500.">
<meta property="og:title" content="Nescafe Coffee - Ram's Store">
<meta property="og:image" content="https://cdn.example.com/coffee.jpg">
<meta property="og:url" content="https://ramstore.tarshop.com/product/product:coffee">
<link rel="canonical" href="https://ramstore.tarshop.com/product/product:coffee">
```

### Caching Strategy
- Store config: Cache 5 minutes (rarely changes)
- Product list: Cache 1 minute (stock changes frequently)
- Product detail: Cache 1 minute
- Cart/Checkout: No cache (dynamic)
- Static assets (CSS/JS): Cache forever (hashed filenames)

Implemented via `Cache-Control` headers + Cloudflare edge caching.

---

## Theming

Store owners customize their storefront by editing the `store:{slug}` state payload in the mobile app:

```
Mobile App → Edit State → store:ramstore → payload.theme
```

The tarstore Worker reads `theme` from the store config and injects CSS variables:

```html
<style>
  :root {
    --primary: #007AFF;      /* theme.primaryColor */
    --accent: #FF9500;       /* theme.accentColor */
    --font: 'Inter', sans;   /* theme.fontFamily */
  }
</style>
```

All template components use these CSS variables, so changing the store config instantly re-themes the entire site.

---

## Implementation Phases

### Phase 1 — Core Storefront (MVP)
1. Create `tarstore/` Worker project with Hono
2. Slug extraction middleware (subdomain + path)
3. Homepage template (store config + product grid)
4. Product detail page
5. Category listing page
6. Base layout (nav, footer, theme CSS variables)
7. Read-only Turso queries for states + instances

### Phase 2 — Cart & Checkout
8. Cookie-based cart (add, update, remove)
9. Cart page (SSR)
10. Checkout page + form
11. Order placement (POST to taragent event API)
12. Order confirmation page
13. WhatsApp order fallback

### Phase 3 — Polish & SEO
14. Search page (text search on product titles)
15. CMS pages (`page:about`, `page:returns`)
16. SEO meta tags + Open Graph
17. Cache headers for performance
18. Mobile-responsive CSS
19. Store theme customization

### Phase 4 — Advanced (Future)
20. Custom domain per store (Cloudflare for SaaS)
21. Payment gateway integration (Razorpay/Stripe)
22. Order tracking page (read events by order streamid)
23. Customer accounts (optional login)
24. Product reviews/ratings
25. Inventory auto-hide (hide products with qty=0)

---

## Cost Estimate

The storefront Worker adds minimal cost to the existing infrastructure:

| Component | Cost |
|-----------|------|
| tarstore Worker requests | $0.50 per million (Cloudflare Workers) |
| Turso DB reads | $0.001 per million rows read |
| OrderDO writes (orders) | $0.15 per million requests |
| DNS/Domain | ~$10/year for tarshop.com |

**At 1,000 stores × 100 pageviews/day each:**
- 100K Worker requests/day = ~$1.50/month
- ~500K DB rows read/day = ~$0.01/month
- ~100 orders/day = negligible

**Total: ~$2-5/month** for serving 1,000 stores.

---

## Summary

| What | How |
|------|-----|
| **One Worker, many stores** | URL slug → scope mapping |
| **Product data** | Same States + Instances DB (read-only) |
| **Store themes** | CSS variables from `store:*` payload |
| **Cart** | Cookie-based, no login needed |
| **Orders** | Event API → opcode 501 → owner gets WebSocket notification |
| **SEO** | Full SSR, meta tags, canonical URLs |
| **Custom domains** | Cloudflare wildcard DNS → Worker routes |
| **Security** | Read-only DB tokens; writes only via taragent event API |
| **Cost** | ~$2-5/month for 1,000 stores |

---

## AI-Powered Storefronts — 100% AI, No Editor

### Core Principle

**Sites are fully AI-generated. No drag-and-drop. No visual editor. Ever.**

The owner talks to the AI. The AI builds and updates the site. That's it. The complexity is hidden behind a conversation.

### Why This Works Better Than an Editor

An editor means the owner needs to learn a tool. With AI:
- A shopkeeper with zero tech skills says "I sell spices" and gets a site
- Changes happen in natural language: "make it darker" not "change hex value in theme panel"
- The AI has design taste — most shopkeepers don't
- No UI to build, maintain, or teach

### Two Layers: Design Templates + Per-Store Customization

The key insight: **store design templates as global TAR states in a shared scope**, then the AI picks one, forks it, and customizes it per store.

```
Layer 1: Template Library (scope: "system:templates")
  ┌──────────────────────────────────────────────────────┐
  │  template:minimal-luxury    — serif fonts, whitespace │
  │  template:bold-modern       — dark, sharp, techy      │
  │  template:warm-artisan      — earthy, handmade feel   │
  │  template:clean-professional — corporate, structured   │
  │  template:vibrant-street    — colorful, loud, playful  │
  │  template:fresh-organic     — greens, natural imagery  │
  │  ...                                                   │
  └──────────────────────────────────────────────────────┘
        │
        │  AI picks best match for "I sell handmade candles"
        │  → template:warm-artisan
        │
        ▼
Layer 2: Store Instance (scope: "shop:mycandles")
  ┌──────────────────────────────────────────────────────┐
  │  section:hero         — forked from template, colors  │
  │                         adjusted, copy personalized   │
  │  section:featured     — product grid customized       │
  │  section:story        — AI-written store narrative     │
  │  section:categories   — category layout               │
  │  section:footer       — store contact info            │
  │  section:productcard  — product card design           │
  │  section:nav          — navigation bar                │
  └──────────────────────────────────────────────────────┘
```

### Templates as States

Templates are stored in the same `state` table, in a global scope:

```
state table:
  ucode: "template:warm-artisan"
  type:  "template"
  scope: "system:templates"
  title: "Warm Artisan"
  payload: {
    "description": "Earthy tones, serif typography, handcrafted feel",
    "industries": ["candles", "pottery", "handmade", "artisan", "crafts", "bakery"],
    "preview": "https://cdn.tar.shop/previews/warm-artisan.jpg",

    "theme": {
      "fonts": {
        "display": "Cormorant Garamond",
        "body": "Inter",
        "accent": "Cormorant Garamond"
      },
      "colors": {
        "bg": "#FFFBF5",
        "surface": "#FAF3E8",
        "text": "#2C1810",
        "textMuted": "#6B5744",
        "primary": "#8B4513",
        "accent": "#C8956C",
        "border": "#E8DDD0"
      },
      "radius": "12px",
      "spacing": "generous"
    },

    "sections": {
      "hero": { ...design tree... },
      "featured": { ...design tree... },
      "story": { ...design tree... },
      "categories": { ...design tree... },
      "testimonials": { ...design tree... },
      "cta": { ...design tree... },
      "nav": { ...design tree... },
      "footer": { ...design tree... },
      "productCard": { ...design tree... },
      "productDetail": { ...design tree... }
    },

    "pages": {
      "home": ["nav", "hero", "featured", "categories", "story", "cta", "footer"],
      "products": ["nav", "catalog-header", "product-grid", "footer"],
      "product": ["nav", "product-detail", "related", "footer"],
      "about": ["nav", "story-full", "footer"],
      "cart": ["nav", "cart-view", "footer"],
      "checkout": ["nav", "checkout-form", "footer"]
    }
  }
}
```

### How AI Uses Templates

```
Owner: "I sell handmade candles. Warm cozy feel."

DesignAgent:
  1. Read all templates from scope "system:templates"
  2. Match against owner description → template:warm-artisan (best fit)
  3. Fork the template: deep-copy all section trees
  4. Customize:
     - Replace placeholder text with store-specific copy
     - Adjust colors to match owner preference (if specified)
     - Write store tagline, about text, SEO metadata
     - Adapt product card to match the products the owner has
  5. Write forked sections to scope "shop:mycandles":
     - section:hero, section:featured, section:nav, etc.
  6. Write store config to store:mycandles
  7. Site is live
```

### What's Inside a Design Tree (Section)

Each section is a JSON tree of elements. The AI creates these for templates, then customizes per store:

```json
{
  "tag": "section",
  "style": {
    "minHeight": "90vh",
    "display": "flex",
    "alignItems": "center",
    "background": "linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%)",
    "padding": "100px 40px"
  },
  "children": [
    {
      "tag": "div",
      "style": { "maxWidth": "560px" },
      "children": [
        {
          "tag": "span",
          "bind": "store.tagline",
          "style": {
            "fontFamily": "var(--font-accent)",
            "fontSize": "13px",
            "letterSpacing": "4px",
            "textTransform": "uppercase",
            "color": "var(--text-muted)",
            "marginBottom": "24px",
            "display": "block"
          }
        },
        {
          "tag": "h1",
          "bind": "store.name",
          "style": {
            "fontFamily": "var(--font-display)",
            "fontSize": "clamp(44px, 6vw, 80px)",
            "fontWeight": "300",
            "lineHeight": "1.08",
            "color": "var(--text)"
          }
        },
        {
          "tag": "a",
          "text": "Shop Now",
          "href": "/products",
          "style": {
            "display": "inline-block",
            "marginTop": "48px",
            "padding": "16px 48px",
            "background": "var(--primary)",
            "color": "var(--bg)",
            "fontSize": "12px",
            "letterSpacing": "2.5px",
            "textTransform": "uppercase",
            "textDecoration": "none",
            "transition": "all 0.3s ease"
          },
          "hoverStyle": {
            "opacity": "0.85",
            "transform": "translateY(-2px)"
          }
        }
      ]
    },
    {
      "tag": "div",
      "style": {
        "position": "absolute",
        "right": "0",
        "top": "0",
        "width": "45%",
        "height": "100%"
      },
      "children": [
        {
          "tag": "img",
          "bind": "store.coverImage",
          "style": {
            "width": "100%",
            "height": "100%",
            "objectFit": "cover"
          }
        }
      ]
    }
  ],
  "responsive": {
    "768": {
      "style": { "flexDirection": "column", "textAlign": "center", "padding": "60px 24px" }
    }
  },
  "animation": { "type": "fade-up", "stagger": 120 }
}
```

**Notice: templates use `var(--primary)`, `var(--font-display)` etc.** The AI injects the store's actual theme colors as CSS custom properties. This means one template tree works across many color schemes without rewriting every style.

When the AI customizes per store, it can also override specific values:
- Template says `"fontSize": "clamp(44px, 6vw, 80px)"` → AI changes to `"clamp(36px, 5vw, 64px)"` for a quieter store
- Template says `"letterSpacing": "4px"` → AI changes to `"1px"` for a more casual feel
- AI adds or removes children (e.g., adds a subtitle element, removes a label)

### The Renderer (Same for All Stores)

One generic tree walker, ~100 lines:

```typescript
interface DesignNode {
  tag?: string;
  text?: string;
  bind?: string;            // Dynamic data: "product.title", "store.name"
  format?: string;          // "currency", "stock", "date"
  href?: string;
  style?: Record<string, string>;
  hoverStyle?: Record<string, string>;
  responsive?: Record<string, Record<string, string>>;  // breakpoint → style overrides
  animation?: { type: string; stagger?: number; delay?: number };
  repeat?: { source: string; limit?: number };  // Loop over data
  template?: string;        // Reference another section: "section:productcard"
  children?: DesignNode[];
}

function renderTree(node: DesignNode, data: StoreData, ctx: RenderContext): void {
  node = sanitize(node);  // Whitelist tags + CSS props
  const id = ctx.nextId();

  // Resolve text/binding
  const content = node.bind ? resolve(node.bind, data, node.format) : (node.text || '');

  // Handle repeat (product loops)
  if (node.repeat) {
    const items = getData(node.repeat.source, data, node.repeat.limit);
    for (const item of items) {
      const itemData = { ...data, product: item.state, instance: item.instance };
      for (const child of node.children || []) {
        renderTree(child, itemData, ctx);
      }
    }
    return;
  }

  // Emit CSS
  ctx.css += `.${id}{${toCSSString(node.style)}}`;
  if (node.hoverStyle) ctx.css += `.${id}:hover{${toCSSString(node.hoverStyle)}}`;
  if (node.responsive) {
    for (const [bp, styles] of Object.entries(node.responsive)) {
      ctx.media[bp] = (ctx.media[bp] || '') + `.${id}{${toCSSString(styles)}}`;
    }
  }
  if (node.animation) ctx.animated.push({ id, ...node.animation });

  // Emit HTML
  const tag = node.tag || 'div';
  const attrs = [
    `class="${id}"`,
    node.href ? `href="${node.href}"` : '',
    tag === 'img' && node.bind ? `src="${resolve(node.bind, data)}" alt=""` : '',
  ].filter(Boolean).join(' ');

  ctx.html += `<${tag} ${attrs}>${tag === 'img' ? '' : content}`;
  for (const child of node.children || []) renderTree(child, data, ctx);
  if (tag !== 'img') ctx.html += `</${tag}>`;
}
```

### Template Library — Starter Set

These are pre-built by us (or AI-generated and curated). Stored in `scope: "system:templates"`:

```
template:minimal-luxury
  → High-end feel. Serif display fonts, generous whitespace,
    muted palette, thin borders, large imagery, slow animations.
  → Good for: jewelry, candles, premium food, fashion, wellness

template:bold-modern
  → Dark backgrounds, sharp sans-serif, neon accents,
    strong contrast, grid-heavy, fast animations.
  → Good for: electronics, streetwear, gaming, tech

template:warm-artisan
  → Earthy palette, handwritten accents, rounded elements,
    textured backgrounds, story-heavy.
  → Good for: bakery, handmade goods, pottery, organic

template:clean-pro
  → White space, system fonts, structured grid, no flourish,
    functional and scannable.
  → Good for: general store, wholesale, B2B, office supplies

template:vibrant-street
  → Bright colors, large type, playful layout, card-heavy,
    emoji-friendly, mobile-first focus.
  → Good for: food delivery, streetwear, pop-up brands

template:fresh-organic
  → Greens and whites, leaf/nature motifs, rounded everything,
    calming typography, trust-building layout.
  → Good for: organic food, health, supplements, farm produce
```

**Each template is a complete set of section trees** — hero, nav, footer, product card, product detail, catalog, cart, checkout. The AI doesn't generate from scratch; it starts from a proven design and adapts.

### Why Templates + AI Customization (Not Pure Generation)

**Pure AI generation** every time is:
1. **Slow** — generating 8 sections from scratch = big LLM call
2. **Inconsistent** — same prompt can give wildly different quality
3. **Expensive** — full design = ~4K output tokens per section

**Template + customize** is:
1. **Fast** — AI only generates the diff: colors, copy, minor layout tweaks
2. **Consistent** — starting from a curated, tested design
3. **Cheap** — small LLM call for customization (~500 tokens)
4. **Reliable** — template is known to render correctly

The AI still has full power to:
- Change any style on any element
- Add or remove sections
- Rewrite all copy
- Swap fonts, colors, spacing
- Add new sections not in the template

But it starts from something good, not a blank page.

### The Full AI Flow

**Step 1: Store Creation**
```
Owner: "Design my store. I sell organic spices from Kerala."

DesignAgent:
  1. Reads templates from system:templates scope
  2. Picks template:warm-artisan (best match for organic/artisan)
  3. Calls LLM with:
     - The template's theme + section trees
     - Owner's description
     - Owner's existing products (if any)
  4. LLM returns customization patch:
     {
       "theme": {
         "colors": { "primary": "#2D5016", "accent": "#C8A951", "bg": "#FAFAF5" }
       },
       "store": {
         "name": "Kerala Spice House",
         "tagline": "From our farms to your kitchen",
         "seo": { "title": "Kerala Spice House — Premium Organic Spices" }
       },
       "sections": {
         "hero": { "children[0].children[0].text": "Farm-fresh organic spices" },
         "story": { "content": "Three generations of spice farmers..." }
       },
       "pages": {
         "about": { "content": "..." },
         "returns": { "content": "..." }
       }
     }
  5. Applies patch to forked template
  6. Writes all sections + store config to scope "shop:keralaspice"
  7. Site live instantly
```

**Step 2: Refinement (conversation continues)**
```
Owner: "Make it feel more premium, less rustic"

DesignAgent:
  1. Reads current sections from shop:keralaspice
  2. LLM sees: warm-artisan base + owner wants more premium
  3. Returns patch:
     - Swap font-display from "Cormorant Garamond" to "Playfair Display"
     - Increase letter-spacing globally
     - Switch bg gradient to darker tones
     - Reduce border-radius (sharp = premium)
     - Add more whitespace to hero
  4. Applies, writes back
  5. Live instantly
```

**Step 3: Ongoing updates**
```
Owner: "I added new products, update the featured section"
Owner: "Change the banner image"
Owner: "Add a Diwali sale banner at the top"
Owner: "Remove the testimonials section"
Owner: "Write better descriptions for my products"
```

Each of these is a small AI call that reads current state, patches it, writes back. The site evolves through conversation.

### Adding New Templates Over Time

Templates are just states. To add a new one:

```
POST /api/state
{
  "ucode": "template:tokyo-minimal",
  "title": "Tokyo Minimal",
  "scope": "system:templates",
  "payload": { ... full template definition ... }
}
```

The AI can also **generate new templates**:
```
Admin: "Create a new template inspired by Japanese minimalism,
        for tea shops and wellness brands"

DesignAgent → generates full template with all sections → saves to system:templates
```

Over time the template library grows. The AI gets better at matching stores to templates. Stores get more variety.

### Data Bindings

Design trees use `bind` for dynamic content:

```json
{ "tag": "h1", "bind": "store.name" }
{ "tag": "span", "bind": "product.price", "format": "currency" }
{ "tag": "img", "bind": "product.images[0]" }
{ "tag": "p", "bind": "instance.qty", "format": "stock" }
```

Available bindings:
```
store.name, store.tagline, store.logo, store.coverImage, store.phone
product.title, product.price, product.brand, product.sku,
product.images[N], product.sizes, product.colors, product.description
instance.qty, instance.value, instance.available, instance.currency
category.title, category.icon
```

Format helpers:
```
"currency"  → "₹299.00"
"stock"     → "In Stock (45)" or "Out of Stock"
"date"      → "29 Mar 2026"
```

### Repeat Directive (Product Loops)

```json
{
  "tag": "div",
  "style": { "display": "grid", "gridTemplateColumns": "repeat(auto-fill, minmax(280px, 1fr))", "gap": "32px" },
  "repeat": { "source": "products", "limit": 8 },
  "children": [
    { "... product card tree, uses bind: product.title etc ..." }
  ]
}
```

### Responsive + Animations

Responsive overrides per element:
```json
{
  "responsive": {
    "768": { "gridTemplateColumns": "repeat(2, 1fr)", "padding": "40px 20px" },
    "480": { "gridTemplateColumns": "1fr" }
  }
}
```

Scroll animations:
```json
{ "animation": { "type": "fade-up", "stagger": 100 } }
```

Rendered as CSS transitions + tiny IntersectionObserver (~20 lines, no library).

### Security

All AI output goes through sanitizer before rendering:
- **Tag whitelist:** div, section, h1-h4, p, span, a, img, button, ul, li, nav, header, footer, form, input
- **CSS property whitelist:** ~40 safe properties (layout, spacing, color, font, transform, transition)
- **No `<script>`**, no `onclick`, no `javascript:` URIs, no CSS `expression()`
- **All `bind` values** resolved server-side (no client interpolation)

### Storage

```
state table (scope: "system:templates"):
  template:warm-artisan    → full template with all section trees (~20-30 KB payload)
  template:bold-modern     → ...
  template:minimal-luxury  → ...

state table (scope: "shop:mycandles"):
  store:mycandles          → theme colors, fonts, store info, SEO
  section:hero             → forked + customized design tree (~2-4 KB)
  section:featured         → ...
  section:nav              → ...
  section:footer           → ...
  section:productcard      → reusable card component (~2 KB)
  page:about               → AI-written content
  page:returns             → AI-written policy
```

Total per store: ~20-40 KB across all states. Trivial for Turso.

### Rendering Pipeline

```
Customer visits ramstore.tarshop.com
  │
  ▼
tarstore Worker:
  1. scope = "shop:ramstore"
  2. Fetch store:ramstore → theme (colors, fonts)
  3. Fetch all section:* for this scope → design trees
  4. Fetch products, categories, instances → data for bindings
  5. Inject theme as CSS custom properties:
     :root { --primary: #8B4513; --font-display: 'Cormorant Garamond'; ... }
  6. Walk each section tree → HTML + scoped CSS
  7. Resolve bindings, expand repeats
  8. Concatenate into full page
  9. Inject: <style>, <meta> SEO tags, tiny animation JS, cart JS
  10. Return ~30-50 KB HTML response. Done.
```

### Opcodes for Design Events

```
810  DESIGNGENERATE   — AI generated storefront from template
811  DESIGNUPDATE     — AI updated sections/theme
812  DESIGNPUBLISH    — Owner approved design (future: draft → live)
813  DESIGNREVERT     — Reverted to previous snapshot
```

### Implementation Phases (Updated)

```
Phase 3 — AI-Powered Storefront Design

  1. Design tree JSON schema + Zod validation
  2. Tree renderer: walk nodes → HTML + scoped CSS
  3. Data binding resolver (product.title, store.logo, etc.)
  4. Repeat directive (product loops)
  5. Responsive overrides → @media generation
  6. Animation directives → IntersectionObserver (~20 lines)
  7. CSS/HTML sanitizer (whitelist)
  8. Template state storage (system:templates scope)
  9. Build 3-4 starter templates (warm-artisan, bold-modern, clean-pro, vibrant-street)
  10. DesignAgent: template selection + LLM customization
  11. Iterative refinement via conversation
  12. Design snapshot/rollback via events
  13. POST /api/channel with action: "DESIGN" routing
```
