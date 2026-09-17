import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import corpusSnapshot from '@/generated/corpus.snapshot.json';
import type { DailyData, PHComment, Product } from '@/types';
import { isDailyDataFilename } from '@/lib/storage';

const DATA_DIR = path.join(process.cwd(), 'data');
const CORPUS_FILE = path.join(DATA_DIR, 'corpus.json');

export interface CorpusAudit {
  products: number;
  withRealComments: number;
  withPersianComments: number;
  withPersianDescription: number;
  withAiReview: number;
  withIranEquivalent: number;
  totalRealComments: number;
}

export interface ProductCorpus {
  generatedAt: string;
  sourceFiles: number;
  products: Product[];
  audit: CorpusAudit;
}

function richerComments(a?: PHComment[], b?: PHComment[]): PHComment[] | undefined {
  const left = a ?? [];
  const right = b ?? [];
  if (!left.length && !right.length) return undefined;
  return right.length >= left.length ? right : left;
}

function preferText(newValue?: string, oldValue?: string): string | undefined {
  return newValue?.trim() ? newValue : oldValue;
}

export function mergeCorpusProduct(existing: Product | undefined, incoming: Product): Product {
  if (!existing) return structuredClone(incoming);

  const merged: Product = {
    ...existing,
    ...incoming,
    votes: Math.max(existing.votes ?? 0, incoming.votes ?? 0),
    description: preferText(incoming.description, existing.description) ?? '',
    longDescription: preferText(incoming.longDescription, existing.longDescription),
    faDescription: preferText(incoming.faDescription, existing.faDescription),
    faLongDescription: preferText(incoming.faLongDescription, existing.faLongDescription),
    faTagline: preferText(incoming.faTagline, existing.faTagline),
    maker: preferText(incoming.maker, existing.maker),
    makerTitle: preferText(incoming.makerTitle, existing.makerTitle),
    makerTwitter: preferText(incoming.makerTwitter, existing.makerTwitter),
    thumbnail: preferText(incoming.thumbnail, existing.thumbnail),
    websiteUrl: preferText(incoming.websiteUrl, existing.websiteUrl) ?? existing.websiteUrl,
    comments: richerComments(existing.comments, incoming.comments),
    faComments: richerComments(existing.faComments, incoming.faComments),
    aiReview: preferText(incoming.aiReview, existing.aiReview),
    iranEquivalent: incoming.iranEquivalent ?? existing.iranEquivalent,
    screenshots:
      (incoming.screenshots?.length ?? 0) >= (existing.screenshots?.length ?? 0)
        ? incoming.screenshots
        : existing.screenshots,
  };

  return merged;
}

export function auditCorpus(products: Product[]): CorpusAudit {
  return {
    products: products.length,
    withRealComments: products.filter((p) => (p.comments?.length ?? 0) > 0).length,
    withPersianComments: products.filter((p) => (p.faComments?.length ?? 0) > 0).length,
    withPersianDescription: products.filter((p) => Boolean(p.faDescription?.trim())).length,
    withAiReview: products.filter((p) => Boolean(p.aiReview?.trim())).length,
    withIranEquivalent: products.filter((p) => Boolean(p.iranEquivalent)).length,
    totalRealComments: products.reduce((sum, p) => sum + (p.comments?.length ?? 0), 0),
  };
}

export async function buildCorpusFromHistory(): Promise<ProductCorpus> {
  const files = (await readdir(DATA_DIR))
    .filter(isDailyDataFilename)
    .sort();

  const map = new Map<string, Product>();
  let generatedAt = '';

  for (const filename of files) {
    const raw = await readFile(path.join(DATA_DIR, filename), 'utf8');
    const daily = JSON.parse(raw) as DailyData;
    generatedAt = daily.scrapedAt || generatedAt;

    for (const key of ['today', 'yesterday', 'week', 'month', 'year'] as const) {
      for (const product of daily.periods?.[key] ?? []) {
        if (!product?.slug) continue;
        map.set(product.slug, mergeCorpusProduct(map.get(product.slug), product));
      }
    }
  }

  const products = [...map.values()].sort((a, b) => {
    const voteDelta = (b.votes ?? 0) - (a.votes ?? 0);
    if (voteDelta !== 0) return voteDelta;
    return (b.date ?? '').localeCompare(a.date ?? '');
  });

  return {
    generatedAt,
    sourceFiles: files.length,
    products,
    audit: auditCorpus(products),
  };
}

export async function loadCorpus(): Promise<ProductCorpus> {
  const bundled = corpusSnapshot as ProductCorpus;
  if (Array.isArray(bundled.products) && bundled.products.length > 0) {
    return bundled;
  }

  try {
    const raw = await readFile(CORPUS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as ProductCorpus;
    if (Array.isArray(parsed.products) && parsed.products.length > 0) return parsed;
  } catch {
    // Fall through to historical reconstruction for Node-based maintenance workflows.
  }

  return buildCorpusFromHistory();
}

export async function loadCorpusProducts(): Promise<Product[]> {
  return (await loadCorpus()).products;
}

export async function loadCorpusProduct(slug: string): Promise<Product | null> {
  const products = await loadCorpusProducts();
  return products.find((product) => product.slug === slug) ?? null;
}
