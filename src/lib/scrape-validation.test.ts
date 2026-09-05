import { describe, expect, test } from 'bun:test';
import { mergeVoteAwareProducts } from './scraper';
import { assertValidPeriods, requireProductHuntToken, validatePeriods } from './scrape-validation';
import type { PeriodKey, PeriodsData, Product } from '@/types';

function product(period: PeriodKey, index: number, votes = index + 1): Product {
  return {
    id: `ph-${period}-${index + 1}`,
    date: '2026-08-22',
    rank: index + 1,
    name: `${period}-${index + 1}`,
    slug: `${period}-${index + 1}`,
    tagline: 'tagline',
    description: 'description',
    category: 'General',
    url: `https://www.producthunt.com/posts/${period}-${index + 1}`,
    votes,
    websiteUrl: '',
    comments: [],
  };
}

function validPeriods(): PeriodsData {
  return {
    today: Array.from({ length: 10 }, (_, i) => product('today', i, i + 1)),
    yesterday: Array.from({ length: 3 }, (_, i) => product('yesterday', i)),
    week: Array.from({ length: 5 }, (_, i) => product('week', i)),
    month: Array.from({ length: 5 }, (_, i) => product('month', i)),
    year: Array.from({ length: 5 }, (_, i) => product('year', i)),
  };
}

describe('scrape validation', () => {
  test('accepts a complete five-period scrape with exactly ten daily products', () => {
    expect(validatePeriods(validPeriods())).toEqual([]);
    expect(() => assertValidPeriods(validPeriods())).not.toThrow();
  });

  test('rejects fewer than ten today products', () => {
    const periods = validPeriods();
    periods.today = periods.today.slice(0, 9);
    expect(() => assertValidPeriods(periods)).toThrow('expected exactly 10 products');
  });

  test('rejects more than ten today products', () => {
    const periods = validPeriods();
    periods.today.push(product('today', 10, 11));
    expect(() => assertValidPeriods(periods)).toThrow('expected exactly 10 products');
  });

  test('rejects incomplete periods', () => {
    const periods = validPeriods();
    periods.month = [];
    expect(() => assertValidPeriods(periods)).toThrow('month');
  });

  test('rejects empty or duplicate slugs', () => {
    const periods = validPeriods();
    periods.week[0].slug = '';
    periods.week[2].slug = periods.week[1].slug;
    const messages = validatePeriods(periods).map((issue) => issue.message);
    expect(messages.some((message) => message.includes('empty slug'))).toBe(true);
    expect(messages.some((message) => message.includes('duplicate slug'))).toBe(true);
  });

  test('rejects today data without a real vote count and requires PH_API_TOKEN', () => {
    const periods = validPeriods();
    periods.today = periods.today.map((item) => ({ ...item, votes: 0 }));
    expect(() => assertValidPeriods(periods)).toThrow('real vote count');
    expect(() => requireProductHuntToken(undefined)).toThrow('PH_API_TOKEN');
    expect(requireProductHuntToken(' token ')).toBe('token');
  });

  test('vote-aware recovery excludes unresolved zero-vote Atom entries', () => {
    const atomOnly = [product('today', 0, 0), product('today', 1, 0), product('today', 2, 0)];
    expect(mergeVoteAwareProducts([], atomOnly)).toEqual([]);
  });

  test('vote-aware recovery merges trusted products and keeps highest real vote count', () => {
    const api = [
      { ...product('today', 0, 2), slug: 'alpha', name: 'Alpha' },
      { ...product('today', 1, 1), slug: 'beta', name: 'Beta' },
    ];
    const recovered = [
      { ...product('today', 5, 0), slug: 'gamma', name: 'Gamma' },
      { ...product('today', 6, 8), slug: 'beta', name: 'Beta recovered' },
      { ...product('today', 7, 5), slug: 'delta', name: 'Delta' },
    ];

    const merged = mergeVoteAwareProducts(api, recovered);
    expect(merged.map((item) => item.slug)).toEqual(['beta', 'delta', 'alpha']);
    expect(merged.find((item) => item.slug === 'beta')?.votes).toBe(8);
    expect(merged.every((item) => item.votes > 0)).toBe(true);
    expect(merged.map((item) => item.rank)).toEqual([1, 2, 3]);
  });
});
