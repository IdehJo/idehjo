import Link from 'next/link';
import type { Product } from '@/types';
import { buildTopicalAuthorityGraph, recommendInternalLinks } from '@/lib/topical-authority-graph';

type TopicalAuthorityLinksProps = {
  products: Product[];
  nodeId: string;
  currentHref?: string;
  title?: string;
  limit?: number;
};

const typeLabels = {
  product: 'محصول مرتبط',
  topic: 'موضوع مرتبط',
  guide: 'راهنمای مرتبط',
  comparison: 'مقایسه مرتبط',
} as const;

export function TopicalAuthorityLinks({
  products,
  nodeId,
  currentHref,
  title = 'مسیرهای مرتبط برای ادامه کشف',
  limit = 6,
}: TopicalAuthorityLinksProps) {
  const graph = buildTopicalAuthorityGraph(products);
  const recommendations = recommendInternalLinks(graph, nodeId, Math.max(limit * 2, 8))
    .filter((node) => node.href !== currentHref)
    .filter((node, index, list) => list.findIndex((candidate) => candidate.href === node.href) === index)
    .slice(0, limit);

  if (!recommendations.length) return null;

  return (
    <section className="mx-auto mt-10 max-w-6xl px-4">
      <div className="rounded-[2rem] border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black text-[#ff6154]">گراف موضوعی ایده‌جو</p>
          <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
            این لینک‌ها از روابط واقعی میان محصول، موضوع، راهنما و مقایسه در Corpus ساخته شده‌اند و بر متریک تبلیغاتی یا محبوبیت ساختگی تکیه ندارند.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((node) => (
            <Link
              key={node.id}
              href={node.href}
              className="rounded-2xl border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:border-[#ff6154]/40 hover:shadow-md dark:border-gray-800"
            >
              <p className="text-[11px] font-black text-[#ff6154]">{typeLabels[node.type]}</p>
              <p className="mt-1 font-black text-gray-950 dark:text-white">{node.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
