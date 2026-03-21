export type FieldType = 'text' | 'number' | 'textarea' | 'boolean' | 'tags';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
}

export interface StateTypeDef {
  type: string;
  label: string;
  icon: string; // Ionicons name
  color: string;
  fields: FieldDef[];
}

export const STATE_TYPES: StateTypeDef[] = [
  {
    type: 'product',
    label: 'Product',
    icon: 'cube-outline',
    color: '#007AFF',
    fields: [
      { key: 'price', label: 'Price', type: 'number', placeholder: '0.00', required: true },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'INR' },
      { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
      { key: 'sku', label: 'SKU', type: 'text', placeholder: 'SKU-001' },
      { key: 'sizes', label: 'Sizes', type: 'tags', placeholder: 'S, M, L, XL' },
      { key: 'colors', label: 'Colors', type: 'tags', placeholder: 'Red, Blue, Black' },
      { key: 'images', label: 'Image URLs', type: 'tags', placeholder: 'https://...' },
    ],
  },
  {
    type: 'service',
    label: 'Service',
    icon: 'briefcase-outline',
    color: '#FF9500',
    fields: [
      { key: 'price', label: 'Price', type: 'number', placeholder: '0.00', required: true },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
      { key: 'duration', label: 'Duration', type: 'number', placeholder: '60' },
      { key: 'unit', label: 'Unit', type: 'text', placeholder: 'mins / session / month' },
      { key: 'availability', label: 'Availability', type: 'text', placeholder: 'Mon–Fri 9am–5pm' },
    ],
  },
  {
    type: 'category',
    label: 'Category',
    icon: 'folder-outline',
    color: '#34C759',
    fields: [
      { key: 'parentCategory', label: 'Parent Category', type: 'text', placeholder: 'e.g. category:footwear' },
      { key: 'icon', label: 'Icon', type: 'text', placeholder: 'icon name' },
      { key: 'order', label: 'Display Order', type: 'number', placeholder: '0' },
    ],
  },
  {
    type: 'brand',
    label: 'Brand',
    icon: 'shield-checkmark-outline',
    color: '#FF2D55',
    fields: [
      { key: 'logo', label: 'Logo URL', type: 'text', placeholder: 'https://...' },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://brand.com' },
      { key: 'country', label: 'Country', type: 'text', placeholder: 'US' },
    ],
  },
  {
    type: 'collection',
    label: 'Collection',
    icon: 'albums-outline',
    color: '#5856D6',
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'About this collection...' },
      { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'summer, sale, new' },
      { key: 'productIds', label: 'Product UCodes', type: 'tags', placeholder: 'product:shoes1' },
    ],
  },
  {
    type: 'user',
    label: 'User',
    icon: 'person-outline',
    color: '#30B0C7',
    fields: [
      { key: 'email', label: 'Email', type: 'text', placeholder: 'user@example.com', required: true },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1234567890' },
      { key: 'role', label: 'Role', type: 'text', placeholder: 'admin / staff / customer' },
      { key: 'avatar', label: 'Avatar URL', type: 'text', placeholder: 'https://...' },
    ],
  },
  {
    type: 'store',
    label: 'Store',
    icon: 'storefront-outline',
    color: '#FF6B35',
    fields: [
      { key: 'address', label: 'Address', type: 'textarea', placeholder: '123 Main St, City' },
      { key: 'lat', label: 'Latitude', type: 'number', placeholder: '0.000000' },
      { key: 'lng', label: 'Longitude', type: 'number', placeholder: '0.000000' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1234567890' },
      { key: 'hours', label: 'Opening Hours', type: 'text', placeholder: 'Mon–Sun 9am–9pm' },
    ],
  },
  {
    type: 'form',
    label: 'Form',
    icon: 'document-text-outline',
    color: '#636366',
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What this form is for...' },
      { key: 'submitAction', label: 'Submit Action URL', type: 'text', placeholder: 'https://...' },
      { key: 'fields', label: 'Field Names', type: 'tags', placeholder: 'name, email, message' },
    ],
  },
  {
    type: 'campaign',
    label: 'Campaign',
    icon: 'megaphone-outline',
    color: '#FF3B30',
    fields: [
      { key: 'startDate', label: 'Start Date', type: 'text', placeholder: '2025-01-01' },
      { key: 'endDate', label: 'End Date', type: 'text', placeholder: '2025-01-31' },
      { key: 'discount', label: 'Discount %', type: 'number', placeholder: '10' },
      { key: 'targetAudience', label: 'Target Audience', type: 'text', placeholder: 'all / premium / new' },
    ],
  },
  {
    type: 'page',
    label: 'Page',
    icon: 'browsers-outline',
    color: '#007AFF',
    fields: [
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'about-us', required: true },
      { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Page body text...' },
      { key: 'seoTitle', label: 'SEO Title', type: 'text', placeholder: 'About Us | Brand' },
      { key: 'seoDesc', label: 'SEO Description', type: 'text', placeholder: 'We are...' },
    ],
  },
  {
    type: 'section',
    label: 'Section',
    icon: 'grid-outline',
    color: '#34C759',
    fields: [
      { key: 'layout', label: 'Layout', type: 'text', placeholder: 'grid / carousel / banner' },
      { key: 'order', label: 'Display Order', type: 'number', placeholder: '0' },
      { key: 'components', label: 'Component IDs', type: 'tags', placeholder: 'section:hero1' },
    ],
  },
  {
    type: 'media',
    label: 'Media',
    icon: 'image-outline',
    color: '#5856D6',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
      { key: 'mimeType', label: 'MIME Type', type: 'text', placeholder: 'image/jpeg, video/mp4' },
      { key: 'size', label: 'File Size (bytes)', type: 'number', placeholder: '0' },
      { key: 'alt', label: 'Alt Text', type: 'text', placeholder: 'Descriptive text' },
    ],
  },
  {
    type: 'location',
    label: 'Location',
    icon: 'location-outline',
    color: '#FF9500',
    fields: [
      { key: 'address', label: 'Address', type: 'textarea', placeholder: '123 Main St, City', required: true },
      { key: 'lat', label: 'Latitude', type: 'number', placeholder: '0.000000' },
      { key: 'lng', label: 'Longitude', type: 'number', placeholder: '0.000000' },
      { key: 'h3', label: 'H3 Index', type: 'text', placeholder: 'H3 cell ID' },
    ],
  },
  {
    type: 'tag',
    label: 'Tag',
    icon: 'pricetag-outline',
    color: '#30B0C7',
    fields: [
      { key: 'color', label: 'Color (hex)', type: 'text', placeholder: '#FF0000' },
      { key: 'icon', label: 'Icon', type: 'text', placeholder: 'star' },
      { key: 'group', label: 'Group', type: 'text', placeholder: 'status / size / style' },
    ],
  },
];

export const getStateType = (type: string): StateTypeDef | undefined =>
  STATE_TYPES.find((s) => s.type === type);
