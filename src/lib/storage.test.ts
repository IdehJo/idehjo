import { expect, test } from 'bun:test';
import { isDailyDataFilename, mergePeriods, shouldMergePreviousDaily } from './storage';
import type { PeriodsData, Product } from '@/types';

function product(slug: string, votes: number): Product {
  return {
    id: slug,
    date: '2026-09-04',
    rank: 1,
    name: slug,
    slug,
    tagline: slug,
    description: slug,
    category: 'General',
    url: `https://example.com/${slug}`,
    votes,
    websiteUrl: `https://example.com/${slug}`,
    comments: [],
  };
}

function periods(today: Product[]): PeriodsData {
  return { today, yesterday: [], week: [], month: [], year: [] };
}

test('daily data filename filter accepts only YYYY-MM-DD json files', () => {
  expect(isDailyDataFilename('2026-08-26.json')).toBe(true);
  expect(isDailyDataFilename('2026-01-01.json')).toBe(true);
  expect(isDailyDataFilename('scrape-health.json')).toBe(false);
  expect(isDailyDataFilename('health.json')).toBe(false);
  expect(isDailyDataFilename('2026-08-26.backup.json')).toBe(false);
  expect(isDailyDataFilename('.gitkeep')).toBe(false);
});

test('daily storage merges only normal reruns for the same date', () => {
  expect(shouldMergePreviousDaily('2026-09-04', '2026-09-04')).toBe(true);
  expect(shouldMergePreviousDaily('2026-09-03', '2026-09-04')).toBe(false);
  expect(shouldMergePreviousDaily(undefined, '2026-09-04')).toBe(false);
});

test('explicit daily repair never merges a contaminated same-day snapshot', () => {
  expect(shouldMergePreviousDaily('2026-09-04', '2026-09-04', true)).toBe(false);
});

test('today storage is always capped at exactly ten highest-vote products', () => {
  const oldToday = Array.from({ length: 10 }, (_, i) => product(`old-${i}`, 100 - i));
  const newToday = Array.from({ length: 10 }, (_, i) => product(`new-${i}`, 200 - i));
  const merged = mergePeriods(periods(oldToday), periods(newToday));
  expect(merged.today).toHaveLength(10);
  expect(merged.today.every((item) => item.slug.startsWith('new-'))).toBe(true);
});
