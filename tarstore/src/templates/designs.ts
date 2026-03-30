import type { DesignNode, ThemeConfig } from '../lib/types';

// ─── Design Template Definitions ───
// These get stored in state table as type="template", scope="system:templates"
// The DesignAgent picks one and customizes it per store.

export interface DesignTemplate {
  id: string;          // "template:warm-artisan"
  title: string;
  description: string;
  industries: string[];
  theme: ThemeConfig;
  sections: Record<string, DesignNode>;
  pages: Record<string, string[]>;  // page name → section order
}

// ─── Template: Minimal Luxury ───
export const minimalLuxury: DesignTemplate = {
  id: 'template:minimal-luxury',
  title: 'Minimal Luxury',
  description: 'Refined elegance with generous whitespace, serif display fonts, and muted tones.',
  industries: ['jewelry', 'candles', 'fashion', 'wellness', 'premium-food', 'beauty', 'watches'],
  theme: {
    fonts: { display: 'Cormorant Garamond', body: 'Inter', accent: 'Cormorant Garamond' },
    colors: {
      bg: '#FFFBF7', surface: '#F7F3EE', text: '#1A1A1A',
      textMuted: '#6B6560', primary: '#2C2220', accent: '#B8977E', border: '#E8E2DB',
    },
    radius: '2px',
    spacing: 'generous',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '100px 40px',
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--surface) 100%)',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '640px' },
          children: [
            {
              tag: 'span', bind: 'store.tagline',
              style: {
                fontFamily: 'var(--font-accent)', fontSize: '12px', letterSpacing: '5px',
                textTransform: 'uppercase', color: 'var(--accent)', display: 'block', marginBottom: '28px',
              },
            },
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,72px)',
                fontWeight: '300', lineHeight: '1.1', color: 'var(--text)', marginBottom: '40px',
              },
            },
            {
              tag: 'a', text: 'Explore', href: '/products',
              style: {
                display: 'inline-block', padding: '15px 52px', border: '1px solid var(--text)',
                color: 'var(--text)', fontSize: '11px', letterSpacing: '3px',
                textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.3s',
              },
              hoverStyle: { background: 'var(--text)', color: 'var(--bg)' },
            },
          ],
        },
      ],
      responsive: { '768': { minHeight: '60vh', padding: '60px 24px' } },
      animation: { type: 'fade-up', stagger: 150 },
    },
    featured: {
      tag: 'section',
      style: { padding: '100px 40px' },
      children: [
        {
          tag: 'h2', text: 'Featured',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '300',
            textAlign: 'center', marginBottom: '48px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '28px',
          },
          repeat: { source: 'products', limit: 8 },
          template: 'section:productcard',
          responsive: { '768': { gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' } },
        },
      ],
      responsive: { '768': { padding: '60px 20px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        transition: 'transform 0.4s ease',
      },
      hoverStyle: { transform: 'translateY(-4px)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '3/4', overflow: 'hidden', background: 'var(--surface)' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s' },
            hoverStyle: { transform: 'scale(1.03)' },
          }],
        },
        {
          tag: 'div', style: { padding: '16px 4px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '400', marginBottom: '4px' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '13px', color: 'var(--text-muted)' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', borderBottom: '1px solid var(--border)', position: 'sticky',
        top: '0', zIndex: '100', background: 'var(--bg)',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400',
            textDecoration: 'none', color: 'var(--text)', letterSpacing: '1px',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '28px', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' },
          children: [
            { tag: 'a', text: 'Shop', href: '/products', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
      ],
      responsive: { '768': { padding: '16px 20px' } },
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '60px 40px', borderTop: '1px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px',
        letterSpacing: '1px', marginTop: '60px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '20px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Returns', href: '/page/returns', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Template: Bold Modern ───
export const boldModern: DesignTemplate = {
  id: 'template:bold-modern',
  title: 'Bold Modern',
  description: 'Dark backgrounds, strong contrast, sharp sans-serif typography.',
  industries: ['electronics', 'gaming', 'streetwear', 'tech', 'automotive', 'sports'],
  theme: {
    fonts: { display: 'Montserrat', body: 'Inter', accent: 'Montserrat' },
    colors: {
      bg: '#0A0A0A', surface: '#141414', text: '#FFFFFF',
      textMuted: '#888888', primary: '#FF4D4D', accent: '#FFD700', border: '#222222',
    },
    radius: '8px',
    spacing: 'normal',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        minHeight: '80vh', display: 'flex', alignItems: 'center',
        padding: '80px 48px', background: 'var(--bg)', position: 'relative',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '600px', zIndex: '1' },
          children: [
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(42px,7vw,80px)',
                fontWeight: '800', lineHeight: '1.0', color: 'var(--text)',
                textTransform: 'uppercase', letterSpacing: '-1px',
              },
            },
            {
              tag: 'p', bind: 'store.tagline',
              style: { fontSize: '18px', color: 'var(--text-muted)', marginTop: '20px', lineHeight: '1.6' },
            },
            {
              tag: 'a', text: 'Shop Now', href: '/products',
              style: {
                display: 'inline-block', marginTop: '36px', padding: '16px 44px',
                background: 'var(--primary)', color: '#FFFFFF', fontSize: '14px',
                fontWeight: '700', textDecoration: 'none', borderRadius: 'var(--radius)',
                transition: 'transform 0.2s',
              },
              hoverStyle: { transform: 'scale(1.04)' },
            },
          ],
        },
      ],
      responsive: { '768': { padding: '60px 24px', minHeight: '60vh' } },
      animation: { type: 'fade-up', stagger: 100 },
    },
    featured: {
      tag: 'section',
      style: { padding: '80px 48px', background: 'var(--bg)' },
      children: [
        {
          tag: 'h2', text: 'Latest Drops',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700',
            textTransform: 'uppercase', marginBottom: '40px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
          repeat: { source: 'products', limit: 8 },
          template: 'section:productcard',
          responsive: { '768': { gridTemplateColumns: 'repeat(2, 1fr)' } },
        },
      ],
      responsive: { '768': { padding: '48px 20px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden',
        transition: 'transform 0.3s',
      },
      hoverStyle: { transform: 'translateY(-6px)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '1', overflow: 'hidden' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover' },
          }],
        },
        {
          tag: 'div', style: { padding: '16px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: 'var(--text)' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '15px', color: 'var(--primary)', fontWeight: '700' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 48px', background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: '0', zIndex: '100',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '800',
            textDecoration: 'none', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '2px',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '24px', fontSize: '13px', fontWeight: '600' },
          children: [
            { tag: 'a', text: 'Shop', href: '/products', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
          ],
        },
      ],
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '48px', borderTop: '1px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '48px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Template: Warm Artisan ───
export const warmArtisan: DesignTemplate = {
  id: 'template:warm-artisan',
  title: 'Warm Artisan',
  description: 'Earthy palette, rounded elements, story-driven layout for handmade goods.',
  industries: ['bakery', 'handmade', 'pottery', 'organic', 'crafts', 'candles', 'farm'],
  theme: {
    fonts: { display: 'Playfair Display', body: 'Lora', accent: 'Playfair Display' },
    colors: {
      bg: '#FAF6F0', surface: '#F0E8DC', text: '#3D2B1F',
      textMuted: '#7A6555', primary: '#8B5E3C', accent: '#C9A87C', border: '#E0D5C7',
    },
    radius: '16px',
    spacing: 'generous',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        minHeight: '75vh', display: 'flex', alignItems: 'center',
        padding: '80px 48px', background: 'var(--surface)',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '520px' },
          children: [
            {
              tag: 'p', bind: 'store.tagline',
              style: {
                fontFamily: 'var(--font-accent)', fontStyle: 'italic',
                fontSize: '16px', color: 'var(--accent)', marginBottom: '16px',
              },
            },
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,60px)',
                fontWeight: '400', lineHeight: '1.15', color: 'var(--text)', marginBottom: '28px',
              },
            },
            {
              tag: 'a', text: 'Browse Collection', href: '/products',
              style: {
                display: 'inline-block', padding: '14px 36px', background: 'var(--primary)',
                color: '#FFFFFF', fontSize: '14px', textDecoration: 'none',
                borderRadius: '999px', transition: 'opacity 0.3s',
              },
              hoverStyle: { opacity: '0.85' },
            },
          ],
        },
      ],
      responsive: { '768': { minHeight: '50vh', padding: '60px 24px' } },
      animation: { type: 'fade-up', stagger: 120 },
    },
    featured: {
      tag: 'section',
      style: { padding: '80px 48px' },
      children: [
        {
          tag: 'h2', text: 'Our Favorites',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400',
            textAlign: 'center', marginBottom: '40px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' },
          repeat: { source: 'products', limit: 8 },
          template: 'section:productcard',
        },
      ],
      responsive: { '768': { padding: '48px 20px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: 'var(--bg)', borderRadius: 'var(--radius)', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.35s',
      },
      hoverStyle: { transform: 'translateY(-5px)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '4/5', overflow: 'hidden' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' },
            hoverStyle: { transform: 'scale(1.04)' },
          }],
        },
        {
          tag: 'div', style: { padding: '20px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '400', marginBottom: '6px' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '14px', color: 'var(--text-muted)' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px', background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: '0', zIndex: '100',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400',
            textDecoration: 'none', color: 'var(--text)',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '24px', fontSize: '14px' },
          children: [
            { tag: 'a', text: 'Shop', href: '/products', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
      ],
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '52px 48px', borderTop: '1px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '52px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Returns', href: '/page/returns', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Template: Clean Professional ───
export const cleanPro: DesignTemplate = {
  id: 'template:clean-pro',
  title: 'Clean Professional',
  description: 'White space, system fonts, structured grid, no flourish — functional and scannable.',
  industries: ['general', 'wholesale', 'b2b', 'office', 'supplies', 'grocery', 'pharmacy', 'hardware'],
  theme: {
    fonts: { display: 'Inter', body: 'Inter', accent: 'Inter' },
    colors: {
      bg: '#FFFFFF', surface: '#F5F5F7', text: '#1D1D1F',
      textMuted: '#6E6E73', primary: '#0071E3', accent: '#147CE5', border: '#D2D2D7',
    },
    radius: '8px',
    spacing: 'normal',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        padding: '80px 48px', display: 'flex', alignItems: 'center',
        background: 'var(--surface)', minHeight: '50vh',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '560px' },
          children: [
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,4vw,52px)',
                fontWeight: '600', lineHeight: '1.1', color: 'var(--text)', marginBottom: '16px',
              },
            },
            {
              tag: 'p', bind: 'store.tagline',
              style: { fontSize: '18px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '28px' },
            },
            {
              tag: 'a', text: 'Browse Products', href: '/products',
              style: {
                display: 'inline-block', padding: '14px 32px', background: 'var(--primary)',
                color: '#FFFFFF', fontSize: '15px', fontWeight: '500', textDecoration: 'none',
                borderRadius: 'var(--radius)', transition: 'opacity 0.2s',
              },
              hoverStyle: { opacity: '0.9' },
            },
          ],
        },
      ],
      responsive: { '768': { padding: '48px 20px', minHeight: 'auto' } },
      animation: { type: 'fade-up', stagger: 100 },
    },
    featured: {
      tag: 'section',
      style: { padding: '64px 48px' },
      children: [
        {
          tag: 'h2', text: 'Products',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '600',
            marginBottom: '32px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' },
          repeat: { source: 'products', limit: 12 },
          template: 'section:productcard',
          responsive: { '768': { gridTemplateColumns: 'repeat(2, 1fr)' } },
        },
      ],
      responsive: { '768': { padding: '40px 20px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
        transition: 'box-shadow 0.2s',
      },
      hoverStyle: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '1', overflow: 'hidden', background: 'var(--surface)' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover' },
          }],
        },
        {
          tag: 'div', style: { padding: '14px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontSize: '14px', fontWeight: '500', marginBottom: '4px' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '14px', color: 'var(--primary)', fontWeight: '600' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px', background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: '0', zIndex: '100',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '600',
            textDecoration: 'none', color: 'var(--text)',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '24px', fontSize: '14px' },
          children: [
            { tag: 'a', text: 'Products', href: '/products', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
          ],
        },
      ],
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '40px 48px', borderTop: '1px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '12px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Returns', href: '/page/returns', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Template: Vibrant Street ───
export const vibrantStreet: DesignTemplate = {
  id: 'template:vibrant-street',
  title: 'Vibrant Street',
  description: 'Bright colors, large type, playful layout — mobile-first, card-heavy, energetic.',
  industries: ['food', 'delivery', 'streetwear', 'sneakers', 'pop-up', 'accessories', 'toys', 'gifts'],
  theme: {
    fonts: { display: 'Space Grotesk', body: 'DM Sans', accent: 'Space Grotesk' },
    colors: {
      bg: '#FFF8F0', surface: '#FFF0E0', text: '#1A1A1A',
      textMuted: '#666666', primary: '#FF5722', accent: '#FFB300', border: '#FFE0C0',
    },
    radius: '16px',
    spacing: 'normal',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        minHeight: '70vh', display: 'flex', alignItems: 'center',
        padding: '60px 40px', background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '600px' },
          children: [
            {
              tag: 'span', bind: 'store.tagline',
              style: {
                display: 'inline-block', padding: '6px 16px', background: 'var(--accent)',
                color: '#1A1A1A', fontSize: '13px', fontWeight: '700', borderRadius: '999px',
                marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px',
              },
            },
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,7vw,72px)',
                fontWeight: '700', lineHeight: '1.05', color: 'var(--text)', marginBottom: '28px',
              },
            },
            {
              tag: 'a', text: 'Shop Now', href: '/products',
              style: {
                display: 'inline-block', padding: '16px 40px', background: 'var(--primary)',
                color: '#FFFFFF', fontSize: '16px', fontWeight: '700', textDecoration: 'none',
                borderRadius: 'var(--radius)', transition: 'transform 0.2s',
              },
              hoverStyle: { transform: 'scale(1.05)' },
            },
          ],
        },
      ],
      responsive: { '768': { padding: '40px 20px', minHeight: '50vh' } },
      animation: { type: 'fade-up', stagger: 80 },
    },
    featured: {
      tag: 'section',
      style: { padding: '60px 40px' },
      children: [
        {
          tag: 'h2', text: 'Trending Now',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700',
            marginBottom: '32px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
          repeat: { source: 'products', limit: 8 },
          template: 'section:productcard',
          responsive: { '768': { gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' } },
        },
      ],
      responsive: { '768': { padding: '40px 16px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: '#FFFFFF', borderRadius: 'var(--radius)', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.25s, box-shadow 0.25s',
      },
      hoverStyle: { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '1', overflow: 'hidden' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' },
            hoverStyle: { transform: 'scale(1.06)' },
          }],
        },
        {
          tag: 'div', style: { padding: '14px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontSize: '15px', fontWeight: '600', marginBottom: '4px' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '16px', color: 'var(--primary)', fontWeight: '700' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 40px', background: 'var(--bg)', borderBottom: '2px solid var(--border)',
        position: 'sticky', top: '0', zIndex: '100',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700',
            textDecoration: 'none', color: 'var(--primary)',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '20px', fontSize: '14px', fontWeight: '600' },
          children: [
            { tag: 'a', text: 'Shop', href: '/products', style: { textDecoration: 'none', color: 'var(--text)' }, hoverStyle: { color: 'var(--primary)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text)' }, hoverStyle: { color: 'var(--primary)' } },
          ],
        },
      ],
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '40px', borderTop: '2px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '12px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Returns', href: '/page/returns', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Template: Fresh Organic ───
export const freshOrganic: DesignTemplate = {
  id: 'template:fresh-organic',
  title: 'Fresh Organic',
  description: 'Greens and whites, natural motifs, rounded elements, calming and trust-building.',
  industries: ['organic', 'health', 'supplements', 'farm', 'produce', 'tea', 'wellness', 'skincare', 'herbal'],
  theme: {
    fonts: { display: 'DM Serif Display', body: 'Nunito', accent: 'DM Serif Display' },
    colors: {
      bg: '#F7FBF4', surface: '#EDF5E8', text: '#1B3409',
      textMuted: '#4A6B35', primary: '#2D7A2D', accent: '#8BC34A', border: '#D5E5C8',
    },
    radius: '24px',
    spacing: 'generous',
  },
  sections: {
    hero: {
      tag: 'section',
      style: {
        minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '80px 40px',
        background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)',
      },
      children: [
        {
          tag: 'div', style: { maxWidth: '580px' },
          children: [
            {
              tag: 'span', bind: 'store.tagline',
              style: {
                display: 'block', fontFamily: 'var(--font-accent)', fontSize: '14px',
                color: 'var(--accent)', marginBottom: '20px', letterSpacing: '2px', textTransform: 'uppercase',
              },
            },
            {
              tag: 'h1', bind: 'store.name',
              style: {
                fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,5vw,64px)',
                fontWeight: '400', lineHeight: '1.15', color: 'var(--text)', marginBottom: '32px',
              },
            },
            {
              tag: 'a', text: 'Explore Products', href: '/products',
              style: {
                display: 'inline-block', padding: '16px 40px', background: 'var(--primary)',
                color: '#FFFFFF', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
                borderRadius: '999px', transition: 'background 0.3s',
              },
              hoverStyle: { background: '#246B24' },
            },
          ],
        },
      ],
      responsive: { '768': { minHeight: '55vh', padding: '48px 20px' } },
      animation: { type: 'fade-up', stagger: 130 },
    },
    featured: {
      tag: 'section',
      style: { padding: '80px 40px' },
      children: [
        {
          tag: 'h2', text: 'Farm Fresh',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: '400',
            textAlign: 'center', marginBottom: '40px', color: 'var(--text)',
          },
        },
        {
          tag: 'div',
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' },
          repeat: { source: 'products', limit: 8 },
          template: 'section:productcard',
          responsive: { '768': { gridTemplateColumns: 'repeat(2, 1fr)' } },
        },
      ],
      responsive: { '768': { padding: '48px 16px' } },
    },
    productcard: {
      tag: 'a',
      style: {
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: '#FFFFFF', borderRadius: 'var(--radius)', overflow: 'hidden',
        border: '1px solid var(--border)', transition: 'transform 0.3s, box-shadow 0.3s',
      },
      hoverStyle: { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(45,122,45,0.1)' },
      children: [
        {
          tag: 'div', style: { aspectRatio: '4/5', overflow: 'hidden' },
          children: [{
            tag: 'img', bind: 'product.images[0]',
            style: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' },
            hoverStyle: { transform: 'scale(1.04)' },
          }],
        },
        {
          tag: 'div', style: { padding: '18px' },
          children: [
            {
              tag: 'h3', bind: 'product.title',
              style: { fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '400', marginBottom: '6px' },
            },
            {
              tag: 'span', bind: 'product.price', format: 'currency',
              style: { fontSize: '15px', color: 'var(--primary)', fontWeight: '600' },
            },
          ],
        },
      ],
    },
    nav: {
      tag: 'nav',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: '0', zIndex: '100',
      },
      children: [
        {
          tag: 'a', bind: 'store.name', href: '/',
          style: {
            fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400',
            textDecoration: 'none', color: 'var(--primary)',
          },
        },
        {
          tag: 'div', style: { display: 'flex', gap: '24px', fontSize: '14px' },
          children: [
            { tag: 'a', text: 'Shop', href: '/products', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
            { tag: 'a', text: 'Cart', href: '/cart', style: { textDecoration: 'none', color: 'var(--text-muted)' }, hoverStyle: { color: 'var(--primary)' } },
          ],
        },
      ],
    },
    footer: {
      tag: 'footer',
      style: {
        padding: '52px 40px', borderTop: '1px solid var(--border)',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '48px',
      },
      children: [
        {
          tag: 'div', style: { display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '14px' },
          children: [
            { tag: 'a', text: 'About', href: '/page/about', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Contact', href: '/page/contact', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
            { tag: 'a', text: 'Returns', href: '/page/returns', style: { textDecoration: 'none', color: 'var(--text-muted)' } },
          ],
        },
        { tag: 'p', bind: 'store.name' },
      ],
    },
  },
  pages: {
    home: ['nav', 'hero', 'featured', 'footer'],
    products: ['nav', 'featured', 'footer'],
    product: ['nav', 'footer'],
    cart: ['nav', 'footer'],
    checkout: ['nav', 'footer'],
  },
};

// ─── Export all templates ───
export const ALL_TEMPLATES: DesignTemplate[] = [
  minimalLuxury,
  boldModern,
  warmArtisan,
  cleanPro,
  vibrantStreet,
  freshOrganic,
];

/** Convert template to a state payload for storage in system:templates scope */
export function templateToStatePayload(t: DesignTemplate) {
  return {
    ucode: t.id,
    type: 'template',
    title: t.title,
    scope: 'system:templates',
    payload: {
      description: t.description,
      industries: t.industries,
      theme: t.theme,
      sections: t.sections,
      pages: t.pages,
    },
  };
}
