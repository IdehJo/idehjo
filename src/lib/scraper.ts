import * as cheerio from 'cheerio';
import type { PeriodKey, PHComment, Product } from '@/types';
import { translateCategories } from '@/lib/translate';
import { startOfProductHuntDayUtc } from '@/lib/tehran-date';

export const TOP_COUNT = 10;
const API_URL = 'https://api.producthunt.com/v2/api/graphql';
const ATOM_URL = 'https://www.producthunt.com/feed';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/atom+xml, application/xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const PERIODS: Array<{ key: PeriodKey; en: string; fa: string }> = [
  { key: 'today', en: 'Today', fa: 'امروز' },
  { key: 'yesterday', en: 'Yesterday', fa: 'دیروز' },
  { key: 'week', en: 'Last Week', fa: 'هفته گذشته' },
  { key: 'month', en: 'Last Month', fa: 'ماه گذشته' },
  { key: 'year', en: 'Last Year', fa: 'یک سال گذشته' },
];

function iso(d: Date): string { return d.toISOString(); }
function periodBounds(key: PeriodKey): { after: string; before: string } {
  const now = new Date();
  switch (key) {
    case 'today': return { after: iso(startOfProductHuntDayUtc(now, 0)), before: iso(now) };
    case 'yesterday': return { after: iso(startOfProductHuntDayUtc(now, 1)), before: iso(startOfProductHuntDayUtc(now, 0)) };
    case 'week': return { after: iso(new Date(now.getTime() - 7 * 864e5)), before: iso(now) };
    case 'month': return { after: iso(new Date(now.getTime() - 30 * 864e5)), before: iso(now) };
    case 'year': return { after: iso(new Date(now.getTime() - 365 * 864e5)), before: iso(now) };
  }
}
function stripHtml(html: string): string { return cheerio.load(html).text().replace(/\s+/g, ' ').trim(); }
function isSpamComment(text: string): boolean {
  return [
    /https?:\/\/(?!www\.producthunt\.com)[^\s]+\.(xyz|top|click|ru|cn|tk)/i,
    /click here|check out|visit now/i,
  ].some((p) => p.test(text));
}
function extractSlug(url: string): string | null {
  const match = url.match(/\/(?:products|posts)\/([^/?#]+)/);
  return match ? match[1] : null;
}

const postFields = `
  name tagline description votesCount website url slug featuredAt
  thumbnail { url }
  media { url }
  topics(first: 5) { edges { node { name } } }
  makers { name headline }
`;

const listQuery = (after: string, before: string) => `
query {
  posts(first: 50, order: VOTES, postedAfter: "${after}", postedBefore: "${before}") {
    edges { node { ${postFields} } }
  }
}`;

const slugQuery = (slug: string) => `
query {
  post(slug: "${slug}") {
    ${postFields}
    comments(first: 8) { edges { node { body user { name username } } } }
  }
}`;

async function gql(token: string, query: string): Promise<any> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'IdehJo/3.0 (+https://idehjo.ir)',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const json = (await res.json()) as any;
  if (json.errors) throw new Error(`GraphQL: ${json.errors[0]?.message}`);
  return json.data;
}

async function getRealWebsiteUrl(redirectUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(redirectUrl, { redirect: 'follow', headers: COMMON_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    return res.url.includes('producthunt.com') ? redirectUrl : res.url;
  } catch { return redirectUrl; }
}

function productFromNode(node: any, key: PeriodKey, index: number, fallback?: Partial<Product>): Product {
  const slug = node?.slug ?? extractSlug(node?.url ?? '') ?? fallback?.slug ?? '';
  const categoryEn = (node?.topics?.edges ?? []).map((t: any) => t.node?.name).filter(Boolean).join(' • ') || fallback?.category || 'General';
  const screenshots = (node?.media ?? []).map((m: any) => m.url).filter(Boolean).filter((u: string) => !u.endsWith('.mp4'));

  return {
    id: fallback?.id ?? `ph-${key}-${index + 1}`,
    date: (node?.featuredAt ?? fallback?.featuredAt ?? fallback?.date ?? '').slice(0, 10),
    rank: index + 1,
    name: node?.name ?? fallback?.name ?? slug,
    slug,
    tagline: node?.tagline ?? fallback?.tagline ?? '',
    description: node?.description ?? fallback?.description ?? node?.tagline ?? '',
    category: categoryEn,
    categoryFa: translateCategories(categoryEn),
    url: node?.url ?? fallback?.url ?? 'https://www.producthunt.com',
    thumbnail: node?.thumbnail?.url ?? fallback?.thumbnail,
    screenshots: screenshots.length ? screenshots : fallback?.screenshots,
    maker: node?.makers?.[0]?.name ?? fallback?.maker ?? '',
    makerTitle: node?.makers?.[0]?.headline ?? fallback?.makerTitle ?? '',
    featuredAt: node?.featuredAt ?? fallback?.featuredAt ?? '',
    votes: Number(node?.votesCount ?? fallback?.votes ?? 0),
    websiteUrl: node?.website ?? fallback?.websiteUrl ?? '',
    comments: fallback?.comments ?? [],
  };
}

async function fetchPeriodList(token: string, key: PeriodKey): Promise<Product[]> {
  const { after, before } = periodBounds(key);
  const data = await gql(token, listQuery(after, before));
  const nodes: any[] = data?.posts?.edges?.map((e: any) => e.node).filter(Boolean) ?? [];
  const seen = new Set<string>();
  const pool = nodes
    .filter((n) => {
      const slug = n?.slug ?? extractSlug(n?.url ?? '');
      if (!n?.featuredAt || !n?.name || !slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
    .slice(0, TOP_COUNT);
  return pool.map((n, i) => productFromNode(n, key, i));
}

async function enrichWithDetails(token: string, products: Product[]): Promise<void> {
  for (const p of products) {
    try {
      if (!p.slug) continue;
      const data = await gql(token, slugQuery(p.slug));
      const post = data?.post;
      if (!post) continue;
      p.votes = Math.max(p.votes ?? 0, Number(post.votesCount ?? 0));

      let websiteUrl = post.website ?? p.websiteUrl;
      if (websiteUrl?.includes('producthunt.com/r/')) {
        const real = await getRealWebsiteUrl(websiteUrl);
        if (!real.includes('producthunt.com')) websiteUrl = real;
      }
      p.websiteUrl = websiteUrl ?? '';

      if (post.description && post.description.length > (p.description?.length ?? 0)) {
        p.longDescription = post.description;
      }

      p.comments = (post.comments?.edges ?? [])
        .map((c: any) => ({
          user: c.node?.user?.name || c.node?.user?.username || 'Hunter',
          text: stripHtml(c.node?.body ?? ''),
        }))
        .filter((c: PHComment) => c.text.length > 10 && !isSpamComment(c.text)) as PHComment[];
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function fetchViaAtom(date: string): Promise<Product[]> {
  console.log('   📡 Atom feed discovery...');
  const res = await fetch(ATOM_URL, { headers: COMMON_HEADERS });
  if (!res.ok) throw new Error(`Atom feed HTTP ${res.status}`);
  const $ = cheerio.load(await res.text(), { xmlMode: true });
  const products: Product[] = [];

  $('entry').each((_, el) => {
    if (products.length >= TOP_COUNT) return false;
    const $el = $(el);
    const content = $el.find('content').text().trim();
    const tagline = cheerio.load(content)('p').first().text().trim();
    const url = $el.find('link[href]').first().attr('href') ?? '';
    const slug = extractSlug(url);
    if (!slug) return;

    products.push({
      id: `ph-today-atom-${products.length + 1}`,
      date,
      rank: products.length + 1,
      name: $el.find('title').text().trim(),
      slug,
      tagline: tagline || $el.find('title').text().trim(),
      description: stripHtml(content),
      category: 'General',
      categoryFa: 'عمومی',
      url,
      votes: 0,
      websiteUrl: '',
      comments: [],
    });
  });
  return products;
}

export function mergeVoteAwareProducts(apiProducts: Product[], recoveredProducts: Product[]): Product[] {
  const merged = new Map<string, Product>();
  for (const product of [...apiProducts, ...recoveredProducts]) {
    if (!product?.slug || (product.votes ?? 0) <= 0) continue;
    const existing = merged.get(product.slug);
    if (!existing || (product.votes ?? 0) > (existing.votes ?? 0)) merged.set(product.slug, product);
  }
  return [...merged.values()]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, TOP_COUNT)
    .map((product, index) => ({ ...product, id: `ph-today-${index + 1}`, rank: index + 1 }));
}

async function recoverAtomWithRealVotes(token: string, atomProducts: Product[]): Promise<Product[]> {
  const recovered: Product[] = [];
  for (const atomProduct of atomProducts) {
    try {
      const data = await gql(token, slugQuery(atomProduct.slug));
      const post = data?.post;
      const votes = Number(post?.votesCount ?? 0);
      if (!post || votes <= 0) {
        console.log(`      ⏭️  ${atomProduct.name}: no trusted vote count yet`);
        continue;
      }
      const product = productFromNode(post, 'today', recovered.length, atomProduct);
      product.votes = votes;
      product.comments = (post.comments?.edges ?? [])
        .map((c: any) => ({
          user: c.node?.user?.name || c.node?.user?.username || 'Hunter',
          text: stripHtml(c.node?.body ?? ''),
        }))
        .filter((c: PHComment) => c.text.length > 10 && !isSpamComment(c.text)) as PHComment[];
      recovered.push(product);
      console.log(`      ✅ ${product.name}: recovered ${product.votes} real votes`);
    } catch (error) {
      console.warn(`      ⚠️  ${atomProduct.name}: vote recovery failed (${error})`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return recovered;
}

async function recoverToday(token: string, date: string, apiProducts: Product[]): Promise<Product[]> {
  const atomProducts = await fetchViaAtom(date);
  const recovered = await recoverAtomWithRealVotes(token, atomProducts);
  const merged = mergeVoteAwareProducts(apiProducts, recovered);
  if (merged.length) {
    console.log(`   🛟 Vote-aware today recovery produced ${merged.length} trusted products`);
    await enrichWithDetails(token, merged);
  }
  return merged;
}

export async function scrapePeriod(token: string | undefined, key: PeriodKey, date: string): Promise<Product[]> {
  if (!token) {
    if (key === 'today') return fetchViaAtom(date);
    return [];
  }

  try {
    const products = await fetchPeriodList(token, key);
    console.log(`   ✅ Got ${products.length} featured products`);

    if (key === 'today') {
      const trustedVoteCount = products.filter((product) => (product.votes ?? 0) > 0).length;
      const needsRecovery = products.length < 3 || trustedVoteCount === 0;

      if (needsRecovery) {
        console.log(
          `   🛟 Today requires vote-aware recovery: ${products.length} products, ${trustedVoteCount} with trusted votes`,
        );
        return recoverToday(token, date, products);
      }
    }

    await enrichWithDetails(token, products);

    if (key === 'today' && !products.some((product) => (product.votes ?? 0) > 0)) {
      console.log('   🛟 Today still has no trusted votes after detail enrichment; attempting recovery');
      return recoverToday(token, date, products);
    }

    return products;
  } catch (error) {
    console.warn(`   ⚠️  Period ${key} failed (${error})`);
    if (key === 'today') return recoverToday(token, date, []);
    return [];
  }
}
