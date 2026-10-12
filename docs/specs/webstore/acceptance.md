# Webstore acceptance

- All four official endpoints return usable public category HTML. Trending's second and final pages validate pagination; New validates a one-page catalogue.
- Observed category fixtures preserve product order, identifiers/links, images, prices, tags, discounts, explicit ratings and pagination. Supplied index preview fixtures remain separately identified. Fixtures and synthetic variations are documented in `tests/fixtures/webstore.provenance.md`.
- Offline parser tests reject access restrictions, changed selectors, repeated/wrong pages and untrusted product URLs. Optional missing/unverified data remains null; explicit zero prices and ratings remain zero. Nested account limits are not mistaken for products.
- Offline mocked HTTP tests verify category URLs, positive page validation, same-origin supported HTTPS redirects, access failures and shared upstream Retry-After pauses.
- Service tests verify category/page cache isolation, concurrent deduplication, TTL refresh and retry after network/parse errors.
- Command tests verify routing, deferred replies, category choices/starting pages, original thumbnails/links, local and remote navigation, click ordering, ownership, final boundaries, single-page behavior, failure recovery, stale controls and expiry during pending requests.
- Presentation tests verify escaped upstream text, disabled mentions, N/A display and Discord size limits.
- Run lint, strict typecheck, the complete offline unit suite and build on Node.js 24 LTS. No renderer changes are required. End-to-end Discord invocation remains separate from live HTTP verification and command registration.
