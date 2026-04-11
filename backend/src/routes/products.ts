import { Router } from 'express';
import { sessionStore } from '../store/sessionStore.js';

export const productsRouter = Router();

export interface ProductSummary {
  productCode: string;
  productName: string;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  totalInventory: number;
  totalSales: number;
  totalReturns: number;
  str: number;
  strPercent: number;
  storeCount: number;
  variantCount: number;
  gender: string | null;
  stockStatus: 'KRITIK' | 'DUSUK' | 'NORMAL' | 'YUKSEK';
  price: number | null;
  category: string | null;
}

export interface ProductsResponse {
  products: ProductSummary[];
  stats: {
    totalProducts: number;
    totalSold: number;
    totalReturned: number;
    avgStrPercent: number;
    bestSeller: { productName: string; totalSales: number } | null;
  };
}

function stockStatus(inventory: number): ProductSummary['stockStatus'] {
  if (inventory <= 5)  return 'KRITIK';
  if (inventory <= 20) return 'DUSUK';
  if (inventory <= 100) return 'NORMAL';
  return 'YUKSEK';
}

productsRouter.get('/', (_req, res) => {
  const { data } = sessionStore.get();

  if (!data || data.length === 0) {
    const empty: ProductsResponse = {
      products: [],
      stats: { totalProducts: 0, totalSold: 0, totalReturned: 0, avgStrPercent: 0, bestSeller: null },
    };
    res.json(empty);
    return;
  }

  // Aggregate by productCode
  const map = new Map<string, {
    productCode: string;
    productName: string;
    imageUrl: string | null;
    colors: Set<string>;
    sizes: Set<string>;
    variants: Set<string>;
    totalInventory: number;
    totalSales: number;
    totalReturns: number;
    storeNames: Set<string>;
    gender: string | null;
    price: number | null;
    category: string | null;
  }>();

  for (const record of data) {
    const key = record.productCode;
    if (!map.has(key)) {
      map.set(key, {
        productCode: record.productCode,
        productName: record.productName,
        imageUrl: record.itemUrl ?? null,
        colors: new Set(),
        sizes: new Set(),
        variants: new Set(),
        totalInventory: 0,
        totalSales: 0,
        totalReturns: 0,
        storeNames: new Set(),
        gender: record.gender ?? null,
        price: record.price ?? null,
        category: record.category ?? null,
      });
    }
    const p = map.get(key)!;
    if (!p.imageUrl && record.itemUrl) p.imageUrl = record.itemUrl;
    if (p.price == null && record.price != null) p.price = record.price;
    if (p.category == null && record.category) p.category = record.category;
    if (record.color) p.colors.add(record.color);
    if (record.size)  p.sizes.add(record.size);
    p.variants.add(`${record.color}__${record.size}`);
    p.totalInventory += record.inventory;
    p.totalSales     += record.salesQty;
    p.totalReturns   += record.returnQty ?? 0;
    p.storeNames.add(record.warehouseName);
  }

  const products: ProductSummary[] = Array.from(map.values()).map((p) => {
    const total = p.totalSales + p.totalInventory;
    const str   = total > 0 ? p.totalSales / total : 0;
    return {
      productCode:   p.productCode,
      productName:   p.productName,
      imageUrl:      p.imageUrl,
      colors:        Array.from(p.colors).sort(),
      sizes:         Array.from(p.sizes).sort((a, b) => {
        // Numeric-aware size sort
        const sizeOrder = ['XXS','XS','S','M','L','XL','XXL','XXXL','3XL','4XL'];
        const ai = sizeOrder.indexOf(a.toUpperCase());
        const bi = sizeOrder.indexOf(b.toUpperCase());
        if (ai !== -1 && bi !== -1) return ai - bi;
        const an = parseFloat(a); const bn = parseFloat(b);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return a.localeCompare(b, 'tr');
      }),
      totalInventory: p.totalInventory,
      totalSales:     p.totalSales,
      totalReturns:   p.totalReturns,
      str,
      strPercent:     Math.round(str * 100),
      storeCount:     p.storeNames.size,
      variantCount:   p.variants.size,
      gender:         p.gender,
      stockStatus:    stockStatus(p.totalInventory),
      price:          p.price,
      category:       p.category,
    };
  });

  // Sort by totalSales desc
  products.sort((a, b) => b.totalSales - a.totalSales);

  const totalSold     = products.reduce((s, p) => s + p.totalSales, 0);
  const totalReturned = products.reduce((s, p) => s + p.totalReturns, 0);
  const avgStrPercent = products.length > 0
    ? Math.round(products.reduce((s, p) => s + p.strPercent, 0) / products.length)
    : 0;
  const bestSeller = products.length > 0
    ? { productName: products[0].productName, totalSales: products[0].totalSales }
    : null;

  const response: ProductsResponse = {
    products,
    stats: { totalProducts: products.length, totalSold, totalReturned, avgStrPercent, bestSeller },
  };

  res.json(response);
});
