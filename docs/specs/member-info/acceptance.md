# Member information acceptance

- Optional clan selection routes both roster and individual views through validated config.
- `He`Cans13+TNG` and Unicode/space nicknames are preserved internally and safely escaped for Discord.
- Encoded padding is decoded once; plus signs never become spaces and identifiers are never guessed.
- Exact matches win, ambiguous folded matches request exact capitalization, missing members do not trigger detail calls.
- Supplied illustrative detail fixture normalizes all four counters and retains the roster's rank icon, regardless of JSON Rank.
- Partial malformed detail fields are N/A; entirely invalid payloads produce clear errors.
- 200 generated members paginate within Discord embed limits; requesting user alone can navigate; boundary and expired buttons disable.
- Roster ordering uses validated rank asset numbers descending numerically (100 before 10 before 9), retains website order for ties, and puts missing/untrusted ranks last. The source roster remains unchanged. Ordering persists across pages and expiry even when emojis are unavailable.
- Roster rows place each actual rank emoji before the escaped bold nickname, with no numeric icon label or technical footer. Page changes and expiry retain the icons without additional preparation.
- Existing application emojis are reused, duplicate/concurrent requests upload each original icon once, and failed uploads remain retryable. Missing/untrusted assets never trigger external requests. Link fallbacks remain within the embed limit for 20 long nicknames.
- Incomplete/empty-unconfirmed rosters raise explicit errors. Confirmed zero-member clans show an empty roster.
- All automated tests remain offline. The corrected public page confirms the complete roster and extracted member identifiers. Real detail responses and end-to-end Discord command acceptance remain pending.
