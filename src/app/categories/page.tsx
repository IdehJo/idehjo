import type { Metadata } from 'next';
import { ArrowLeft, Layers3 } from 'lucide-react';
import Link from 'next/link';
import { CATEGORY_TREE, slugifyMainCategory } from '@/lib/categoryTree';

export const metadata: Metadata = {
  title: 'دسته‌بندی‌ها',
  description:
    'کاوش ایده‌های ترند استارتاپی در ۲۲ دسته اصلی و صدها زیردسته: هوش مصنوعی، ابزار توسعه‌دهندگان، بهره‌وری، طراحی، فین‌تک و بیشتر.',
};

export const dynamic = 'force-dynamic';

export default function CategoriesPage() {
  const totalSubcategories = CATEGORY_TREE.reduce(
    (sum, category) => sum + category.subcategories.length,
    0
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ff6154]/10 px-3 py-1.5 text-xs font-black text-[#ff6154]">
          <Layers3 size={14} />
          دسته‌بندی‌ها
        </span>

        <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
          از حوزه شروع کن، به ایده مناسب برس
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
          {CATEGORY_TREE.length.toLocaleString('fa-IR')} دسته اصلی و{' '}
          {totalSubcategories.toLocaleString('fa-IR')} زیردسته تخصصی برای کاوش ساختاریافته محصولات و فرصت‌ها.
        </p>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_TREE.map((cat) => (
          <Link
            key={cat.name}
            href={`/main-category/${slugifyMainCategory(cat.name)}`}
            className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#ff6154]/30 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${cat.color}`} />

            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-3xl dark:bg-gray-800">
                {cat.icon}
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-gray-950 transition group-hover:text-[#ff6154] dark:text-white">
                  {cat.fa}
                </h2>
                <p
                  className="mt-1 truncate text-[11px] font-bold text-gray-400"
                  dir="ltr"
                >
                  {cat.name}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {cat.subcategories.slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  dir="ltr"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-500">
                {cat.subcategories.length.toLocaleString('fa-IR')} زیردسته
              </span>

              <span className="inline-flex items-center gap-1 text-xs font-black text-[#ff6154]">
                مشاهده حوزه
                <ArrowLeft size={14} />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}