import type { MetadataRoute } from 'next';
import {
  buildEligibleAlternativeTargets,
  buildEligibleComparisonPairs,
} from '@/lib/comparison-engine';
import { buildIndexableSurfaceInventory, latestRealDataDate } from '@/lib/crawl-index-quality';
import { loadCorpusProducts } from '@/lib/corpus';
import { buildDecisionGuides } from '@/lib/decision-guides';
import { buildDiscoveryTopics } from '@/lib/discovery-growth';
import { SITE_URL } from '@/lib/seo-geo';
import { extractSlug } from '@/lib/slug';
import { loadLatest } from '@/lib/storage';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await loadLatest();
  const corpusProducts = await loadCorpusProducts();
  const discoveryTopics = buildDiscoveryTopics(corpusProducts);
  const decisionGuides = buildDecisionGuides(corpusProducts);
  const alternativeTargets = buildEligibleAlternativeTargets(corpusProducts);
  const comparisonPairs = buildEligibleComparisonPairs(corpusProducts);
  const corpusLastModified = latestRealDataDate(corpusProducts);
  const freshnessByPath = new Map(
    buildIndexableSurfaceInventory(corpusProducts).map((item) => [item.path, item.lastModified]),
  );

  const slugs = new Set<string>();
  if (data) {
    for (const key of ['today', 'yesterday', 'week', 'month', 'year'] as const) {
      for (const p of data.periods[key] ?? []) {
        const s = p.slug || extractSlug(p.url);
        if (s) slugs.add(s);
      }
    }
  }

  const modified = (path: string) => freshnessByPath.get(path) || corpusLastModified;

  return [
    { url: SITE_URL, lastModified: corpusLastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: corpusLastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categories`, lastModified: corpusLastModified, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/discover`, lastModified: corpusLastModified, changeFrequency: 'daily', priority: 0.85 },
    { url: `${SITE_URL}/guides`, lastModified: corpusLastModified, changeFrequency: 'weekly', priority: 0.82 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    ...discoveryTopics.map((topic) => ({
      url: `${SITE_URL}/discover/${topic.slug}`,
      lastModified: modified(`/discover/${topic.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    })),
    ...decisionGuides.map((guide) => ({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified: modified(`/guides/${guide.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.76,
    })),
    ...alternativeTargets.map((product) => ({
      url: `${SITE_URL}/alternatives/${encodeURIComponent(product.slug)}`,
      lastModified: modified(`/alternatives/${encodeURIComponent(product.slug)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.72,
    })),
    ...comparisonPairs.map((pair) => ({
      url: `${SITE_URL}/compare/${pair.slug}`,
      lastModified: modified(`/compare/${pair.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...[...slugs].map((s) => ({
      url: `${SITE_URL}/product/${encodeURIComponent(s)}`,
      lastModified: modified(`/product/${encodeURIComponent(s)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
