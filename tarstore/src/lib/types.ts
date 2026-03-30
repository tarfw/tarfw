// ─── Design Tree Node ───
export interface DesignNode {
  tag?: string;
  text?: string;
  bind?: string;            // Dynamic data: "product.title", "store.name"
  format?: string;          // "currency", "stock", "date"
  href?: string;
  style?: Record<string, string>;
  hoverStyle?: Record<string, string>;
  responsive?: Record<string, Record<string, string>>;
  animation?: { type: string; stagger?: number; delay?: number };
  repeat?: { source: string; limit?: number };
  template?: string;        // Reference: "section:productcard"
  children?: DesignNode[];
}

// ─── Store Data (passed to renderer for binding resolution) ───
export interface StoreData {
  store: {
    name: string;
    tagline: string;
    logo?: string;
    coverImage?: string;
    phone?: string;
    address?: string;
    currency: string;
    currencySymbol: string;
    social?: Record<string, string>;
    seo?: { title: string; description: string; ogImage?: string };
    theme: ThemeConfig;
  };
  products: ProductData[];
  categories: CategoryData[];
  // Current item context (set during repeat loops)
  product?: ProductData;
  instance?: InstanceData;
  category?: CategoryData;
}

export interface ThemeConfig {
  fonts: { display: string; body: string; accent: string };
  colors: {
    bg: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    accent: string;
    border: string;
  };
  radius: string;
  spacing: string;
}

export interface ProductData {
  ucode: string;
  title: string;
  payload: Record<string, any>;
  instance?: InstanceData;
}

export interface InstanceData {
  qty: number | null;
  value: number | null;
  currency: string;
  available: boolean;
}

export interface CategoryData {
  ucode: string;
  title: string;
  payload: Record<string, any>;
}

export interface SectionState {
  ucode: string;
  title: string;
  payload: {
    order?: number;
    design?: DesignNode;
    role?: string;
    [key: string]: any;
  };
}

// ─── Hono Bindings ───
export type Bindings = {
  STATES_DB_URL: string;
  STATES_DB_TOKEN: string;
  INSTANCES_DB_URL: string;
  INSTANCES_DB_TOKEN: string;
  TARAGENT_API: string;
};

// ─── Hono Variables (set by middleware) ───
export type Variables = {
  scope: string;
  slug: string;
  storeConfig: StoreData['store'] | null;
};
