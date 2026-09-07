import type { Product } from '@/types';
import { buildEligibleAlternativeTargets, buildEligibleComparisonPairs } from '@/lib/comparison-engine';
import { buildDecisionGuides } from '@/lib/decision-guides';
import { buildDiscoveryTopics } from '@/lib/discovery-growth';
import { buildTopicalAuthorityGraph } from '@/lib/topical-authority-graph';

export type CrawlSurfaceType = 'product' | 'discover' | 'guide' | 'alternatives' | 'compare';

export type CrawlSurface = {
  type: CrawlSurfaceType;
  path: string;
  evidenceCount: number;
  lastModified?: string;
};

export type CrawlIndexQualityReport = {
  surfaces: CrawlSurface[];
  totalIndexable: number;
  sitemapCount: number;
  sitemapCoverageRatio: number;
  missingFromSitemap: string[];
  unexpectedInSitemap: string[];
  orphanIndexablePaths: string[];
  duplicatePaths: string[];
  unknownFreshnessPaths: string[];
};

function validDate(value?: string): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function latestRealDataDate(products: Product[]): string | undefined {
  return products
    .map((product) => validDate(product.date))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function surface(type: CrawlSurfaceType, path: string, products: Product[]): CrawlSurface {
  return {
    type,
    path,
    evidenceCount: products.length,
    lastModified: latestRealDataDate(products),
  };
}

export function buildIndexableSurfaceInventory(products: Product[]): CrawlSurface[] {
  const inventory: CrawlSurface[] = [];

  for (const product of products) {
    if (!product.slug) continue;
    inventory.push(surface('product', `/product/${encodeURIComponent(product.slug)}`, [product]));
  }

  for (const topic of buildDiscoveryTopics(products)) {
    inventory.push(surface('discover', `/discover/${topic.slug}`, topic.products));
  }

  for (const guide of buildDecisionGuides(products)) {
    inventory.push(surface('guide', `/guides/${guide.slug}`, guide.products));
  }

  for (const target of buildEligibleAlternativeTargets(products)) {
    inventory.push(surface('alternatives', `/alternatives/${encodeURIComponent(target.slug)}`, [target]));
  }

  for (const pair of buildEligibleComparisonPairs(products)) {
    const pairProducts = products.filter((product) => product.slug === pair.leftSlug || product.slug === pair.rightSlug);
    inventory.push(surface('compare', `/compare/${pair.slug}`, pairProducts));
  }

  return inventory.sort((a, b) => a.path.localeCompare(b.path));
}

function graphIdToPath(id: string): string | undefined {
  const [type, value] = id.split(':', 2);
  if (!value) return undefined;
  if (type === 'product') return `/product/${encodeURIComponent(value)}`;
  if (type === 'topic') return `/discover/${value}`;
  if (type === 'guide') return `/guides/${value}`;
  if (type === 'comparison') return `/compare/${value}`;
  return undefined;
}

export function analyzeCrawlIndexQuality(products: Product[], sitemapPaths: string[]): CrawlIndexQualityReport {
  const surfaces = buildIndexableSurfaceInventory(products);
  const expected = new Set(surfaces.map((item) => item.path));
  const sitemapSet = new Set(sitemapPaths);
  const duplicatePaths = sitemapPaths.filter((path, index) => sitemapPaths.indexOf(path) !== index);
  const graph = buildTopicalAuthorityGraph(products);

  const orphanIndexablePaths = graph.orphanNodeIds
    .map(graphIdToPath)
    .filter((path): path is string => Boolean(path && expected.has(path)))
    .sort();

  const missingFromSitemap = [...expected].filter((path) => !sitemapSet.has(path)).sort();
  const unexpectedInSitemap = [...sitemapSet].filter((path) => !expected.has(path)).sort();
  const unknownFreshnessPaths = surfaces.filter((item) => !item.lastModified).map((item) => item.path);

  return {
    surfaces,
    totalIndexable: expected.size,
    sitemapCount: sitemapSet.size,
    sitemapCoverageRatio: expected.size ? (expected.size - missingFromSitemap.length) / expected.size : 1,
    missingFromSitemap,
    unexpectedInSitemap,
    orphanIndexablePaths,
    duplicatePaths: [...new Set(duplicatePaths)].sort(),
    unknownFreshnessPaths,
  };
}
