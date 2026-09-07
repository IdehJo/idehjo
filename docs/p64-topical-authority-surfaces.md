# P64 — Topical Authority Surfaces

P64 wires the P63 topical-authority graph into public IdehJo discovery surfaces.

## Public surfaces

- Product detail: related topics, guides, products and comparisons.
- Discover topic: related guides, products and comparisons.
- Decision guide: related topic/product/comparison paths.
- Comparison: related products and graph-backed discovery paths.
- Alternatives: graph-backed navigation from the target product into related topics, products, guides and comparisons.

## Guardrails

- Recommendations originate only from nodes and typed edges produced by the repository-backed topical-authority graph.
- Current-page self links are removed.
- Duplicate destination URLs are removed before rendering.
- No search volume, CTR, keyword difficulty, synthetic popularity or invented authority metric is introduced.
- Existing canonical metadata and eligibility rules remain unchanged.
- No DB, auth, payment, secrets or production configuration mutation is part of P64.

## Regression coverage

`src/lib/topical-authority-surfaces.test.ts` verifies cross-surface recommendations resolve to graph-backed nodes, remove self links and expose unique destination URLs.
