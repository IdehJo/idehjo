import Link from 'next/link';
import { analyzeCrawlIndexQuality } from '@/lib/crawl-index-quality';
import {
  buildEligibleAlternativeTargets,
  buildEligibleComparisonPairs,
} from '@/lib/comparison-engine';
import { loadCorpusProducts } from '@/lib/corpus';
import { buildDecisionGuides } from '@/lib/decision-guides';
import { buildDiscoveryTopics } from '@/lib/discovery-growth';
import { extractSlug } from '@/lib/slug';
import { loadLatest } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function percent(value: number) {
  return `${Math.round(value * 100)}٪`;
}

export default async function CrawlIndexQualityPage() {
  const [products, data] = await Promise.all([loadCorpusProducts(), loadLatest()]);
  const sitemapPaths: string[] = [];

  for (const topic of buildDiscoveryTopics(products)) sitemapPaths.push(`/discover/${topic.slug}`);
  for (const guide of buildDecisionGuides(products)) sitemapPaths.push(`/guides/${guide.slug}`);
  for (const target of buildEligibleAlternativeTargets(products)) {
    sitemapPaths.push(`/alternatives/${encodeURIComponent(target.slug)}`);
  }
  for (const pair of buildEligibleComparisonPairs(products)) sitemapPaths.push(`/compare/${pair.slug}`);

  if (data) {
    const slugs = new Set<string>();
    for (const key of ['today', 'yesterday', 'week', 'month', 'year'] as const) {
      for (const product of data.periods[key] ?? []) {
        const slug = product.slug || extractSlug(product.url);
        if (slug) slugs.add(slug);
      }
    }
    for (const slug of slugs) sitemapPaths.push(`/product/${encodeURIComponent(slug)}`);
  }

  const report = analyzeCrawlIndexQuality(products, sitemapPaths);

  return (
    <main dir="rtl" className="mx-auto max-w-7xl px-5 py-8 md:py-12">
      <header className="rounded-[2rem] border border-black/10 bg-black p-7 text-white md:p-10">
        <p className="text-xs font-bold tracking-[0.18em] text-white/55">SEO + GEO INDEX CONTROL</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">کیفیت Crawl و Index</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-white/65 md:text-base">
          تطبیق Surfaceهای واجدشرایط با Sitemap، گراف لینک داخلی و تاریخ واقعی داده. این گزارش هیچ رتبه، تقاضا یا Search Volume ساختگی تولید نمی‌کند.
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Surface واجدشرایط', report.totalIndexable.toLocaleString('fa-IR')],
          ['URL موجود در Sitemap', report.sitemapCount.toLocaleString('fa-IR')],
          ['پوشش Sitemap', percent(report.sitemapCoverageRatio)],
          ['Orphan indexable', report.orphanIndexablePaths.length.toLocaleString('fa-IR')],
        ].map(([title, value]) => (
          <article key={title} className="rounded-3xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs text-black/45 dark:text-white/45">{title}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <DiagnosticList
          title="واجدشرایط اما خارج از Sitemap"
          description="صفحاتی که eligibility دارند ولی در Sitemap فعلی پیدا نشدند. اضافه‌شدن خودکار انجام نمی‌شود؛ اول باید علت و کیفیت بررسی شود."
          values={report.missingFromSitemap}
        />
        <DiagnosticList
          title="موجود در Sitemap اما خارج از Inventory"
          description="URLهایی که باید از نظر canonical/eligibility بررسی شوند."
          values={report.unexpectedInSitemap}
        />
        <DiagnosticList
          title="Orphanهای قابل Index"
          description="صفحاتی که در Inventory هستند اما Graph معتبر فعلی هیچ رابطه‌ای برایشان ثبت نکرده است."
          values={report.orphanIndexablePaths}
        />
        <DiagnosticList
          title="Freshness نامشخص"
          description="صفحاتی که برایشان تاریخ واقعی معتبر از Corpus قابل استخراج نیست."
          values={report.unknownFreshnessPaths}
        />
      </section>

      <div className="mt-6 flex flex-wrap gap-4 text-sm font-black">
        <Link href="/admin/topical-authority" className="underline underline-offset-4">گراف اعتبار موضوعی</Link>
        <Link href="/admin/intent-coverage" className="underline underline-offset-4">پوشش نیت‌ها</Link>
      </div>
    </main>
  );
}

function DiagnosticList({ title, description, values }: { title: string; description: string; values: string[] }) {
  return (
    <article className="rounded-[2rem] border border-black/10 p-6 dark:border-white/10">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-black/55 dark:text-white/55">{description}</p>
      <div className="mt-5 grid gap-2">
        {values.slice(0, 25).map((value) => (
          <code key={value} dir="ltr" className="rounded-xl bg-black/5 px-3 py-2 text-left text-xs dark:bg-white/10">{value}</code>
        ))}
        {!values.length && <p className="text-sm text-black/55 dark:text-white/55">موردی شناسایی نشد.</p>}
        {values.length > 25 && <p className="text-xs text-black/45 dark:text-white/45">و {(values.length - 25).toLocaleString('fa-IR')} مورد دیگر</p>}
      </div>
    </article>
  );
}
