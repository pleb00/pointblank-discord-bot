# Clan information acceptance

- Default and selected enabled clans resolve; missing/disabled clans produce clear errors.
- Fixture values parse exactly, relative images become official URLs, rank progress is 24.5%, and label/footer text is excluded.
- Verified Total Stat values parse correctly; season/unrelated numbers never substitute for them. Unknown/malformed fields remain N/A, and displayed rates are preserved when outcome totals differ.
- The original logo is the first component and the clan name uses the largest heading. The rank name/badge sits below clan details and directly above Rank progress. A bounded progress bar and exact percentage share the progress line; unknown progress remains N/A. Match counts and supplied rates are shown together; the source/timestamp footer uses smaller text.
- Component responses set IsComponentsV2 without legacy content/embeds, stay below the combined text limit and disable mentions. Logo/rank failures preserve readable text; deferred errors remain compatible with the component response format.
- Login/CAPTCHA and changed required markup fail clearly.
- Concurrent snapshots and identical marks share work; TTL expiration refreshes data subject to the request budget.
- Default request spacing is zero; consecutive/concurrent fresh requests are permitted. Explicit optional spacing and actual HTTP 429 / Retry-After pauses remain effective.
- Local Chromium test captures the correct 64-CSS-pixel layered mark at 2x scale, rejects ambiguity/broken images, and releases contexts/browser.
- Logo failure preserves the data embed; token/query/identifier details are excluded from error logs.
- The corrected public link confirms profile fields, all 91 members, Total Stat values and original layered logo. Command registration succeeded; end-to-end Discord response testing is still pending.
