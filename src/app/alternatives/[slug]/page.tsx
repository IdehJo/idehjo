import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EvidenceSummary } from '@/components/EvidenceSummary';
import { TopicalAuthorityLinks } from '@/components/TopicalAuthorityLinks';
import {
  buildEligibleAlternativeTargets,
  normalizeComparisonPair,
  rankAlternatives,
  sharedProductSignals,
} from '@/lib/comparison-engine';
import { loadCorpusProducts } from '@/lib/corpus';
import { aggregateEvidence } from '@/lib/evidence-layer';
import { SITE_NAME, SITE_URL } from '@/lib/seo-geo';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const products = await loadCorpusProducts();
  return buildEligibleAlternativeTargets(products).map((product) => ({ slug: product.slug }));
}

async function resolveAlternatives(slug: string) {
  const products = await loadCorpusProducts();
  const target = products.find((product) => product.slug === slug);
  if (!target) return null;

  const alternatives = rankAlternatives(target, products, 12);
  if (alternatives.length < 3) return null;

  return { target, alternatives, products };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveAlternatives(slug);

  if (!resolved) {
    return { title: 'جایگزین کافی پیدا نشد', robots: { index: false, follow: false } };
  }

  const { target } = resolved;
  const canonical = `${SITE_URL}/alternatives/${encodeURIComponent(target.slug)}`;
  const title = `بهترین جایگزین‌های ${target.name}`;
  const description = `جایگزین‌های داده‌محور ${target.name} در ایده‌جو بر اساس دسته‌بندی و سیگنال‌های مشترک واقعی، با رتبه‌بندی مبتنی بر داده Corpus.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', locale: 'fa_IR', url: canonical, siteName: SITE_NAME, title, description },
    robots: { index: true, follow: true },
  };
}

export default async function AlternativesPage({ params }: Props) {
  const { slug } = await params;
  const resolved = await resolveAlternatives(slug);
  if (!resolved) notFound();

  const { target, alternatives, products } = resolved;
  const canonical = `${SITE_URL}/alternatives/${encodeURIComponent(target.slug)}`;
  const visible = alternatives.slice(0, 12);
  const evidenceProducts = [target, ...visible];
  const evidence = aggregateEvidence(evidenceProducts);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: `بهترین جایگزین‌های ${target.name}`,
        inLanguage: 'fa-IR',
        dateModified: evidence.latestDataDate,
        citation: evidence.sourceUrls.length ? evidence.sourceUrls : undefined,
        about: { '@id': `${SITE_URL}/product/${encodeURIComponent(target.slug)}#product` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#alternatives`,
        numberOfItems: visible.length,
        itemListElement: visible.map((product, index) => ({
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
          { '@type': 'ListItem', position: 2, name: target.name, item: `${SITE_URL}/product/${encodeURIComponent(target.slug)}` },
          { '@type': 'ListItem', position: 3, name: 'جایگزین‌ها', item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="text-xs font-black text-[#ff6154]">جایگزین‌های داده‌محور</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
        بهترین جایگزین‌های {target.name}
      </h1>
      <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
        این فهرست از شباهت‌های ثبت‌شده در دسته‌بندی و توضیحات Corpus ساخته می‌شود. ترتیب نتایج بر اساس تعداد سیگنال مشترک، رأی ثبت‌شده و یک tie-break پایدار تعیین می‌شود؛ نه ادعای تبلیغاتی یا داده ساختگی.
      </p>

      <EvidenceSummary products={evidenceProducts} />

      <div className="mt-6 flex flex-wrap gap-3 text-sm font-black">
        <Link href={`/product/${target.slug}`} className="text-[#ff6154] hover:underline">مشاهده تحلیل {target.name}</Link>
        <Link href="/discover" className="text-gray-600 hover:text-[#ff6154] dark:text-gray-300">کشف موضوعی</Link>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => {
          const shared = sharedProductSignals(target, product);
          const pair = normalizeComparisonPair(target.slug, product.slug);

          return (
            <article key={product.slug} className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-black text-gray-950 dark:text-white" dir="ltr">{product.name}</h2>
                <span className="shrink-0 text-xs font-black text-[#ff6154]">{product.votes.toLocaleString('fa-IR')} رأی</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                {product.faDescription || product.faTagline || product.description || product.tagline}
              </p>
              <p className="mt-4 text-xs leading-6 text-gray-500 dark:text-gray-400">
                سیگنال مشترک: {shared.join('، ')}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs font-black">
                <Link href={`/product/${product.slug}`} className="text-[#ff6154] hover:underline">تحلیل محصول</Link>
                <Link href={`/compare/${pair.slug}`} className="text-gray-600 hover:text-[#ff6154] dark:text-gray-300">مقایسه مستقیم</Link>
              </div>
            </article>
          );
        })}
      </section>

      <TopicalAuthorityLinks
        products={products}
        nodeId={`product:${target.slug}`}
        currentHref={`/alternatives/${target.slug}`}
        title="موضوع‌ها، راهنماها و مقایسه‌های مرتبط با این محصول"
      />
    </main>
  );
}
