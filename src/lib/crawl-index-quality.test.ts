import { expect, test } from 'bun:test';
import type { Product } from '@/types';
import {
  analyzeCrawlIndexQuality,
  buildIndexableSurfaceInventory,
  latestRealDataDate,
} from './crawl-index-quality';

function product(slug: string, votes: number, date = '2026-09-03'): Product {
  return {
    id: slug,
    date,
    rank: 1,
    name: slug.toUpperCase(),
    slug,
    tagline: 'AI workspace',
    description: 'AI workspace for teams',
    faDescription: 'فضای کاری هوش مصنوعی برای تیم‌ها',
    category: 'AI',
    categoryFa: 'هوش مصنوعی',
    url: `https://www.producthunt.com/posts/${slug}`,
    votes,
    websiteUrl: `https://${slug}.example`,
  };
}

const products = [
  product('atlas', 100, '2026-09-01'),
  product('nova', 90, '2026-09-02'),
  product('orbit', 80, '2026-09-03'),
  product('pulse', 70, '2026-09-03'),
  product('quill', 60, '2026-09-03'),
];

test('uses real corpus dates instead of build time for freshness', () => {
  expect(latestRealDataDate(products)).toBe('2026-09-03');
  expect(latestRealDataDate([product('bad', 1, 'not-a-date')])).toBeUndefined();
});

test('builds deterministic eligible indexable surface inventory', () => {
  const first = buildIndexableSurfaceInventory(products);
  const second = buildIndexableSurfaceInventory([...products].reverse());

  expect(first.map((item) => item.path)).toEqual(second.map((item) => item.path));
  expect(first.some((item) => item.type === 'product')).toBe(true);
  expect(first.some((item) => item.type === 'discover')).toBe(true);
  expect(first.some((item) => item.type === 'guide')).toBe(true);
  expect(first.some((item) => item.type === 'alternatives')).toBe(true);
  expect(first.some((item) => item.type === 'compare')).toBe(true);
});

test('reports sitemap gaps, duplicates and coverage without synthetic SEO metrics', () => {
  const inventory = buildIndexableSurfaceInventory(products);
  const included = inventory.slice(0, Math.max(1, inventory.length - 2)).map((item) => item.path);
  const sitemapPaths = [...included, included[0], '/unexpected'];
  const report = analyzeCrawlIndexQuality(products, sitemapPaths);

  expect(report.missingFromSitemap.length).toBeGreaterThan(0);
  expect(report.duplicatePaths).toEqual([included[0]]);
  expect(report.unexpectedInSitemap).toEqual(['/unexpected']);
  expect(report.sitemapCoverageRatio).toBeLessThan(1);
  expect(Object.keys(report)).not.toContain('searchVolume');
  expect(Object.keys(report)).not.toContain('rankingScore');
});
