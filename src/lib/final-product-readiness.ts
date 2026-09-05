import type { Product } from '@/types';

export type ReadinessSeverity = 'blocker' | 'warning';

export type ReadinessIssue = {
  severity: ReadinessSeverity;
  code: string;
  message: string;
  productSlug?: string;
  field?: string;
};

export type ReadinessMetrics = {
  totalProducts: number;
  withPersianDescription: number;
  withCompleteCommentTranslation: number;
  productsWithSourceComments: number;
  withAiReview: number;
  withIranEquivalent: number;
  withThumbnail: number;
  withScreenshots: number;
  withOfficialWebsite: number;
  malformedProducts: number;
  duplicateSlugs: number;
  duplicateUrls: number;
};

export type FinalProductReadinessReport = {
  metrics: ReadinessMetrics;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  readyForProduction: boolean;
};

const MALFORMED_PATTERN = /(?:\bundefined\b|\bnull\b|\bnan\b|\btodo\b|\btbd\b|\[object Object\])/i;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value: unknown): boolean {
  const candidate = text(value);
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function add(
  issues: ReadinessIssue[],
  severity: ReadinessSeverity,
  code: string,
  product: Product,
  field: string,
  message: string,
) {
  issues.push({ severity, code, productSlug: product.slug || undefined, field, message });
}

function visibleEnrichmentStrings(product: Product): Array<{ field: string; value: string }> {
  const values: Array<{ field: string; value: string }> = [];
  const push = (field: string, value: unknown) => {
    const normalized = text(value);
    if (normalized) values.push({ field, value: normalized });
  };

  push('faTagline', product.faTagline);
  push('faDescription', product.faDescription);
  push('faLongDescription', product.faLongDescription);
  push('aiReview', product.aiReview);
  product.faComments?.forEach((comment, index) => push(`faComments.${index}.text`, comment.text));

  if (product.iranEquivalent) {
    push('iranEquivalent.productName', product.iranEquivalent.productName);
    push('iranEquivalent.description', product.iranEquivalent.description);
    push('iranEquivalent.marketOpportunity', product.iranEquivalent.marketOpportunity);
    push('iranEquivalent.estimatedBudget', product.iranEquivalent.estimatedBudget);
    push('iranEquivalent.targetAudience', product.iranEquivalent.targetAudience);
    product.iranEquivalent.challenges?.forEach((value, index) => push(`iranEquivalent.challenges.${index}`, value));
    product.iranEquivalent.monetization?.forEach((value, index) => push(`iranEquivalent.monetization.${index}`, value));
    product.iranEquivalent.techStack?.forEach((value, index) => push(`iranEquivalent.techStack.${index}`, value));
  }

  return values;
}

function hasCompleteIranEquivalent(product: Product): boolean {
  const value = product.iranEquivalent;
  if (!value) return false;
  return Boolean(
    text(value.productName) &&
      text(value.description) &&
      text(value.marketOpportunity) &&
      text(value.estimatedBudget) &&
      text(value.targetAudience) &&
      value.challenges?.length &&
      value.monetization?.length &&
      value.techStack?.length &&
      Number.isFinite(value.confidence) &&
      value.confidence >= 0 &&
      value.confidence <= 100,
  );
}

export function auditFinalProductReadiness(products: Product[]): FinalProductReadinessReport {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const slugCounts = new Map<string, number>();
  const urlCounts = new Map<string, number>();
  const malformedSlugs = new Set<string>();

  let withPersianDescription = 0;
  let withCompleteCommentTranslation = 0;
  let productsWithSourceComments = 0;
  let withAiReview = 0;
  let withIranEquivalent = 0;
  let withThumbnail = 0;
  let withScreenshots = 0;
  let withOfficialWebsite = 0;

  for (const product of products) {
    const slug = text(product.slug);
    const sourceUrl = text(product.url);
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    if (sourceUrl) urlCounts.set(sourceUrl, (urlCounts.get(sourceUrl) ?? 0) + 1);

    const required: Array<[keyof Product, unknown]> = [
      ['id', product.id],
      ['name', product.name],
      ['slug', product.slug],
      ['tagline', product.tagline],
      ['description', product.description],
      ['category', product.category],
      ['date', product.date],
    ];
    for (const [field, value] of required) {
      if (!text(value)) add(blockers, 'blocker', 'missing-required-field', product, String(field), `Missing required field: ${String(field)}`);
    }

    if (!isHttpUrl(product.url)) add(blockers, 'blocker', 'invalid-source-url', product, 'url', 'Source URL is missing or invalid.');
    if (!isHttpUrl(product.websiteUrl)) add(blockers, 'blocker', 'invalid-official-url', product, 'websiteUrl', 'Official website URL is missing or invalid.');
    else withOfficialWebsite += 1;

    if (text(product.faDescription)) withPersianDescription += 1;
    else add(blockers, 'blocker', 'missing-persian-description', product, 'faDescription', 'Persian description is required for every public product.');

    if (text(product.aiReview)) withAiReview += 1;
    else add(blockers, 'blocker', 'missing-ai-review', product, 'aiReview', 'AI review/recommendation is required for every public product page.');

    if (hasCompleteIranEquivalent(product)) withIranEquivalent += 1;
    else add(blockers, 'blocker', 'incomplete-iran-equivalent', product, 'iranEquivalent', 'Iran market opportunity recommendation is missing or incomplete.');

    const sourceComments = product.comments ?? [];
    const faComments = product.faComments ?? [];
    if (sourceComments.length > 0) {
      productsWithSourceComments += 1;
      const translatedTexts = faComments.filter((comment) => text(comment.text));
      if (translatedTexts.length >= sourceComments.length) withCompleteCommentTranslation += 1;
      else add(
        blockers,
        'blocker',
        'incomplete-comment-translation',
        product,
        'faComments',
        `Only ${translatedTexts.length}/${sourceComments.length} source comments have Persian translations.`,
      );
    }

    if (isHttpUrl(product.thumbnail)) withThumbnail += 1;
    else add(warnings, 'warning', 'missing-thumbnail', product, 'thumbnail', 'No valid product thumbnail is available.');

    const validScreenshots = (product.screenshots ?? []).filter(isHttpUrl);
    if (validScreenshots.length > 0) withScreenshots += 1;
    else add(warnings, 'warning', 'missing-screenshot', product, 'screenshots', 'No valid product screenshot is available.');

    for (const { field, value } of visibleEnrichmentStrings(product)) {
      if (MALFORMED_PATTERN.test(value)) {
        malformedSlugs.add(slug || product.id);
        add(blockers, 'blocker', 'malformed-enrichment', product, field, `Malformed user-visible enrichment detected in ${field}.`);
      }
    }
  }

  const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1);
  for (const [slug, count] of duplicateSlugs) {
    blockers.push({ severity: 'blocker', code: 'duplicate-slug', productSlug: slug, field: 'slug', message: `Slug appears ${count} times in corpus.` });
  }

  const duplicateUrls = [...urlCounts.entries()].filter(([, count]) => count > 1);
  for (const [url, count] of duplicateUrls) {
    warnings.push({ severity: 'warning', code: 'shared-source-url', field: 'url', message: `Source product URL is shared by ${count} distinct launch slugs: ${url}` });
  }

  blockers.sort((a, b) => `${a.productSlug ?? ''}:${a.code}:${a.field ?? ''}`.localeCompare(`${b.productSlug ?? ''}:${b.code}:${b.field ?? ''}`));
  warnings.sort((a, b) => `${a.productSlug ?? ''}:${a.code}:${a.field ?? ''}`.localeCompare(`${b.productSlug ?? ''}:${b.code}:${b.field ?? ''}`));

  const metrics: ReadinessMetrics = {
    totalProducts: products.length,
    withPersianDescription,
    withCompleteCommentTranslation,
    productsWithSourceComments,
    withAiReview,
    withIranEquivalent,
    withThumbnail,
    withScreenshots,
    withOfficialWebsite,
    malformedProducts: malformedSlugs.size,
    duplicateSlugs: duplicateSlugs.length,
    duplicateUrls: duplicateUrls.length,
  };

  return { metrics, blockers, warnings, readyForProduction: blockers.length === 0 };
}
