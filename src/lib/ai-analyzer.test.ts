import { describe, expect, test } from 'bun:test';
import { buildPrompt, groqOutputBudget } from './ai-analyzer';
import type { Product } from '@/types';

const product = {
  id: 'p1',
  date: '2026-09-04',
  rank: 1,
  name: 'Example',
  slug: 'example',
  tagline: 'Example tagline',
  description: 'Example description',
  category: 'AI',
  url: 'https://www.producthunt.com/posts/example',
  votes: 10,
  websiteUrl: 'https://example.com',
  comments: [
    { user: 'A', text: 'First source comment with enough text.' },
    { user: 'B', text: 'Second source comment with enough text.' },
  ],
} as Product;

describe('partial enrichment prompt', () => {
  test('requests only Persian comment translation when that is the sole missing field', () => {
    const prompt = buildPrompt(product, {
      faDescription: false,
      faComments: true,
      iranEquivalent: false,
      aiReview: false,
    });

    expect(prompt).toContain('"faComments"');
    expect(prompt).toContain('First source comment');
    expect(prompt).not.toContain('"faDescription"');
    expect(prompt).not.toContain('"iranEquivalent"');
    expect(prompt).not.toContain('"aiReview"');
  });

  test('does not send source comments when comment translation is already complete', () => {
    const prompt = buildPrompt(product, {
      faDescription: true,
      faComments: false,
      iranEquivalent: true,
      aiReview: true,
    });

    expect(prompt).toContain('"faDescription"');
    expect(prompt).toContain('"iranEquivalent"');
    expect(prompt).toContain('"aiReview"');
    expect(prompt).not.toContain('"faComments"');
    expect(prompt).not.toContain('First source comment');
  });

  test('uses a smaller Groq output budget for partial enrichment', () => {
    const commentsOnly = groqOutputBudget({
      faDescription: false,
      faComments: true,
      iranEquivalent: false,
      aiReview: false,
    });
    const descriptionOnly = groqOutputBudget({
      faDescription: true,
      faComments: false,
      iranEquivalent: false,
      aiReview: false,
    });
    const full = groqOutputBudget({
      faDescription: true,
      faComments: true,
      iranEquivalent: true,
      aiReview: true,
    });

    expect(descriptionOnly).toBe(700);
    expect(commentsOnly).toBeLessThan(full);
    expect(full).toBe(2800);
  });
});
