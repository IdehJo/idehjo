import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopicalAuthorityLinks } from '@/components/TopicalAuthorityLinks';
import { loadCorpusProducts } from '@/lib/corpus';
import { buildDiscoveryTopics, findDiscoveryTopic } from '@/lib/discovery-growth';
import { SITE_NAME, SITE_URL } from '@/lib/seo-geo';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const products = await loadCorpusProducts();
  return buildDiscoveryTopics(products).map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const products = await loadCorpusProducts();
  const topic = findDiscoveryTopic(products, slug);

  if (!topic) {
    return {
      title: 'موضوع پیدا نشد',
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${SITE_URL}/discover/${topic.slug}`;
  const title = `بهترین ابزارها و ایده‌های ${topic.fa}`;

  return {
    title,
    description: topic.summary,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url: canonical,
      siteName: SITE_NAME,
      title,
      description: topic.summary,
    },
    robots: { index: true, follow: true },
  };
}

export default async function DiscoveryTopicPage({ params }: Props) {
  const { slug } = await params;
  const products = await loadCorpusProducts();
  const topic = findDiscoveryTopic(products, slug);

  if (!topic) notFound();

  const canonical = `${SITE_URL}/discover/${topic.slug}`;
  const visible = topic.products.slice(0, 24);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: `بهترین ابزارها و ایده‌های ${topic.fa}`,
        description: topic.summary,
        inLanguage: 'fa-IR',
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#items`,
        numberOfItems: visible.length,
        itemListElement: visible.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE_URL}/product/${encodeURIComponent(product.slug)}`,
          name: product.name,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'کشف موضوعی', item: `${SITE_URL}/discover` },
          { '@type': 'ListItem', position: 3, name: topic.fa, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-xs font-bold text-gray-500 dark:text-gray-400">
        <Link href="/categories" className="hover:text-[#ff6154]">دسته‌بندی‌ها</Link>
        <span className="mx-2">/</span>
        <span>{topic.fa}</span>
      </nav>

      <section className="mt-5 max-w-3xl">
        <p className="text-xs font-black text-[#ff6154]">راهنمای کشف ایده‌جو</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
          بهترین ابزارها و ایده‌های {topic.fa}
        </h1>
        <p className="mt-5 text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
          {topic.summary}
        </p>
        <p className="mt-3 text-sm leading-8 text-gray-600 dark:text-gray-300">
          این فهرست از داده واقعی آرشیو ایده‌جو ساخته شده و فقط زمانی منتشر می‌شود که حداقل داده کافی برای یک صفحه مستقل و مفید وجود داشته باشد.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#ff6154]">محصولات منتخب</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
              {visible.length.toLocaleString('fa-IR')} محصول با بیشترین سیگنال
            </h2>
          </div>
          <Link href="/categories" className="text-sm font-black text-[#ff6154] hover:underline">
            همه دسته‌بندی‌ها
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <Link
              key={product.slug}
              href={`/product/${product.slug}`}
              className="rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff6154]/40 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="text-base font-black text-gray-950 dark:text-white" dir="ltr">
                {product.name}
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-gray-500 dark:text-gray-400">
                {product.faTagline || product.faDescription || product.tagline}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs font-bold">
                <span className="text-[#ff6154]">{product.votes.toLocaleString('fa-IR')} رأی</span>
                <span className="text-gray-400">مشاهده تحلیل</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <TopicalAuthorityLinks
        products={products}
        nodeId={`topic:${topic.slug}`}
        currentHref={`/discover/${topic.slug}`}
        title="راهنماها، محصولات و مقایسه‌های مرتبط با این موضوع"
      />
    </main>
  );
}
