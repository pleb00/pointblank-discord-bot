# Clan information tasks

- [x] Validate environment and multi-clan JSON at startup.
- [x] Implement official URL construction, timeouts, safe redirects, bounded retries and request budget.
- [x] Remove the blanket one-hour cooldown at the user's request; default optional spacing to zero and retain actual HTTP 429 / Retry-After pauses.
- [x] Parse supplied name/master/count/date/rank selectors with fixture tests.
- [x] Diagnose the incomplete original identifier, verify the corrected public link and record robots crawl delay.
- [x] Extract verified Total Stat values and preserve unavailable fields as null/N/A.
- [x] Implement/cache original layered logo capture, browser reuse and cleanup.
- [x] Implement slash command, autocomplete, embeds and safe error handling.
- [x] Put the original clan logo first, enlarge the clan-name heading, move the rank above its inline progress bar and group profile/results using Components V2.
- [x] Show the original clan rank badge as an inline application emoji before the website rank name; verify reuse, member/clan name separation and readable failure fallback offline.
- [x] Keep component errors compatible, suppress mentions and verify progress bounds/missing values offline.
- [x] Add offline unit and local Chromium rendering tests.
- [x] Verify usable live profile/mark and exact match selectors on the corrected public link.
- [x] Use the site's own match percentages without inventing outcome definitions.
- [ ] Smoke test in Discord using supplied deployment credentials.
