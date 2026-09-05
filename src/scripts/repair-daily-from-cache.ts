import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertValidPeriods } from '@/lib/scrape-validation';
import { TOP_COUNT } from '@/lib/scraper';
import { isDailyDataFilename, saveDaily } from '@/lib/storage';
import { dateInProductHunt, dateInTehran, startOfProductHuntDayUtc } from '@/lib/tehran-date';
import type { DailyData, PeriodKey, PeriodsData, Product } from '@/types';

const now = new Date();
const DATA_DIR = path.join(process.cwd(), 'data');
const PERIOD_KEYS: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'year'];
const productHuntToday = dateInProductHunt(now);
const productHuntYesterday = dateInProductHunt(new Date(startOfProductHuntDayUtc(now, 0).getTime() - 1));

async function loadPersistedProductEvidence(): Promise<Product[]> {
  const files = (await readdir(DATA_DIR)).filter(isDailyDataFilename).sort();
  const products: Product[] = [];
  for (const filename of files) {
    const daily = JSON.parse(await readFile(path.join(DATA_DIR, filename), 'utf8')) as DailyData;
    for (const key of PERIOD_KEYS) {
      for (const product of daily.periods?.[key] ?? []) {
        if (product?.slug) products.push(product);
      }
    }
  }
  return products;
}

function evidenceScore(product: Product): number {
  return (product.comments?.length ?? 0) * 10
    + (product.faComments?.length ?? 0) * 5
    + (product.faDescription?.trim() ? 4 : 0)
    + (product.aiReview?.trim() ? 4 : 0)
    + (product.iranEquivalent ? 4 : 0)
    + (product.screenshots?.length ?? 0);
}

function belongsToPeriod(product: Product, key: PeriodKey): boolean {
  if (!product.featuredAt || (product.votes ?? 0) <= 0) return false;
  const featuredAt = new Date(product.featuredAt);
  if (Number.isNaN(featuredAt.getTime())) return false;

  if (key === 'today') return product.date === productHuntToday;
  if (key === 'yesterday') return product.date === productHuntYesterday;

  const age = now.getTime() - featuredAt.getTime();
  if (age < 0) return false;
  if (key === 'week') return age <= 7 * 86_400_000;
  if (key === 'month') return age <= 30 * 86_400_000;
  return age <= 365 * 86_400_000;
}

function selectPeriod(products: Product[], key: PeriodKey): Product[] {
  const unique = new Map<string, Product>();
  for (const product of products) {
    if (!product.slug || !belongsToPeriod(product, key)) continue;
    const existing = unique.get(product.slug);
    if (
      !existing
      || (product.votes ?? 0) > (existing.votes ?? 0)
      || ((product.votes ?? 0) === (existing.votes ?? 0) && evidenceScore(product) > evidenceScore(existing))
    ) {
      unique.set(product.slug, product);
    }
  }

  return [...unique.values()]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.slug.localeCompare(b.slug))
    .slice(0, TOP_COUNT)
    .map((product, index) => ({ ...product, id: `ph-${key}-${index + 1}`, rank: index + 1 }));
}

const evidence = await loadPersistedProductEvidence();
const periods = {
  today: selectPeriod(evidence, 'today'),
  yesterday: selectPeriod(evidence, 'yesterday'),
  week: selectPeriod(evidence, 'week'),
  month: selectPeriod(evidence, 'month'),
  year: selectPeriod(evidence, 'year'),
} satisfies PeriodsData;

console.log(`♻️  Rebuilding daily snapshot from ${evidence.length} persisted Product Hunt observations`);
console.log(`   Product Hunt today: ${productHuntToday}`);
for (const [key, products] of Object.entries(periods)) {
  console.log(`   ${key}: ${products.length} trusted products`);
}

assertValidPeriods(periods);
await saveDaily(dateInTehran(now), periods, { replaceCurrent: true });
console.log('✅ Historical evidence recovery produced a valid daily snapshot.');
