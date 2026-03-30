import type { Context } from 'hono';

export interface CartItem {
  ucode: string;
  title: string;
  price: number;
  qty: number;
  image?: string;
}

export interface Cart {
  items: CartItem[];
}

const COOKIE_NAME = 'tar_cart';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCart(c: Context): Cart {
  const raw = parseCookie(c.req.header('Cookie'), COOKIE_NAME);
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) return parsed;
  } catch {}
  return { items: [] };
}

export function setCartCookie(cart: Cart): string {
  const val = encodeURIComponent(JSON.stringify(cart));
  return `${COOKIE_NAME}=${val}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

export function addToCart(cart: Cart, item: CartItem): Cart {
  const existing = cart.items.find(i => i.ucode === item.ucode);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.items.push({ ...item });
  }
  return cart;
}

export function updateCartItem(cart: Cart, ucode: string, qty: number): Cart {
  if (qty <= 0) {
    cart.items = cart.items.filter(i => i.ucode !== ucode);
  } else {
    const item = cart.items.find(i => i.ucode === ucode);
    if (item) item.qty = qty;
  }
  return cart;
}

export function removeFromCart(cart: Cart, ucode: string): Cart {
  cart.items = cart.items.filter(i => i.ucode !== ucode);
  return cart;
}

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}
