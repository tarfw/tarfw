import type { DesignNode, StoreData, ProductData, ThemeConfig } from './types';
import { sanitize } from './sanitizer';

// ─── Render Context ───
interface RenderContext {
  html: string;
  css: string;
  media: Record<string, string>;  // breakpoint → CSS rules
  animations: { id: string; type: string; stagger?: number; delay?: number }[];
  counter: number;
  components: Record<string, DesignNode>;  // template references: "section:productcard" → tree
}

function nextId(ctx: RenderContext): string {
  return `t${(ctx.counter++).toString(36)}`;
}

// ─── CSS Helpers ───
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function styleToCSS(style: Record<string, string> | undefined): string {
  if (!style) return '';
  return Object.entries(style)
    .map(([k, v]) => `${camelToKebab(k)}:${v}`)
    .join(';');
}

// ─── Data Binding ───
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    // Handle array index: "images[0]"
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      current = current?.[match[1]]?.[parseInt(match[2])];
    } else {
      current = current?.[part];
    }
    if (current === undefined || current === null) return '';
  }
  return current;
}

function formatValue(value: any, format: string | undefined, data: StoreData): string {
  if (value === null || value === undefined) return '';
  if (!format) return String(value);

  switch (format) {
    case 'currency': {
      const sym = data.store?.currencySymbol || '₹';
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return String(value);
      return `${sym}${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    case 'stock': {
      const qty = typeof value === 'number' ? value : parseInt(value);
      if (isNaN(qty) || qty <= 0) return 'Out of Stock';
      return `In Stock (${qty})`;
    }
    case 'date': {
      try { return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
      catch { return String(value); }
    }
    default:
      return String(value);
  }
}

function resolveBind(bind: string, data: StoreData, format?: string): string {
  const value = getNestedValue(data, bind);
  return formatValue(value, format, data);
}

// ─── Escape HTML ───
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Main Render ───
function renderNode(node: DesignNode, data: StoreData, ctx: RenderContext): void {
  node = sanitize(node);
  const id = nextId(ctx);
  const tag = node.tag || 'div';

  // Handle repeat directive (product loops)
  if (node.repeat) {
    const source = node.repeat.source;
    let items: any[] = [];
    if (source === 'products') items = data.products || [];
    else if (source === 'categories') items = data.categories || [];
    if (node.repeat.limit) items = items.slice(0, node.repeat.limit);

    // Emit container
    if (node.style) ctx.css += `.${id}{${styleToCSS(node.style)}}`;
    if (node.hoverStyle) ctx.css += `.${id}:hover{${styleToCSS(node.hoverStyle)}}`;
    if (node.responsive) {
      for (const [bp, styles] of Object.entries(node.responsive)) {
        ctx.media[bp] = (ctx.media[bp] || '') + `.${id}{${styleToCSS(styles)}}`;
      }
    }
    ctx.html += `<${tag} class="${id}">`;

    for (const item of items) {
      const itemData: StoreData = {
        ...data,
        product: source === 'products' ? item : data.product,
        category: source === 'categories' ? item : data.category,
        instance: source === 'products' ? item.instance : data.instance,
      };

      // If template reference, look up component tree
      if (node.template && ctx.components[node.template]) {
        renderNode(ctx.components[node.template], itemData, ctx);
      } else if (node.children) {
        for (const child of node.children) {
          renderNode(child, itemData, ctx);
        }
      }
    }

    ctx.html += `</${tag}>`;
    return;
  }

  // Resolve text content
  let content = '';
  if (node.bind) {
    content = esc(resolveBind(node.bind, data, node.format));
  } else if (node.text) {
    content = esc(node.text);
  }

  // Emit CSS
  if (node.style) ctx.css += `.${id}{${styleToCSS(node.style)}}`;
  if (node.hoverStyle) ctx.css += `.${id}:hover{${styleToCSS(node.hoverStyle)}}`;
  if (node.responsive) {
    for (const [bp, styles] of Object.entries(node.responsive)) {
      ctx.media[bp] = (ctx.media[bp] || '') + `.${id}{${styleToCSS(styles)}}`;
    }
  }
  if (node.animation) {
    ctx.animations.push({ id, ...node.animation });
  }

  // Emit HTML
  const selfClosing = tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'input';
  const attrs: string[] = [`class="${id}"`];

  if (node.href) attrs.push(`href="${esc(node.href)}"`);
  if (tag === 'img' && node.bind) {
    attrs.push(`src="${esc(resolveBind(node.bind, data))}"`);
    attrs.push(`alt="${content || ''}"`);
    attrs.push('loading="lazy"');
  }

  if (selfClosing) {
    ctx.html += `<${tag} ${attrs.join(' ')} />`;
    return;
  }

  ctx.html += `<${tag} ${attrs.join(' ')}>${content}`;
  if (node.children) {
    for (const child of node.children) {
      renderNode(child, data, ctx);
    }
  }
  ctx.html += `</${tag}>`;
}

// ─── Public API ───

export function renderDesignTree(
  sections: DesignNode[],
  data: StoreData,
  components: Record<string, DesignNode> = {}
): { html: string; css: string } {
  const ctx: RenderContext = {
    html: '',
    css: '',
    media: {},
    animations: [],
    counter: 0,
    components,
  };

  for (const section of sections) {
    renderNode(section, data, ctx);
  }

  // Build media queries
  let mediaCss = '';
  const breakpoints = Object.keys(ctx.media).sort((a, b) => parseInt(b) - parseInt(a));
  for (const bp of breakpoints) {
    mediaCss += `@media(max-width:${bp}px){${ctx.media[bp]}}`;
  }

  // Build animation CSS
  let animCss = '';
  for (const a of ctx.animations) {
    const delay = a.delay || 0;
    animCss += `.${a.id}{opacity:0;transform:translateY(24px);transition:opacity 0.7s ease ${delay}ms,transform 0.7s ease ${delay}ms}`;
    animCss += `.${a.id}.visible{opacity:1;transform:translateY(0)}`;
  }

  return {
    html: ctx.html,
    css: ctx.css + mediaCss + animCss,
  };
}

// ─── Build Full Page HTML ───
export function buildPage(opts: {
  title: string;
  description: string;
  ogImage?: string;
  canonicalUrl?: string;
  theme: ThemeConfig;
  bodyHtml: string;
  bodyCss: string;
  hasAnimations: boolean;
  cartJs?: string;
}): string {
  const { theme } = opts;
  const fonts = [theme.fonts.display, theme.fonts.body, theme.fonts.accent]
    .filter((f, i, a) => a.indexOf(f) === i)
    .map(f => f.replace(/ /g, '+'))
    .join('&family=');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
${opts.ogImage ? `<meta property="og:image" content="${esc(opts.ogImage)}">` : ''}
${opts.canonicalUrl ? `<link rel="canonical" href="${esc(opts.canonicalUrl)}">` : ''}
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${fonts}&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'${theme.fonts.body}',sans-serif;color:${theme.colors.text};background:${theme.colors.bg}}
a{color:inherit}
img{max-width:100%;display:block}
:root{
--font-display:'${theme.fonts.display}',serif;
--font-body:'${theme.fonts.body}',sans-serif;
--font-accent:'${theme.fonts.accent}',serif;
--bg:${theme.colors.bg};
--surface:${theme.colors.surface};
--text:${theme.colors.text};
--text-muted:${theme.colors.textMuted};
--primary:${theme.colors.primary};
--accent:${theme.colors.accent};
--border:${theme.colors.border};
--radius:${theme.radius};
}
@media(max-width:768px){
  body{font-size:15px}
  nav{padding:12px 16px !important}
  nav a{font-size:14px !important}
  section,footer{padding-left:16px !important;padding-right:16px !important}
  h1{font-size:clamp(28px,6vw,42px) !important}
  h2{font-size:clamp(22px,4vw,28px) !important}
  [style*="grid-template-columns"]{grid-template-columns:repeat(2,1fr) !important}
  [style*="display:grid"][style*="1fr 1fr"]{grid-template-columns:1fr !important}
  button,a[style*="padding:16px"],a[style*="padding:14px"]{min-height:48px}
  input,textarea,select{font-size:16px !important;min-height:44px}
}
@media(max-width:480px){
  [style*="grid-template-columns"]{grid-template-columns:1fr !important}
  nav div{gap:16px !important}
  section{padding-top:32px !important;padding-bottom:32px !important}
}
${opts.bodyCss}
</style>
</head>
<body>
${opts.bodyHtml}
${opts.hasAnimations ? `<script>
(function(){var o=new IntersectionObserver(function(e){e.forEach(function(i){if(i.isIntersecting){i.target.classList.add('visible');o.unobserve(i.target)}})},{threshold:0.1});document.querySelectorAll('[class^="t"]').forEach(function(el){var s=getComputedStyle(el);if(s.opacity==='0'&&s.transform!=='none')o.observe(el)})})();
</script>` : ''}
${opts.cartJs || ''}
</body>
</html>`;
}
