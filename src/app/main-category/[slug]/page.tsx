import type { Metadata } from 'next';
import { ArrowRight, Flame, Layers, Trophy } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CATEGORY_TREE, MAIN_TOPICS, slugifyMainCategory } from '@/lib/categoryTree';
import { slugifyCategory } from '@/lib/categories';
import { loadLatest } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = CATEGORY_TREE.find((c) => slugifyMainCategory(c.name) === slug);
  return { title: `${cat?.fa ?? 'دسته‌بندی'} | ایده‌جو`, description: `داغ‌ترین ایده‌های ترند جهانی در حوزه ${cat?.fa ?? ''} به همراه ترجمه فارسی و تحلیل مشابه ایرانی` };
}

export default async function MainCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORY_TREE.find((c) => slugifyMainCategory(c.name) === slug);

  if (!cat) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500 dark:text-gray-400">
        <p className="text-xl font-bold">😕 دسته‌بندی پیدا نشد!</p>
        <Link href="/categories" className="mt-4 inline-block text-[#ff6154] hover:underline">بازگشت به دسته‌بندی‌ها</Link>
      </main>
    );
  }

  const data = await loadLatest();
  const all: any[] = data
    ? [...(data.periods.today ?? []), ...(data.periods.yesterday ?? []), ...(data.periods.week ?? []), ...(data.periods.month ?? []), ...(data.periods.year ?? [])]
    : [];

  const topicsSet = new Set((MAIN_TOPICS[cat.name] ?? []).map((t) => t.toLowerCase()));
  const matching = all.filter((p) => p.category.split('•').some((s: string) => topicsSet.has(s.trim().toLowerCase())));
  const hot = [...matching].sort((a, b) => b.votes - a.votes).slice(0, 6);
  const totalVotes = matching.reduce((s, p) => s + (p.votes ?? 0), 0);

  const subs = (MAIN_TOPICS[cat.name] ?? [])
    .map((t) => ({
      name: t,
      slug: slugifyCategory(t),
      count: all.filter((p) => p.category.split('•').map((s: string) => s.trim().toLowerCase()).includes(t.toLowerCase())).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <Link href="/categories" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-600 transition hover:border-[#ff6154]/40 hover:text-[#ff6154] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <ArrowRight size={16} /> بازگشت به دسته‌بندی‌ها
      </Link>

      {/* Hero */}
      <div className={`relative mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-bl ${cat.color} p-6 text-white shadow-sm sm:p-9`}>
        <div className="absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-4xl backdrop-blur">{cat.icon}</span>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{cat.fa}</h1>
            <p className="mt-1 text-sm font-bold text-white/80" dir="ltr">{cat.name}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white/20 px-3 py-1.5 backdrop-blur">{matching.length.toLocaleString('fa-IR')} ایده فعال</span>
              <span className="rounded-full bg-white/20 px-3 py-1.5 backdrop-blur">{subs.length.toLocaleString('fa-IR')} زیردسته</span>
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur"><Flame size={12} /> {totalVotes.toLocaleString('fa-IR')} رأی</span>
            </div>
          </div>
        </div>
      </div>

      {/* زیردسته‌ها */}
      {subs.length > 0 && (
        <>
          <h2 className="mt-10 flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
            <Layers size={18} className="text-[#ff6154]" /> زیردسته‌ها
          </h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((s) => (
              <Link key={s.slug} href={`/category/${s.slug}`} className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ff6154]/40 hover:text-[#ff6154] hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                {s.name}
                <span className="rounded-full bg-[#ff6154]/10 px-2 py-0.5 text-[10px] font-black text-[#ff6154]">{s.count.toLocaleString('fa-IR')}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* داغ‌ترین‌ها */}
      {hot.length > 0 && (
        <>
          <h2 className="mt-12 flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
            <Trophy size={18} className="text-amber-500" /> داغ‌ترین ایده‌های این دسته
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {hot.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}

      {hot.length === 0 && (
        <div className="mt-10 rounded-[1.75rem] border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <p className="text-lg font-bold">🔍 هنوز ایده‌ای در این دسته ثبت نشده</p>
          <p className="mt-2 text-sm">با اسکرپ روزانه، این دسته به‌زودی پر میشه!</p>
        </div>
      )}
    </main>
  );
}
