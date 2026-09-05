import { PERIODS } from '@/lib/scraper';
import type { PeriodKey, PeriodsData, Product } from '@/types';

export interface ValidationIssue {
  period: PeriodKey;
  message: string;
}

const MIN_PRODUCTS: Record<PeriodKey, number> = {
  today: 10,
  yesterday: 3,
  week: 5,
  month: 5,
  year: 5,
};

function validateProductList(period: PeriodKey, products: Product[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (period === 'today') {
    if (products.length !== MIN_PRODUCTS.today) {
      issues.push({
        period,
        message: `expected exactly ${MIN_PRODUCTS.today} products, got ${products.length}`,
      });
    }
  } else if (products.length < MIN_PRODUCTS[period]) {
    issues.push({
      period,
      message: `expected at least ${MIN_PRODUCTS[period]} products, got ${products.length}`,
    });
  }

  const slugs = new Set<string>();
  for (const product of products) {
    const slug = product.slug?.trim();
    if (!slug) {
      issues.push({ period, message: `product "${product.name}" has an empty slug` });
      continue;
    }
    if (slugs.has(slug)) {
      issues.push({ period, message: `duplicate slug "${slug}"` });
    }
    slugs.add(slug);
  }

  if (period === 'today' && products.length > 0 && !products.some((product) => product.votes > 0)) {
    issues.push({
      period,
      message: 'today contains no product with a real vote count',
    });
  }

  return issues;
}

export function validatePeriods(periods: PeriodsData): ValidationIssue[] {
  return PERIODS.flatMap(({ key }) => validateProductList(key, periods[key] ?? []));
}

export function assertValidPeriods(periods: PeriodsData): void {
  const issues = validatePeriods(periods);
  if (issues.length === 0) return;

  const details = issues.map(({ period, message }) => `- ${period}: ${message}`).join('\n');
  throw new Error(`Refusing to publish incomplete scrape:\n${details}`);
}

export function requireProductHuntToken(token: string | undefined): string {
  const value = token?.trim();
  if (!value) {
    throw new Error('PH_API_TOKEN is required for a publishable daily scrape');
  }
  return value;
}
