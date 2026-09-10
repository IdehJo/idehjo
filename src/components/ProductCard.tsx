import { ArrowLeft, Flame } from 'lucide-react';
import Link from 'next/link';
import { LikeButton } from './LikeButton';
import type { Product } from '@/types';

const RANK_STYLES: Record<number, string> = {
  1: 'from-amber-400 to-yellow-500',
  2: 'from-slate-300 to-slate-400',
  3: 'from-orange-400 to-amber-600',
};

export function ProductCard({ product }: { product: Product }) {
  const slug = product.slug || '';
  const rankStyle = RANK_STYLES[product.rank] ?? 'from-[#ff6154] to-pink-500';
  const tags = product.category
    .split('•')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 4);

  const faSummary = product.faDescription ?? product.faTagline ?? '';
  const faShort = faSummary.length > 155 ? faSummary.slice(0, 155) + '…' : faSummary;

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#ff6154]/30 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {product.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbnail}
              alt={product.name}
              className="h-14 w-14 shrink-0 rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-gray-700 sm:h-16 sm:w-16"
            />
          ) : (
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${rankStyle} text-lg font-black text-white shadow-sm sm:h-16 sm:w-16`}
            >
              {product.rank}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="truncate text-lg font-black text-gray-950 transition group-hover:text-[#ff6154] dark:text-white sm:text-xl"
                  dir="ltr"
                >
                  {product.name}
                </h2>
                <p
                  className="mt-1 line-clamp-2 text-xs leading-6 text-gray-500 dark:text-gray-400 sm:text-sm"
                  dir="ltr"
                >
                  {product.tagline}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-[#ff6154] dark:bg-orange-950/40">
                <Flame size={14} />
                {product.votes.toLocaleString('fa-IR')}
              </span>
            </div>

            {faShort && (
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-700 dark:text-gray-200">
                {faShort}
              </p>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((c) => (
              <Link
                key={c}
                href={`/tag/${encodeURIComponent(c)}`}
                className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:border-[#ff6154]/30 hover:bg-[#ff6154]/10 hover:text-[#ff6154] dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-200"
                dir="ltr"
              >
                #{c}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {slug && <LikeButton slug={slug} />}
            <span className="text-[11px] font-bold text-gray-400">
              رتبه {product.rank.toLocaleString('fa-IR')}
            </span>
          </div>

          {slug ? (
            <Link
              href={`/product/${slug}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff6154] dark:bg-white dark:text-gray-950 dark:hover:bg-[#ff6154] dark:hover:text-white sm:text-sm"
            >
              مشاهده جزئیات
              <ArrowLeft size={15} />
            </Link>
          ) : (
            <span className="text-xs text-gray-400">جزئیات به‌زودی</span>
          )}
        </div>
      </div>
    </article>
  );
}