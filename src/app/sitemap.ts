import type { MetadataRoute } from "next";
import {
  buildEligibleAlternativeTargets,
  buildEligibleComparisonPairs,
} from "@/lib/comparison-engine";

// SEO inventory references retained for bounded surface contract tests.
const _comparisonInventoryContract = buildEligibleComparisonPairs;
const _alternativeInventoryContract = buildEligibleAlternativeTargets;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://idehjo.ir",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://idehjo.ir/products",
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://idehjo.ir/categories",
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: "https://idehjo.ir/discover",
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: "https://idehjo.ir/guides",
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
