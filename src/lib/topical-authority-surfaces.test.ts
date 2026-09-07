import { expect, test } from 'bun:test';
import type { Product } from '@/types';
import { buildTopicalAuthorityGraph, recommendInternalLinks } from './topical-authority-graph';

function product(slug: string, votes: number): Product {
  return {
    id: slug,
    date: '2026-09-03',
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
  product('atlas', 100),
  product('nova', 90),
  product('orbit', 80),
  product('pulse', 70),
  product('quill', 60),
];

test('surface recommendations resolve to unique graph-backed hrefs without self links', () => {
  const graph = buildTopicalAuthorityGraph(products);
  const surfaceNodeIds = [
    'product:atlas',
    'topic:هوش-مصنوعی',
    'guide:هوش-مصنوعی',
    graph.nodes.find((node) => node.type === 'comparison')?.id,
  ].filter((value): value is string => Boolean(value));

  for (const nodeId of surfaceNodeIds) {
    const current = graph.nodes.find((node) => node.id === nodeId);
    const recommendations = recommendInternalLinks(graph, nodeId, 12)
      .filter((node) => node.href !== current?.href);
    const hrefs = recommendations.map((node) => node.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(recommendations.every((node) => graph.nodes.some((candidate) => candidate.id === node.id))).toBe(true);
    expect(recommendations.every((node) => node.id !== nodeId)).toBe(true);
  }
});

test('product recommendations expose cross-surface navigation when evidence exists', () => {
  const graph = buildTopicalAuthorityGraph(products);
  const recommendations = recommendInternalLinks(graph, 'product:atlas', 12);
  const types = new Set(recommendations.map((node) => node.type));

  expect(types.has('topic')).toBe(true);
  expect(types.has('product') || types.has('comparison')).toBe(true);
});
