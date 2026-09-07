import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('bounded SEO surface prerendering', () => {
  test('comparison pages keep dynamic long-tail while bounding build-time generation', () => {
    const source = read('src/app/compare/[pair]/page.tsx');

    expect(source).toContain('const STATIC_COMPARISON_BUDGET = 120;');
    expect(source).toContain('export const dynamicParams = true;');
    expect(source).toContain('export const revalidate = 86400;');
    expect(source).toContain('.slice(0, STATIC_COMPARISON_BUDGET)');
  });

  test('alternative pages keep dynamic long-tail while bounding build-time generation', () => {
    const source = read('src/app/alternatives/[slug]/page.tsx');

    expect(source).toContain('const STATIC_ALTERNATIVE_BUDGET = 120;');
    expect(source).toContain('export const dynamicParams = true;');
    expect(source).toContain('export const revalidate = 86400;');
    expect(source).toContain('.slice(0, STATIC_ALTERNATIVE_BUDGET)');
  });

  test('full eligible inventory remains available to sitemap and discovery systems', () => {
    const sitemap = read('src/app/sitemap.ts');

    expect(sitemap).toContain('buildEligibleComparisonPairs');
    expect(sitemap).toContain('buildEligibleAlternativeTargets');
    expect(sitemap).not.toContain('STATIC_COMPARISON_BUDGET');
    expect(sitemap).not.toContain('STATIC_ALTERNATIVE_BUDGET');
  });
});