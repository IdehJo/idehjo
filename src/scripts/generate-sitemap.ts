import { writeFile } from "node:fs/promises";
import {
  buildEligibleAlternativeTargets,
  buildEligibleComparisonPairs,
} from "../lib/comparison-engine";
import { buildDiscoveryTopics } from "../lib/discovery-growth";
import { buildDecisionGuides } from "../lib/decision-guides";
import { loadCorpusProducts } from "../lib/corpus";
import { SITE_URL } from "../lib/seo-geo";

async function main() {
  const products = await loadCorpusProducts();

  const discoveryTopics = buildDiscoveryTopics(products);
  const guides = buildDecisionGuides(products);
  const alternatives = buildEligibleAlternativeTargets(products);
  const comparisons = buildEligibleComparisonPairs(products);

  const urls = [
    SITE_URL,
    `${SITE_URL}/products`,
    `${SITE_URL}/categories`,
    `${SITE_URL}/discover`,
    `${SITE_URL}/guides`,
    ...discoveryTopics.map((x) => `${SITE_URL}/discover/${x.slug}`),
    ...guides.map((x) => `${SITE_URL}/guides/${x.slug}`),
    ...alternatives.map((x) => `${SITE_URL}/alternatives/${encodeURIComponent(x.slug)}`),
    ...comparisons.map((x) => `${SITE_URL}/compare/${x.slug}`),
    ...products.map((x) => `${SITE_URL}/product/${encodeURIComponent(x.slug)}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `
  <url>
    <loc>${url}</loc>
  </url>`).join("")}
</urlset>`;

  await writeFile("public/sitemap.xml", xml.trim(), "utf8");

  console.log(`Generated sitemap.xml with ${urls.length} URLs`);
}

main();
