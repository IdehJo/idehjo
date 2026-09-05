import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDailyDataFilename } from '@/lib/storage';
import { loadCorpus } from '@/lib/corpus';
import { assertCorpusHealth, mergeProductsIntoCorpus } from '@/lib/corpus-growth';
import type { DailyData, Product } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CORPUS_FILE = path.join(DATA_DIR, 'corpus.json');
const HEALTH_FILE = path.join(DATA_DIR, 'corpus-health.json');
const DEFAULT_DAILY_NEW_QUOTA = 10;

async function main() {
  const files = (await readdir(DATA_DIR)).filter(isDailyDataFilename).sort().reverse();
  if (!files.length) throw new Error('no canonical daily dataset found');

  const latestName = files[0];
  const latest = JSON.parse(await readFile(path.join(DATA_DIR, latestName), 'utf8')) as DailyData;
  const dailyFeatured = latest.periods?.today?.length ?? 0;

  const unique = new Map<string, Product>();
  for (const key of ['today', 'yesterday', 'week', 'month', 'year'] as const) {
    for (const product of latest.periods?.[key] ?? []) {
      if (!product?.slug) continue;
      const existing = unique.get(product.slug);
      if (!existing || (product.votes ?? 0) > (existing.votes ?? 0)) {
        unique.set(product.slug, product);
      }
    }
  }

  const current = await loadCorpus();
  const { corpus, report } = mergeProductsIntoCorpus(
    current,
    [...unique.values()],
    { maxNewProducts: DEFAULT_DAILY_NEW_QUOTA },
  );

  corpus.sourceFiles = Math.max(current.sourceFiles, files.length);
  corpus.generatedAt = latest.scrapedAt || new Date().toISOString();

  assertCorpusHealth(report);

  await writeFile(CORPUS_FILE, JSON.stringify(corpus, null, 2), 'utf8');
  await writeFile(HEALTH_FILE, JSON.stringify({
    checkedAt: new Date().toISOString(),
    latestDataset: latestName,
    dailyFeatured,
    dailyNewQuota: DEFAULT_DAILY_NEW_QUOTA,
    discovered: report.discovered,
    canonical: report.canonical,
    netNewCorpus: report.acceptedNew,
    duplicatesOrExisting: report.duplicates,
    rejected: report.rejected,
    before: report.before,
    after: report.after,
    added: report.added,
    audit: report.audit,
  }, null, 2), 'utf8');

  console.log('✅ Unique corpus growth complete');
  console.log(`   dataset: ${latestName}`);
  console.log(`   daily featured: ${dailyFeatured}`);
  console.log(`   discovered across periods: ${report.discovered}`);
  console.log(`   canonical across periods: ${report.canonical}`);
  console.log(`   net-new corpus: ${report.acceptedNew}/${DEFAULT_DAILY_NEW_QUOTA}`);
  console.log(`   duplicates/existing: ${report.duplicates}`);
  console.log(`   rejected: ${report.rejected}`);
  console.log(`   corpus: ${report.before} -> ${report.after} (+${report.added})`);
}

main().catch((error) => {
  console.error('❌ corpus update failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
