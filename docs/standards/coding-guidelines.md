# Coding guidelines

- Prefer clear small modules over frameworks, service locators or extra infrastructure.
- Use strict TypeScript, `.js` suffixes on local ESM imports, typed interfaces and null for unavailable data.
- Preserve upstream identity strings; normalize only validated numeric counters. Escape only during Discord presentation.
- Keep raw responses separate from normalized models. Commands never query or parse websites directly.
- Required structural failures are typed errors. Optional unavailable values are explicit N/A; partial detail counters emit safe warnings.
- Validate configuration before network startup. Never commit or log tokens or identifiers, raw Axios errors or response bodies.
- Bound retries, HTTP size/time, caches, render concurrency, Discord embeds and interaction lifetimes.
- Inspect usable official markup before adding selectors; maintain provenance for fixtures. Follow access controls and upstream rate-limit responses; local request spacing is optional and disabled by default.
- Unit and local browser tests are offline. Run lint, typecheck, unit tests and build before delivery; browser tests for rendering changes.
- Update relevant specs and verification notes when behavior changes. Keep deployment registration explicit.
