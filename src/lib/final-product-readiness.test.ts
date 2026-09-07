import { describe, expect, test } from 'bun:test';
import type { Product } from '@/types';
import { auditFinalProductReadiness } from '@/lib/final-product-readiness';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    date: '2026-09-04',
    rank: 1,
    name: 'Example',
    slug: 'example',
    tagline: 'Useful product',
    description: 'A useful product.',
    faDescription: 'یک محصول کاربردی.',
    category: 'Productivity',
    url: 'https://www.producthunt.com/products/example',
    thumbnail: 'https://example.com/thumb.png',
    screenshots: ['https://example.com/screen.png'],
    votes: 10,
    websiteUrl: 'https://example.com',
    comments: [{ user: 'A', text: 'Great' }],
    faComments: [{ user: 'A', text: 'عالی' }],
    aiReview: 'جمع‌بندی و پیشنهاد مبتنی بر داده محصول.',
    iranEquivalent: {
      productName: 'نمونه ایرانی',
      description: 'نسخه پیشنهادی برای بازار ایران',
      marketOpportunity: 'فرصت مشخص بازار',
      estimatedBudget: 'بودجه اولیه برآوردی',
      targetAudience: 'کسب‌وکارهای کوچک',
      challenges: ['توزیع'],
      monetization: ['اشتراک'],
      techStack: ['Next.js'],
      confidence: 80,
    },
    ...overrides,
  };
}

describe('final product readiness', () => {
  test('passes a complete public product', () => {
    const report = auditFinalProductReadiness([product()]);
    expect(report.readyForProduction).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.metrics.withCompleteCommentTranslation).toBe(1);
  });

  test('blocks missing AI and incomplete comment translation', () => {
    const report = auditFinalProductReadiness([
      product({ aiReview: undefined, comments: [{ user: 'A', text: 'One' }, { user: 'B', text: 'Two' }], faComments: [{ user: 'A', text: 'یک' }] }),
    ]);
    expect(report.readyForProduction).toBe(false);
    expect(report.blockers.map((issue) => issue.code)).toContain('missing-ai-review');
    expect(report.blockers.map((issue) => issue.code)).toContain('incomplete-comment-translation');
  });

  test('blocks malformed enrichment text', () => {
    const report = auditFinalProductReadiness([product({ aiReview: 'هزینه تقریبی undefined دلار است.' })]);
    expect(report.blockers.some((issue) => issue.code === 'malformed-enrichment')).toBe(true);
  });

  test('blocks duplicate launch slugs but only warns for shared ProductHunt source URLs', () => {
    const report = auditFinalProductReadiness([
      product(),
      product({ id: 'p2', name: 'Example 2' }),
    ]);
    expect(report.metrics.duplicateSlugs).toBe(1);
    expect(report.metrics.duplicateUrls).toBe(1);
    expect(report.blockers.some((issue) => issue.code === 'duplicate-slug')).toBe(true);
    expect(report.blockers.some((issue) => issue.code === 'duplicate-source-url')).toBe(false);
    expect(report.warnings.some((issue) => issue.code === 'shared-source-url')).toBe(true);
  });

  test('is deterministic regardless of input order', () => {
    const first = product({ id: 'a', slug: 'a', url: 'https://www.producthunt.com/products/a', websiteUrl: 'https://a.example.com' });
    const second = product({ id: 'b', slug: 'b', url: 'https://www.producthunt.com/products/b', websiteUrl: 'https://b.example.com', aiReview: undefined });
    expect(auditFinalProductReadiness([first, second])).toEqual(auditFinalProductReadiness([second, first]));
  });
});
