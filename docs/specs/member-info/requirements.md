# Member information requirements

`/info-member` accepts optional `nick` and configured `clan`. Without nick it presents all members of the default/selected clan, 10–20 per page, total count, rank information and requester-only navigation. Buttons disable at boundaries and expiration; stale interactions get a clear message.

Sort the entire roster by the numeric suffix of each validated original `rank_<number>.png` asset from highest to lowest before pagination. These are the same numbers used in `pb_rank_<number>` emoji names. Equal ranks retain website order; missing or untrusted rank images come last in website order. Sorting must work even when emojis cannot be prepared and must preserve all member identities.

Each roster row places the member's actual website rank image before the bold nickname: `1. [rank icon] **nickname**`. Use application emojis for inline images, reusing existing icons and preparing missing ones automatically. Preserve original icon associations; the example `rank_41.png` does not replace other members' actual ranks. Fall back to an original-image link if emoji preparation fails, and Rank N/A if no image exists.

With nick, use an exact case-sensitive match first, otherwise a unique case-insensitive match. Preserve nickname punctuation, Unicode, spaces and original case. Use only the matched roster's data-env and rank image. Request JSON from `/clan/detail?div=1&env=...`; normalize Exp, Kill, Death and Headshot to numbers and format for display. Invalid/missing counters use N/A, entirely unusable responses fail. JSON Rank is never used as an icon.

Never fabricate members/identifiers or present partial lists as complete. All requests share caches and the same optional request spacing/upstream rate-limit gate. Local spacing defaults to zero, allowing a clan fetch and player-detail fetch in the same invocation. Actual HTTP 429 / Retry-After pauses still apply. The corrected public page confirms a complete 91-member roster; player-detail payload verification remains pending.
