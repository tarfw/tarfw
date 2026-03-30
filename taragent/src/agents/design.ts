import { Client } from '@libsql/client';

// ─── Template metadata (matches tarstore template IDs) ───
interface TemplateTheme {
  fonts: { display: string; body: string; accent: string };
  colors: Record<string, string>;
  radius: string;
  spacing: string;
}

interface TemplateMeta {
  id: string;
  title: string;
  industries: string[];
  theme: TemplateTheme;
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'template:minimal-luxury', title: 'Minimal Luxury',
    industries: ['jewelry', 'candles', 'fashion', 'wellness', 'premium-food', 'beauty', 'watches'],
    theme: {
      fonts: { display: 'Cormorant Garamond', body: 'Inter', accent: 'Cormorant Garamond' },
      colors: { bg: '#FFFBF7', surface: '#F7F3EE', text: '#1A1A1A', textMuted: '#6B6560', primary: '#2C2220', accent: '#B8977E', border: '#E8E2DB' },
      radius: '2px', spacing: 'generous',
    },
  },
  {
    id: 'template:bold-modern', title: 'Bold Modern',
    industries: ['electronics', 'gaming', 'streetwear', 'tech', 'automotive', 'sports'],
    theme: {
      fonts: { display: 'Montserrat', body: 'Inter', accent: 'Montserrat' },
      colors: { bg: '#0A0A0A', surface: '#141414', text: '#FFFFFF', textMuted: '#888888', primary: '#FF4D4D', accent: '#FFD700', border: '#222222' },
      radius: '8px', spacing: 'normal',
    },
  },
  {
    id: 'template:warm-artisan', title: 'Warm Artisan',
    industries: ['bakery', 'handmade', 'pottery', 'organic', 'crafts', 'candles', 'farm'],
    theme: {
      fonts: { display: 'Playfair Display', body: 'Lora', accent: 'Playfair Display' },
      colors: { bg: '#FAF6F0', surface: '#F0E8DC', text: '#3D2B1F', textMuted: '#7A6555', primary: '#8B5E3C', accent: '#C9A87C', border: '#E0D5C7' },
      radius: '16px', spacing: 'generous',
    },
  },
  {
    id: 'template:clean-pro', title: 'Clean Professional',
    industries: ['general', 'wholesale', 'b2b', 'office', 'supplies', 'grocery', 'pharmacy', 'hardware'],
    theme: {
      fonts: { display: 'Inter', body: 'Inter', accent: 'Inter' },
      colors: { bg: '#FFFFFF', surface: '#F5F5F7', text: '#1D1D1F', textMuted: '#6E6E73', primary: '#0071E3', accent: '#147CE5', border: '#D2D2D7' },
      radius: '8px', spacing: 'normal',
    },
  },
  {
    id: 'template:vibrant-street', title: 'Vibrant Street',
    industries: ['food', 'delivery', 'streetwear', 'sneakers', 'pop-up', 'accessories', 'toys', 'gifts'],
    theme: {
      fonts: { display: 'Space Grotesk', body: 'DM Sans', accent: 'Space Grotesk' },
      colors: { bg: '#FFF8F0', surface: '#FFF0E0', text: '#1A1A1A', textMuted: '#666666', primary: '#FF5722', accent: '#FFB300', border: '#FFE0C0' },
      radius: '16px', spacing: 'normal',
    },
  },
  {
    id: 'template:fresh-organic', title: 'Fresh Organic',
    industries: ['organic', 'health', 'supplements', 'farm', 'produce', 'tea', 'wellness', 'skincare', 'herbal'],
    theme: {
      fonts: { display: 'DM Serif Display', body: 'Nunito', accent: 'DM Serif Display' },
      colors: { bg: '#F7FBF4', surface: '#EDF5E8', text: '#1B3409', textMuted: '#4A6B35', primary: '#2D7A2D', accent: '#8BC34A', border: '#D5E5C8' },
      radius: '24px', spacing: 'generous',
    },
  },
];

// ─── Template section DesignNode trees (duplicated from tarstore/src/templates/designs.ts) ───
// These are written to the state DB as type='section' so the storefront renderer
// can use design-tree rendering instead of falling back to static HTML templates.
interface DesignNode {
  tag: string;
  style?: Record<string, string>;
  hoverStyle?: Record<string, string>;
  children?: DesignNode[];
  text?: string;
  bind?: string;
  href?: string;
  format?: string;
  repeat?: { source: string; limit: number };
  template?: string;
  responsive?: Record<string, Record<string, string>>;
  animation?: { type: string; stagger: number };
}

interface TemplateSections {
  sections: Record<string, DesignNode>;
  pages: Record<string, string[]>;
}

const TEMPLATE_SECTIONS: Record<string, TemplateSections> = {
  'template:minimal-luxury': {
    sections: {
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
  },
  'template:bold-modern': {
    sections: {
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
  },
  'template:warm-artisan': {
    sections: {
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
  },
  'template:clean-pro': {
    sections: {
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
  },
  'template:vibrant-street': {
    sections: {
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
  },
  'template:fresh-organic': {
    sections: {
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
  },
};

const DESIGN_PROMPT = `You are a storefront design AI. Given a store description and a design template, generate customizations.

You must output a JSON object with these fields:
{
  "templateId": "template:...",
  "store": {
    "storeName": "...",
    "tagline": "short tagline",
    "description": "1-2 sentence store description",
    "currency": "INR",
    "currencySymbol": "₹"
  },
  "themeOverrides": {
    "colors": { "primary": "#hex", "accent": "#hex" }
  },
  "seo": {
    "title": "Store Name - What they sell",
    "description": "SEO description"
  },
  "pages": {
    "about": { "title": "About Us", "content": "2-3 paragraphs about the store (HTML allowed)" },
    "returns": { "title": "Returns & Refunds", "content": "standard returns policy text" },
    "contact": { "title": "Contact Us", "content": "contact information" }
  }
}

RULES:
- Pick the most appropriate template from the list provided
- Generate store name from context if not explicitly given
- Write compelling, specific copy — not generic placeholder text
- Currency defaults to INR unless stated otherwise
- Keep tagline under 8 words
- SEO title under 60 chars
- Output ONLY valid JSON, no markdown, no explanation`;

export class DesignAgent {
  private statesDb: Client;
  private env: any;

  constructor(statesDb: Client, env: any) {
    this.statesDb = statesDb;
    this.env = env;
  }

  /** Main entry: generate or update a storefront design */
  async generateDesign(req: {
    text: string;
    scope: string;
    userId: string;
  }): Promise<{ success: boolean; templateId: string; store: any; message: string }> {
    const { text, scope } = req;

    // 1. Pick best template (quick keyword match or AI)
    const templateId = this.pickTemplate(text);

    // 2. Generate customization via AI
    const customization = await this.generateCustomization(text, templateId, scope);

    // 3. Write store config state
    await this.writeStoreConfig(scope, customization);

    // 4. Write template sections to DB
    const tplSections = TEMPLATE_SECTIONS[customization.templateId || templateId];
    if (tplSections) {
      await this.writeSections(scope, tplSections);
    }

    // 5. Write CMS pages
    if (customization.pages) {
      await this.writePages(scope, customization.pages);
    }

    // 6. Emit design event
    await this.emitDesignEvent(scope, templateId);

    return {
      success: true,
      templateId,
      store: customization.store,
      message: `Storefront created with "${TEMPLATES.find(t => t.id === templateId)?.title}" template. Site is live.`,
    };
  }

  /** Iterative update: modify existing design (with snapshot for rollback) */
  async updateDesign(req: {
    text: string;
    scope: string;
    userId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { text, scope } = req;

    // Read current store config
    const current = await this.statesDb.execute({
      sql: `SELECT payload FROM state WHERE type = 'store' AND scope = ? LIMIT 1`,
      args: [scope],
    });

    const currentPayload = current.rows.length > 0
      ? (typeof current.rows[0].payload === 'string' ? JSON.parse(current.rows[0].payload as string) : current.rows[0].payload)
      : {};

    // Snapshot current state before modifying (for rollback)
    const currentSections = await this.statesDb.execute({
      sql: `SELECT ucode, title, payload FROM state WHERE type = 'section' AND scope = ?`,
      args: [scope],
    });
    const sectionSnapshot = currentSections.rows.map(r => ({
      ucode: r.ucode as string,
      title: r.title as string,
      payload: typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload),
    }));

    await this.emitDesignSnapshot(scope, {
      storeConfig: currentPayload,
      sections: sectionSnapshot,
    });

    // Ask AI to generate a patch
    const patch = await this.generatePatch(text, currentPayload, scope);

    if (patch) {
      // Merge patch into existing config
      const merged = { ...currentPayload, ...patch };
      if (patch.theme) {
        merged.theme = { ...currentPayload.theme, ...patch.theme };
        if (patch.theme.colors) merged.theme.colors = { ...currentPayload.theme?.colors, ...patch.theme.colors };
        if (patch.theme.fonts) merged.theme.fonts = { ...currentPayload.theme?.fonts, ...patch.theme.fonts };
      }

      await this.statesDb.execute({
        sql: `UPDATE state SET payload = ? WHERE type = 'store' AND scope = ?`,
        args: [JSON.stringify(merged), scope],
      });

      // Update pages if included
      if (patch.pages) {
        await this.writePages(scope, patch.pages);
      }
    }

    // Emit update event
    await this.emitDesignUpdateEvent(scope);

    return { success: true, message: 'Design updated.' };
  }

  /** Revert design to a previous snapshot */
  async revertDesign(req: {
    snapshotPayload: { storeConfig: any; sections: { ucode: string; title: string; payload: string }[] };
    scope: string;
  }): Promise<{ success: boolean; message: string }> {
    const { snapshotPayload, scope } = req;

    // Restore store config
    if (snapshotPayload.storeConfig) {
      await this.statesDb.execute({
        sql: `UPDATE state SET payload = ? WHERE type = 'store' AND scope = ?`,
        args: [JSON.stringify(snapshotPayload.storeConfig), scope],
      });
    }

    // Restore each section
    for (const sec of snapshotPayload.sections || []) {
      const existing = await this.statesDb.execute({
        sql: `SELECT id FROM state WHERE ucode = ? AND scope = ?`,
        args: [sec.ucode, scope],
      });
      if (existing.rows.length > 0) {
        await this.statesDb.execute({
          sql: `UPDATE state SET payload = ? WHERE ucode = ? AND scope = ?`,
          args: [sec.payload, sec.ucode, scope],
        });
      } else {
        await this.statesDb.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, 'section', ?, ?, ?)`,
          args: [crypto.randomUUID(), sec.ucode, sec.title, sec.payload, scope],
        });
      }
    }

    // Emit revert event (opcode 813)
    await this.emitDesignRevertEvent(scope);

    return { success: true, message: 'Design reverted to previous snapshot.' };
  }

  /** Pick best template based on keywords in description */
  private pickTemplate(text: string): string {
    const lower = text.toLowerCase();
    let bestMatch = TEMPLATES[0].id;
    let bestScore = 0;

    for (const t of TEMPLATES) {
      let score = 0;
      for (const ind of t.industries) {
        if (lower.includes(ind)) score += 2;
      }
      // Also check template title keywords
      if (lower.includes(t.title.toLowerCase())) score += 3;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = t.id;
      }
    }

    // Heuristic fallbacks
    if (bestScore === 0) {
      if (/dark|tech|gaming|electronic|gadget|phone/i.test(lower)) return 'template:bold-modern';
      if (/luxury|premium|elegant|jewel|watch|beauty/i.test(lower)) return 'template:minimal-luxury';
      if (/hand|craft|artisan|bake|potter/i.test(lower)) return 'template:warm-artisan';
      if (/organic|farm|herb|tea|health|supplement|skincare|natural/i.test(lower)) return 'template:fresh-organic';
      if (/food|snack|delivery|street|sneaker|toy|gift|pop/i.test(lower)) return 'template:vibrant-street';
      if (/wholesale|b2b|office|supply|grocery|pharmacy|hardware|general/i.test(lower)) return 'template:clean-pro';
    }

    return bestMatch;
  }

  /** Call LLM to generate store customization */
  private async generateCustomization(text: string, templateId: string, scope: string): Promise<any> {
    const template = TEMPLATES.find(t => t.id === templateId);
    const slug = scope.replace('shop:', '');

    const prompt = `${DESIGN_PROMPT}

AVAILABLE TEMPLATES:
${TEMPLATES.map(t => `- ${t.id}: ${t.title} (${t.industries.join(', ')})`).join('\n')}

SELECTED TEMPLATE: ${templateId} (${template?.title})
STORE SLUG: ${slug}
STORE SCOPE: ${scope}

USER DESCRIPTION:
${text}`;

    // Try Workers AI
    if (this.env.AI) {
      try {
        const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a JSON-only API. Output ONLY valid JSON.' },
            { role: 'user', content: prompt },
          ],
        });
        const raw = (response.response || '').replace(/```json\n?|\n?```/g, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch (e: any) {
        console.warn('[DesignAgent] AI failed, using defaults:', e.message);
      }
    }

    // Fallback: generate from keywords
    return this.fallbackCustomization(text, templateId, scope);
  }

  /** Fallback when AI is unavailable */
  private fallbackCustomization(text: string, templateId: string, scope: string): any {
    const slug = scope.replace('shop:', '');
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);

    return {
      templateId,
      store: {
        storeName: name,
        tagline: `Welcome to ${name}`,
        description: text.slice(0, 200),
        currency: 'INR',
        currencySymbol: '₹',
      },
      themeOverrides: {},
      seo: {
        title: `${name} — Shop Online`,
        description: text.slice(0, 155),
      },
      pages: {
        about: { title: 'About Us', content: `<p>${name} brings you the best selection. ${text.slice(0, 300)}</p>` },
        returns: { title: 'Returns', content: '<p>We accept returns within 7 days of delivery. Items must be unused and in original packaging. Contact us to initiate a return.</p>' },
        contact: { title: 'Contact', content: `<p>Reach us for any questions about your order.</p>` },
      },
    };
  }

  /** Generate a patch for iterative updates */
  private async generatePatch(text: string, currentConfig: any, scope: string): Promise<any> {
    if (this.env.AI) {
      try {
        const prompt = `You are updating an existing store design. Current config:
${JSON.stringify(currentConfig, null, 2)}

User request: "${text}"

Output ONLY a JSON object with the fields that should change. Only include changed fields.
Example: if user says "make it darker", output: {"theme":{"colors":{"bg":"#0A0A0A","surface":"#111"}}}
Example: if user says "change tagline", output: {"tagline":"new tagline"}`;

        const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'Output ONLY valid JSON. No explanation.' },
            { role: 'user', content: prompt },
          ],
        });
        const raw = (response.response || '').replace(/```json\n?|\n?```/g, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch (e: any) {
        console.warn('[DesignAgent] Patch AI failed:', e.message);
      }
    }
    return null;
  }

  /** Write store config to states DB */
  private async writeStoreConfig(scope: string, customization: any) {
    const slug = scope.replace('shop:', '');
    const ucode = `store:${slug}`;
    const store = customization.store || {};
    const themeOverrides = customization.themeOverrides || {};

    // Merge template base theme with any AI-provided overrides
    const templateTheme = TEMPLATES.find(t => t.id === customization.templateId)?.theme || {};
    const mergedTheme = { ...templateTheme, ...themeOverrides };
    if (themeOverrides?.colors) mergedTheme.colors = { ...(templateTheme as any).colors, ...themeOverrides.colors };
    if (themeOverrides?.fonts) mergedTheme.fonts = { ...(templateTheme as any).fonts, ...themeOverrides.fonts };

    const payload = {
      storeName: store.storeName || slug,
      tagline: store.tagline || '',
      description: store.description || '',
      currency: store.currency || 'INR',
      currencySymbol: store.currencySymbol || '₹',
      templateId: customization.templateId,
      theme: mergedTheme,
      seo: customization.seo || {},
    };

    // Upsert store config
    const existing = await this.statesDb.execute({
      sql: `SELECT id FROM state WHERE ucode = ? AND scope = ?`,
      args: [ucode, scope],
    });

    if (existing.rows.length > 0) {
      await this.statesDb.execute({
        sql: `UPDATE state SET title = ?, payload = ? WHERE ucode = ? AND scope = ?`,
        args: [store.storeName || slug, JSON.stringify(payload), ucode, scope],
      });
    } else {
      await this.statesDb.execute({
        sql: `INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, 'store', ?, ?, ?)`,
        args: [crypto.randomUUID(), ucode, store.storeName || slug, JSON.stringify(payload), scope],
      });
    }
  }

  /** Write template sections as type='section' state records */
  private async writeSections(scope: string, tpl: TemplateSections) {
    const pageLayout = tpl.pages.home || [];
    for (let i = 0; i < pageLayout.length; i++) {
      const sectionKey = pageLayout[i];
      const design = tpl.sections[sectionKey];
      if (!design) continue;

      const ucode = `section:${sectionKey}`;
      const role = sectionKey === 'productcard' ? 'component' : 'display';
      const payload = JSON.stringify({ design, order: i, role });

      const existing = await this.statesDb.execute({
        sql: `SELECT id FROM state WHERE ucode = ? AND scope = ?`,
        args: [ucode, scope],
      });

      if (existing.rows.length > 0) {
        await this.statesDb.execute({
          sql: `UPDATE state SET payload = ? WHERE ucode = ? AND scope = ?`,
          args: [payload, ucode, scope],
        });
      } else {
        await this.statesDb.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, 'section', ?, ?, ?)`,
          args: [crypto.randomUUID(), ucode, sectionKey, payload, scope],
        });
      }
    }

    // Also write productcard as a component if not already in the page layout
    if (!pageLayout.includes('productcard') && tpl.sections['productcard']) {
      const ucode = 'section:productcard';
      const payload = JSON.stringify({ design: tpl.sections['productcard'], order: -1, role: 'component' });

      const existing = await this.statesDb.execute({
        sql: `SELECT id FROM state WHERE ucode = ? AND scope = ?`,
        args: [ucode, scope],
      });

      if (existing.rows.length > 0) {
        await this.statesDb.execute({
          sql: `UPDATE state SET payload = ? WHERE ucode = ? AND scope = ?`,
          args: [payload, ucode, scope],
        });
      } else {
        await this.statesDb.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, 'section', ?, ?, ?)`,
          args: [crypto.randomUUID(), ucode, 'productcard', payload, scope],
        });
      }
    }
  }

  /** Write CMS pages */
  private async writePages(scope: string, pages: Record<string, { title: string; content: string }>) {
    for (const [slug, page] of Object.entries(pages)) {
      const ucode = `page:${slug}`;
      const payload = JSON.stringify({ slug, content: page.content, seoTitle: page.title });

      const existing = await this.statesDb.execute({
        sql: `SELECT id FROM state WHERE ucode = ? AND scope = ?`,
        args: [ucode, scope],
      });

      if (existing.rows.length > 0) {
        await this.statesDb.execute({
          sql: `UPDATE state SET title = ?, payload = ? WHERE ucode = ? AND scope = ?`,
          args: [page.title, payload, ucode, scope],
        });
      } else {
        await this.statesDb.execute({
          sql: `INSERT INTO state (id, ucode, type, title, payload, scope) VALUES (?, ?, 'page', ?, ?, ?)`,
          args: [crypto.randomUUID(), ucode, page.title, payload, scope],
        });
      }
    }
  }

  /** Emit DESIGNGENERATE event via OrderDO */
  private async emitDesignEvent(scope: string, templateId: string) {
    if (!this.env.ORDER_DO) return;
    try {
      const id = this.env.ORDER_DO.idFromName(scope);
      const stub = this.env.ORDER_DO.get(id);
      await stub.fetch('http://do/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          opcode: 810,
          streamid: `design:${scope}`,
          delta: 0,
          status: 'done',
          payload: { templateId, action: 'generate' },
        }),
      });
    } catch (e: any) {
      console.error('[DesignAgent] Broadcast error:', e.message);
    }
  }

  /** Emit DESIGNUPDATE event */
  private async emitDesignUpdateEvent(scope: string) {
    if (!this.env.ORDER_DO) return;
    try {
      const id = this.env.ORDER_DO.idFromName(scope);
      const stub = this.env.ORDER_DO.get(id);
      await stub.fetch('http://do/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          opcode: 811,
          streamid: `design:${scope}`,
          delta: 0,
          status: 'done',
          payload: { action: 'update' },
        }),
      });
    } catch (e: any) {
      console.error('[DesignAgent] Broadcast error:', e.message);
    }
  }

  /** Emit DESIGNREVERT event (opcode 813) — save snapshot before update for rollback */
  private async emitDesignSnapshot(scope: string, snapshot: any) {
    if (!this.env.ORDER_DO) return;
    try {
      const id = this.env.ORDER_DO.idFromName(scope);
      const stub = this.env.ORDER_DO.get(id);
      await stub.fetch('http://do/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opcode: 813,
          streamid: `design:${scope}`,
          delta: 0,
          scope,
          payload: snapshot,
        }),
      });
    } catch (e: any) {
      console.error('[DesignAgent] Snapshot save error:', e.message);
    }
  }

  /** Emit DESIGNREVERT event after rollback completes */
  private async emitDesignRevertEvent(scope: string) {
    if (!this.env.ORDER_DO) return;
    try {
      const id = this.env.ORDER_DO.idFromName(scope);
      const stub = this.env.ORDER_DO.get(id);
      await stub.fetch('http://do/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          opcode: 813,
          streamid: `design:${scope}`,
          delta: 0,
          status: 'done',
          payload: { action: 'revert' },
        }),
      });
    } catch (e: any) {
      console.error('[DesignAgent] Revert broadcast error:', e.message);
    }
  }
}
