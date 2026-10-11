# Member information tasks

- [x] Extract supplied member attributes and original image URLs.
- [x] Verify complete-count invariant, empty list and duplicate handling.
- [x] Implement exact/preferred, case-insensitive and ambiguous lookup.
- [x] Implement encoded member URL construction and cached JSON retrieval.
- [x] Normalize counters and keep JSON Rank separate from rank image.
- [x] Implement selected/default clans and autocomplete.
- [x] Add embeds, pagination ownership, boundaries and expiry handling.
- [x] Replace icon-number labels with original rank images as application emojis before each nickname; cache/reuse uploads and retain icons across navigation and expiry.
- [x] Sort roster by validated rank asset number descending before pagination; preserve ties, place unavailable ranks last, and cover ordering across navigation and expiry offline.
- [x] Add offline parser/service/HTTP/presentation tests.
- [x] Verify the actual roster container and all 91 members on the corrected public link.
- [ ] Verify real extracted identifier and corresponding detail payload.
- [ ] Smoke test commands and navigation in a Discord test server.
