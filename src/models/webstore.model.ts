export const webstoreCategories = {
  trending: { label: 'Trending Now', endpoint: 'best', selector: '.trend.goods' },
  new: { label: 'New', endpoint: 'new', selector: '.new.goods' },
  sale: { label: 'Sale', endpoint: 'sale', selector: '.sale.goods' },
  star: { label: 'Star Ratings', endpoint: 'star', selector: '.star.goods' },
} as const;

export type WebstoreCategory = keyof typeof webstoreCategories;
export type WebstoreCurrency = 'PB Cash' | 'Golden Ticket' | 'Star Ticket';

export function isWebstoreCategory(value: string): value is WebstoreCategory {
  return Object.hasOwn(webstoreCategories, value);
}

export interface WebstoreProduct {
  name: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: WebstoreCurrency | null;
  discountPercent: number | null;
  rating: number | null;
  tags: string[];
}

export interface WebstorePage {
  category: WebstoreCategory;
  page: number;
  totalPages: number;
  products: WebstoreProduct[];
  sourceUrl: string;
  fetchedAt: Date;
}
