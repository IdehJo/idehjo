import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EvidenceSummary } from '@/components/EvidenceSummary';
import { TopicalAuthorityLinks } from '@/components/TopicalAuthorityLinks';
import { buildDecisionGuides, findDecisionGuide } from '@/lib/decision-guides';
import { aggregateEvidence } from '@/lib/evidence-layer';
import { loadCorpusProducts } from '@/lib/corpus';
import { SITE_NAME, SITE_URL } from '@/lib/seo-geo';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await loadCorpusProducts();
  return buildDecisionGuides(products).map((guide) => ({ slug: guide.slug }));
}

async function resolveGuide(slug: string) {
  const products = await loadCorpusProducts();
  return { guide: findDecisionGuide(products, slug), products };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { guide } = await resolveGuide(slug);

  if (!guide) return { title: 'راهنما پیدا نشد', robots: { index: false, follow: false } };

  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  const title = `بهترین ابزارهای ${guide.label}`;
  const description = `راهنمای داده‌محور انتخاب ابزارهای ${guide.label} در ایده‌جو، بر اساس محصولات واقعی Corpus و رتبه‌بندی پایدار مبتنی بر رأی ثبت‌شده.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', locale: 'fa_IR', url: canonical, siteName: SITE_NAME, title, description },
    robots: { index: true, follow: true },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const { guide, products } = await resolveGuide(slug);
  if (!guide) notFound();

  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  const visible = guide.products.slice(0, 12);
  const evidence = aggregateEvidence(visible);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: `بهترین ابزارهای ${guide.label}`,
        inLanguage: 'fa-IR',
        dateModified: evidence.latestDataDate,
        citation: evidence.sourceUrls.length ? evidence.sourceUrls : undefined,
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#items`,
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
          { '@type': 'ListItem', position: 2, name: 'راهنماهای انتخاب', item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 3, name: guide.label, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-xs font-black text-[#ff6154]">راهنمای انتخاب داده‌محور</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
        بهترین ابزارهای {guide.label}
      </h1>
      <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
        این راهنما فقط از داده‌های موجود در Corpus ایده‌جو استفاده می‌کند. ترتیب محصولات بر اساس رأی ثبت‌شده و یک tie-break پایدار است؛ قابلیت، قیمت یا ادعایی که در داده موجود نباشد ساخته نمی‌شود.
      </p>

      <EvidenceSummary products={visible} />

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product, index) => (
          <article key={product.slug} className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-black text-[#ff6154]">رتبه {index + 1}</span>
                <h2 className="mt-1 text-lg font-black text-gray-950 dark:text-white" dir="ltr">{product.name}</h2>
              </div>
              <span className="text-xs font-black text-gray-500 dark:text-gray-400">{(product.votes ?? 0).toLocaleString('fa-IR')} رأی</span>
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
              {product.faDescription || product.faTagline || product.description || product.tagline}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs font-black">
              <Link href={`/product/${product.slug}`} className="text-[#ff6154] hover:underline">تحلیل محصول</Link>
              <Link href={`/alternatives/${product.slug}`} className="text-gray-600 hover:text-[#ff6154] dark:text-gray-300">جایگزین‌ها</Link>
            </div>
          </article>
        ))}
      </section>

      <TopicalAuthorityLinks
        products={products}
        nodeId={`guide:${guide.slug}`}
        currentHref={`/guides/${guide.slug}`}
        title="موضوع‌ها و مسیرهای مرتبط با این راهنما"
      />
    </main>
  );
}
