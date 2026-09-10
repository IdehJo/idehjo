import { Archive, MessageCircle, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { loadCorpus } from '@/lib/corpus';

export const dynamic = 'force-dynamic';

export default async function ProductsArchivePage() {
  const corpus = await loadCorpus();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ff6154]/10 px-3 py-1.5 text-xs font-black text-[#ff6154]">
              <Archive size={14} />
              آرشیو محصولات
            </span>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
              همه ایده‌ها، یک‌جا و قابل مقایسه
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
              آرشیو کامل ایده‌جو شامل محصولات واقعی، توضیح فارسی، کامنت‌های واقعی و تحلیل هوشمند برای کشف سریع‌تر فرصت‌ها.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white transition hover:bg-[#ff6154] dark:bg-white dark:text-gray-950"
            >
              <Search size={16} />
              جستجو در آرشیو
            </Link>

            <Link
              href="/categories"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:border-[#ff6154]/40 hover:text-[#ff6154] dark:border-gray-700 dark:text-gray-200"
            >
              مشاهده دسته‌بندی‌ها
            </Link>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <Archive className="mb-3 text-[#ff6154]" size={18} />
            <div className="text-2xl font-black text-gray-950 dark:text-white">
              {corpus.audit.products.toLocaleString('fa-IR')}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">محصول یکتا</div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <MessageCircle className="mb-3 text-[#ff6154]" size={18} />
            <div className="text-2xl font-black text-gray-950 dark:text-white">
              {corpus.audit.withRealComments.toLocaleString('fa-IR')}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">دارای کامنت واقعی</div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <Sparkles className="mb-3 text-[#ff6154]" size={18} />
            <div className="text-2xl font-black text-gray-950 dark:text-white">
              {corpus.audit.withPersianDescription.toLocaleString('fa-IR')}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">توضیح فارسی</div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <Sparkles className="mb-3 text-[#ff6154]" size={18} />
            <div className="text-2xl font-black text-gray-950 dark:text-white">
              {corpus.audit.withAiReview.toLocaleString('fa-IR')}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">تحلیل هوشمند</div>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-950 dark:text-white sm:text-2xl">
              همه محصولات
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              مرتب‌شده بر اساس آرشیو معتبر ایده‌جو
            </p>
          </div>

          <Link
            href="/"
            className="text-xs font-black text-[#ff6154] hover:underline sm:text-sm"
          >
            صفحه اصلی
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {corpus.products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}