import type { Product } from '@/types';

const MALFORMED = /(?:\bundefined\b|\bnull\b|\bnan\b|\btodo\b|\btbd\b|\[object Object\])/i;

function validText(value: unknown): boolean {
  return typeof value === 'string' && Boolean(value.trim()) && !MALFORMED.test(value);
}

function completeIranEquivalent(product: Product): boolean {
  const value = product.iranEquivalent;
  if (!value) return false;
  return Boolean(
    validText(value.productName) &&
      validText(value.description) &&
      validText(value.marketOpportunity) &&
      validText(value.estimatedBudget) &&
      validText(value.targetAudience) &&
      value.challenges?.length && value.challenges.every(validText) &&
      value.monetization?.length && value.monetization.every(validText) &&
      value.techStack?.length && value.techStack.every(validText) &&
      Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100,
  );
}

export function getEnrichmentCompleteness(product: Product) {
  const faDescription = validText(product.faDescription);
  const sourceComments = product.comments ?? [];
  const translatedComments = (product.faComments ?? []).filter(
    (comment) => validText(comment.text) && /[\u0600-\u06FF]/.test(comment.text ?? ''),
  );
  const faComments = sourceComments.length === 0 || translatedComments.length >= sourceComments.length;
  const aiReview = validText(product.aiReview);
  const iranEquivalent = completeIranEquivalent(product);
  const completeFields = [faDescription, faComments, aiReview, iranEquivalent].filter(Boolean).length;
  return { faDescription, faComments, aiReview, iranEquivalent, completeFields, missingFields: 4 - completeFields };
}

export function needsEnrichment(product: Product): boolean {
  return getEnrichmentCompleteness(product).missingFields > 0;
}

export function selectEnrichmentBacklog(products: Product[], limit: number) {
  return products
    .filter((p) => p?.slug && needsEnrichment(p))
    .map((product) => ({ product, completeness: getEnrichmentCompleteness(product) }))
    .sort((a,b) => {
      const m=b.completeness.missingFields-a.completeness.missingFields;
      if(m) return m;
      const d=(a.product.date??'').localeCompare(b.product.date??'');
      if(d) return d;
      const v=(b.product.votes??0)-(a.product.votes??0);
      if(v) return v;
      return a.product.slug.localeCompare(b.product.slug);
    })
    .slice(0, Math.max(0, limit));
}

export function countEnrichmentBacklog(products: Product[]) {
  const incomplete=products.filter(needsEnrichment);
  return {
    totalProducts: products.length,
    backlog: incomplete.length,
    complete: products.length-incomplete.length,
    missingFaDescription: incomplete.filter((p)=>!getEnrichmentCompleteness(p).faDescription).length,
    missingFaComments: incomplete.filter((p)=>!getEnrichmentCompleteness(p).faComments).length,
    missingAiReview: incomplete.filter((p)=>!getEnrichmentCompleteness(p).aiReview).length,
    missingIranEquivalent: incomplete.filter((p)=>!getEnrichmentCompleteness(p).iranEquivalent).length,
  };
}
