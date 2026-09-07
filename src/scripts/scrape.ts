import { analyzeProduct } from '@/lib/ai-analyzer';
import {
  failScrapeHealth,
  loadScrapeHealth,
  saveScrapeHealth,
  startScrapeHealth,
  succeedScrapeHealth,
} from '@/lib/scrape-health';
import { assertValidPeriods, requireProductHuntToken } from '@/lib/scrape-validation';
import { PERIODS, scrapePeriod } from '@/lib/scraper';
import { saveDaily } from '@/lib/storage';
import { dateInTehran } from '@/lib/tehran-date';
import type { PeriodsData } from '@/types';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const date = args[0] ?? dateInTehran();
const skipAI = process.argv.includes('--no-ai') || (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY);
const replaceCurrent = process.argv.includes('--replace-current');

async function run(): Promise<void> {
  let health = await loadScrapeHealth();
  health = startScrapeHealth(health);
  await saveScrapeHealth(health);

  try {
    const productHuntToken = requireProductHuntToken(process.env.PH_API_TOKEN);

    console.log(`🕷️  ایده‌جو scrape — ${date}`);
    if (skipAI) console.log('⏭️  Skipping AI');
    if (replaceCurrent) console.log('♻️  Replacing current daily snapshot after validation');

    const periods = {} as PeriodsData;

    for (const { key, en } of PERIODS) {
      console.log(`\n=== 📅 ${en} ===`);
      const products = await scrapePeriod(productHuntToken, key, date);
      console.log(`   🏆 Top ${products.length}:`);
      for (const p of products) console.log(`      ${p.rank}. ${p.name} — ${p.votes} votes`);

      if (!skipAI && key === 'today') {
        for (const p of products) {
          if (p.aiReview) { console.log(`      ⏭️  ${p.name} (already analyzed)`); continue; }
          console.log(`      🤖 AI: ${p.name}`);
          try {
            const ai = await analyzeProduct(p);
            p.faDescription = ai.faDescription;
            p.faComments = ai.faComments;
            p.iranEquivalent = ai.iranEquivalent;
            p.aiReview = ai.aiReview;
          } catch (e: any) {
            console.warn(`      ⚠️  AI failed: ${e.message}`);
          }
          await new Promise((r) => setTimeout(r, 6000));
        }
      }

      periods[key] = products;
    }

    assertValidPeriods(periods);
    await saveDaily(date, periods, { replaceCurrent });

    health = succeedScrapeHealth(health);
    await saveScrapeHealth(health);
    console.log('\n🎉 Done!');
  } catch (error) {
    health = failScrapeHealth(health, error);
    await saveScrapeHealth(health);
    throw error;
  }
}

await run();
