import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadCorpus } from '@/lib/corpus';
import { auditFinalProductReadiness, type ReadinessIssue } from '@/lib/final-product-readiness';
import { TOP_COUNT } from '@/lib/scraper';
import { dateInProductHunt, dateInTehran } from '@/lib/tehran-date';
import type { DailyData } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DAILY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

async function latestDailyState() {
  const files = (await readdir(DATA_DIR)).filter((name) => DAILY_FILE.test(name)).sort();
  const latestFile = files.at(-1) ?? null;
  if (!latestFile) return { latestFile: null, daily: null as DailyData | null };
  const daily = JSON.parse(await readFile(path.join(DATA_DIR, latestFile), 'utf8')) as DailyData;
  return { latestFile, daily };
}

function percent(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : 'n/a';
}

const corpus = await loadCorpus();
const report = auditFinalProductReadiness(corpus.products);
const expectedDate = process.env.READINESS_EXPECTED_DATE?.trim() || dateInTehran();
const { latestFile, daily } = await latestDailyState();
const freshnessBlockers: ReadinessIssue[] = [];

if (!latestFile || latestFile !== `${expectedDate}.json`) {
  freshnessBlockers.push({
    severity: 'blocker',
    code: 'stale-daily-dataset',
    field: 'data',
    message: `Expected daily dataset ${expectedDate}.json but latest repository dataset is ${latestFile ?? 'missing'}.`,
  });
}
if (daily && daily.date && daily.date !== expectedDate) {
  freshnessBlockers.push({
    severity: 'blocker',
    code: 'daily-date-mismatch',
    field: 'date',
    message: `Latest DailyData.date is ${daily.date}; expected ${expectedDate}.`,
  });
}
const todayProducts = daily?.periods?.today ?? [];
const todayCount = todayProducts.length;
if (todayCount !== TOP_COUNT) {
  freshnessBlockers.push({
    severity: 'blocker',
    code: 'invalid-today-product-count',
    field: 'periods.today',
    message: `Latest daily dataset must contain exactly ${TOP_COUNT} Today products; found ${todayCount}.`,
  });
}
const productHuntDate = dateInProductHunt(daily?.scrapedAt ? new Date(daily.scrapedAt) : new Date());
const staleTodayProducts = todayProducts.filter((product) => {
  if (!product.featuredAt || !product.date) return true;
  const featuredAt = new Date(product.featuredAt);
  return Number.isNaN(featuredAt.getTime()) || product.date !== productHuntDate;
});
if (staleTodayProducts.length > 0) {
  freshnessBlockers.push({
    severity: 'blocker',
    code: 'stale-today-products',
    field: 'periods.today',
    message: `${staleTodayProducts.length} Today products are outside persisted Product Hunt launch date ${productHuntDate}: ${staleTodayProducts.slice(0, 10).map((product) => `${product.slug}(${product.date || product.featuredAt || 'missing'})`).join(', ')}.`,
  });
}

const blockers = [...freshnessBlockers, ...report.blockers];
const ready = blockers.length === 0;
const m = report.metrics;
const counts = new Map<string, number>();
for (const issue of blockers) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);

const sourceGroups = new Map<string, string[]>();
for (const product of corpus.products) {
  const url = product.url?.trim();
  if (!url) continue;
  const slugs = sourceGroups.get(url) ?? [];
  slugs.push(product.slug);
  sourceGroups.set(url, slugs);
}
const duplicateGroups = [...sourceGroups.entries()]
  .filter(([, slugs]) => slugs.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

console.log('\n=== IDEHJO FINAL PRODUCT READINESS ===');
console.log(`Expected Tehran date: ${expectedDate}`);
console.log(`Product Hunt ranking date: ${productHuntDate}`);
console.log(`Latest daily file: ${latestFile ?? 'missing'}`);
console.log(`Today products: ${todayCount}/${TOP_COUNT}`);
console.log(`Today Product Hunt date-valid products: ${todayCount - staleTodayProducts.length}/${todayCount}`);
console.log(`Corpus products: ${m.totalProducts}`);
console.log(`Persian descriptions: ${m.withPersianDescription}/${m.totalProducts} (${percent(m.withPersianDescription, m.totalProducts)})`);
console.log(`AI reviews: ${m.withAiReview}/${m.totalProducts} (${percent(m.withAiReview, m.totalProducts)})`);
console.log(`Iran recommendations: ${m.withIranEquivalent}/${m.totalProducts} (${percent(m.withIranEquivalent, m.totalProducts)})`);
console.log(`Products with source comments: ${m.productsWithSourceComments}`);
console.log(`Complete comment translations: ${m.withCompleteCommentTranslation}/${m.productsWithSourceComments} (${percent(m.withCompleteCommentTranslation, m.productsWithSourceComments)})`);
console.log(`Official websites: ${m.withOfficialWebsite}/${m.totalProducts}`);
console.log(`Thumbnails: ${m.withThumbnail}/${m.totalProducts}`);
console.log(`Screenshots: ${m.withScreenshots}/${m.totalProducts}`);
console.log(`Malformed products: ${m.malformedProducts}`);
console.log(`Duplicate slugs: ${m.duplicateSlugs}`);
console.log(`Duplicate source URLs: ${m.duplicateUrls}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${report.warnings.length}`);
console.log(`READY_FOR_PRODUCTION=${ready ? 'YES' : 'NO'}`);

if (counts.size) {
  console.log('\n--- BLOCKER COUNTS ---');
  for (const [code, count] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`${code}: ${count}`);
  }
}

if (duplicateGroups.length) {
  console.log('\n--- DUPLICATE SOURCE URL GROUPS ---');
  for (const [url, slugs] of duplicateGroups) {
    console.log(`${url} => ${slugs.sort().join(', ')}`);
  }
}

if (blockers.length) {
  console.log('\n--- BLOCKERS (first 100) ---');
  for (const issue of blockers.slice(0, 100)) {
    console.log(`[${issue.code}] ${issue.productSlug ? `${issue.productSlug}: ` : ''}${issue.message}`);
  }
}

if (report.warnings.length) {
  console.log('\n--- WARNINGS (first 50) ---');
  for (const issue of report.warnings.slice(0, 50)) {
    console.log(`[${issue.code}] ${issue.productSlug ? `${issue.productSlug}: ` : ''}${issue.message}`);
  }
}

if (!ready) process.exit(1);
