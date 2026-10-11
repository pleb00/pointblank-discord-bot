# Project instructions

Use Node.js 24 LTS, npm, strict TypeScript with ESM and `.js` import suffixes.
Keep commands/presentation, services, HTTP integration, parsing, and rendering separate.
Use Axios/Cheerio for data; Playwright only for image rendering. No database is needed.

Read `docs/architecture/overview.md` and the relevant feature specs before changes.
Clan identifiers belong in `config/clans.json`; preserve identifiers and nicknames exactly.
Decode percent-encoded member identifiers once at the HTTP boundary, then use URLSearchParams.
Never guess member IDs, match selectors, stats, rank names, or rank icons from JSON Rank.
Unverified/missing numeric data is null internally and N/A in presentation.
Fail clearly on login/CAPTCHA responses and changed required selectors; never bypass access controls.
Honor upstream HTTP 429 and Retry-After responses. Keep local request spacing optional and disabled by default, as requested by the user. Share the request budget with logo page navigation.
Do not log tokens, member IDs, URLs with queries, Axios errors, or raw upstream payloads.

Keep specs and README accurate. Fixtures must state whether supplied or observed.
Tests must be offline by default. Browser tests use a local server, never the live website.
For behavior changes run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
Run `npm run test:browser` for renderer changes (install Chromium first).
Do not claim successful live verification unless a request actually returned usable data.
Never commit `.env`, node_modules, downloaded runtimes, screenshots, or research captures.
