import type { DesignNode } from './types';

const ALLOWED_TAGS = new Set([
  'div', 'section', 'header', 'footer', 'nav', 'main', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'span', 'a', 'img', 'button',
  'ul', 'ol', 'li', 'figure', 'figcaption', 'blockquote', 'hr', 'br',
  'form', 'input', 'label', 'select', 'option', 'textarea',
]);

const ALLOWED_CSS = new Set([
  // Layout
  'display', 'flexDirection', 'flexWrap', 'alignItems', 'justifyContent',
  'gap', 'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
  'placeItems', 'placeSelf', 'flex', 'order',
  // Sizing
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio',
  // Spacing
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  // Color & Background
  'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'color', 'opacity',
  // Typography
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
  'letterSpacing', 'textTransform', 'textAlign', 'textDecoration', 'wordBreak',
  'whiteSpace', 'textOverflow',
  // Border
  'border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight',
  'borderRadius', 'borderColor', 'borderWidth', 'borderStyle',
  // Position
  'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'inset',
  // Effects
  'overflow', 'overflowX', 'overflowY', 'transform', 'transition',
  'boxShadow', 'textShadow', 'filter', 'backdropFilter',
  // Misc
  'cursor', 'objectFit', 'objectPosition', 'listStyle', 'listStyleType',
  'visibility', 'pointerEvents', 'userSelect',
]);

function sanitizeStyle(style: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!style) return undefined;
  const clean: Record<string, string> = {};
  for (const [key, val] of Object.entries(style)) {
    if (!ALLOWED_CSS.has(key)) continue;
    const v = String(val);
    // Block expression(), url(javascript:), behavior, -moz-binding
    if (/expression\s*\(|javascript:|behavior\s*:|binding\s*:/i.test(v)) continue;
    clean[key] = v;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export function sanitize(node: DesignNode): DesignNode {
  const tag = node.tag && ALLOWED_TAGS.has(node.tag) ? node.tag : 'div';

  // Sanitize href — only allow safe protocols
  let href = node.href;
  if (href) {
    const lower = href.toLowerCase().trim();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      href = undefined;
    }
  }

  const result: DesignNode = { tag };

  if (node.text) result.text = node.text;
  if (node.bind) result.bind = node.bind;
  if (node.format) result.format = node.format;
  if (href) result.href = href;

  result.style = sanitizeStyle(node.style);
  result.hoverStyle = sanitizeStyle(node.hoverStyle);

  if (node.responsive) {
    const resp: Record<string, Record<string, string>> = {};
    for (const [bp, styles] of Object.entries(node.responsive)) {
      const cleaned = sanitizeStyle(styles);
      if (cleaned) resp[bp] = cleaned;
    }
    if (Object.keys(resp).length > 0) result.responsive = resp;
  }

  if (node.animation) result.animation = node.animation;
  if (node.repeat) result.repeat = node.repeat;
  if (node.template) result.template = node.template;

  if (node.children) {
    result.children = node.children.map(sanitize);
  }

  return result;
}
