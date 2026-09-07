import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { EvidenceSummary } from '@/components/EvidenceSummary';
import { TopicalAuthorityLinks } from '@/components/TopicalAuthorityLinks';
import {
  buildEligibleComparisonPairs,
  findComparisonProducts,
  normalizeComparisonPair,
  parseComparisonSlug,
} from '@/lib/comparison-engine';
import { loadCorpusProducts } from '@/lib/corpus';
import { aggregateEvidence } from '@/lib/evidence-layer';
import { SITE_NAME, SITE_URL } from '@/lib/seo-geo';

type Props = {
  params: Promise<{ pair: string }>;
};

export async function generateStaticParams() {
  const products = await loadCorpusProducts();
  return buildEligibleComparisonPairs(products).map((pair) => ({ pair: pair.slug }));
}

async function resolveComparison(pairSlug: string) {
  const parsed = parseComparisonSlug(pairSlug);
  if (!parsed) return null;

  const products = await loadCorpusProducts();
  const comparison = findComparisonProducts(products, parsed.leftSlug, parsed.rightSlug);
  if (!comparison) return null;

  return { comparison, canonicalPair: normalizeComparisonPair(comparison.left.slug, comparison.right.slug), products };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const resolved = await resolveComparison(pair);

  if (!resolved) {
    return { title: 'مقایسه پیدا نشد', robots: { index: false, follow: false } };
  }

  const { comparison, canonicalPair } = resolved;
  const canonical = `${SITE_URL}/compare/${canonicalPair.slug}`;
  const title = `مقایسه ${comparison.left.name} و ${comparison.right.name}`;
  const description = `مقایسه داده‌محور ${comparison.left.name} و ${comparison.right.name} در ایده‌جو بر اساس دسته‌بندی، توضیحات ثبت‌شده، رأی کاربران و سیگنال‌های مشترک واقعی.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', locale: 'fa_IR', url: canonical, siteName: SITE_NAME, title, description },
    robots: { index: true, follow: true },
  };
}

export default async function ComparisonPage({ params }: Props) {
  const { pair } = await params;
  const resolved = await resolveComparison(pair);
  if (!resolved) notFound();

  const { comparison, canonicalPair, products } = resolved;
  if (pair !== canonicalPair.slug) permanentRedirect(`/compare/${canonicalPair.slug}`);

  const canonical = `${SITE_URL}/compare/${canonicalPair.slug}`;
  const evidenceProducts = [comparison.left, comparison.right];
  const evidence = aggregateEvidence(evidenceProducts);
  const rows = [
    ['دسته‌بندی', comparison.left.categoryFa || comparison.left.category, comparison.right.categoryFa || comparison.right.category],
    ['رأی ثبت‌شده', comparison.left.votes.toLocaleString('fa-IR'), comparison.right.votes.toLocaleString('fa-IR')],
    ['سازنده', comparison.left.maker || 'ثبت نشده', comparison.right.maker || 'ثبت نشده'],
    ['تاریخ داده', comparison.left.date || 'ثبت نشده', comparison.right.date || 'ثبت نشده'],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: `مقایسه ${comparison.left.name} و ${comparison.right.name}`,
        inLanguage: 'fa-IR',
        dateModified: evidence.latestDataDate,
        citation: evidence.sourceUrls.length ? evidence.sourceUrls : undefined,
        about: [
          { '@id': `${SITE_URL}/product/${encodeURIComponent(comparison.left.slug)}#product` },
          { '@id': `${SITE_URL}/product/${encodeURIComponent(comparison.right.slug)}#product` },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#products`,
        numberOfItems: 2,
        itemListElement: evidenceProducts.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: `${SITE_URL}/product/${encodeURIComponent(product.slug)}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'کشف موضوعی', item: `${SITE_URL}/discover` },
          { '@type': 'ListItem', position: 3, name: `${comparison.left.name} vs ${comparison.right.name}`, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-xs font-black text-[#ff6154]">مقایسه داده‌محور ایده‌جو</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
        {comparison.left.name} در برابر {comparison.right.name}
      </h1>
      <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
        این مقایسه فقط بر داده‌های موجود در آرشیو ایده‌جو تکیه دارد. قیمت، قابلیت یا ادعایی که در Corpus ثبت نشده باشد به مقایسه اضافه نمی‌شود.
      </p>

      <EvidenceSummary products={evidenceProducts} />

      <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-lg font-black text-gray-950 dark:text-white">چرا این دو محصول قابل مقایسه‌اند؟</h2>
        <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
          سیگنال‌های مشترک ثبت‌شده: {comparison.sharedSignals.join('، ')}
        </p>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-3 bg-gray-50 text-sm font-black dark:bg-gray-900">
          <div className="p-4">معیار</div>
          <div className="p-4" dir="ltr">{comparison.left.name}</div>
          <div className="p-4" dir="ltr">{comparison.right.name}</div>
        </div>
        {rows.map(([label, left, right]) => (
          <div key={label} className="grid grid-cols-3 border-t border-gray-200 text-sm dark:border-gray-800">
            <div className="p-4 font-bold text-gray-700 dark:text-gray-300">{label}</div>
            <div className="p-4 text-gray-600 dark:text-gray-400">{left}</div>
            <div className="p-4 text-gray-600 dark:text-gray-400">{right}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {evidenceProducts.map((product) => (
          <article key={product.slug} className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-xl font-black text-gray-950 dark:text-white" dir="ltr">{product.name}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
              {product.faDescription || product.faTagline || product.description || product.tagline}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-black">
              <Link href={`/product/${product.slug}`} className="text-[#ff6154] hover:underline">تحلیل کامل محصول</Link>
              <Link href={`/alternatives/${product.slug}`} className="text-gray-600 hover:text-[#ff6154] dark:text-gray-300">جایگزین‌ها</Link>
            </div>
          </article>
        ))}
      </section>

      <TopicalAuthorityLinks
        products={products}
        nodeId={`comparison:${canonicalPair.slug}`}
        currentHref={`/compare/${canonicalPair.slug}`}
        title="محصول‌ها و مسیرهای مرتبط با این مقایسه"
      />
    </main>
  );
}
