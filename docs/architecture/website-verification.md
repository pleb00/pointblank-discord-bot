# Website verification record

Date: October 11, 2026, Asia/Jakarta. Development host: Windows. Verification used a direct unauthenticated PowerShell Invoke-WebRequest with the exact supplied clan identifier constructed using percent encoding.

## Initial observations with the original identifier

- GET `https://www.pointblank.id/clan/myclan?env=<supplied Hepatica identifier>` succeeded at the HTTP level: **200**, `text/html; charset=UTF-8`, 8,155 characters.
- The body contained the ordinary site shell, a loading container, `alert("Login dibutuhkan.")`, and `document.location.replace('/login/form')`.
- The response contained no usable clan `.info .name`, roster, profile logo or match statistics.
- A separate read of `https://www.pointblank.id/robots.txt` returned **200**, `User-agent: *` and `Crawl-delay: 3600`; login paths are disallowed.
- The web browsing tool could not retrieve the clan URL; direct HTTP provided the above observations.
- No login/CAPTCHA was attempted. No player request was made because no live member identifier was extracted. No further clan page request was made after observing policy/access restrictions.

## Corrected public link

The user's subsequent link added `WnY3` after the `DOFl3` segment of the identifier. An unauthenticated request to that exact corrected URL returned **HTTP 200**, `text/html; charset=UTF-8`, 60,328 characters, with no login notice. The configured identifier has been corrected. The earlier login observation applies to the different, incomplete identifier; it does not establish that valid clan pages require authentication.

Verified profile: clan `Hepatica` (with its leading backtick), master `He`Cans13+TNG`, 91/200 members, created March 19, 2026, Recon Battalion rank and 24.5% progress. The `.clan_section .list.member .over_wrap > ul` container contained all 91 members, while other player links existed elsewhere on the page.

The Total Stat panel is `.clan_section .record .clan_record > .section`, titled `Total Stat`. `.con > .match` provides 28,446 matches after excluding its span label. Each `.graph li > .gr00` column is identified by `.desc .tit` (`win`/`lose`), with `.num` for counts and `.desc .ani_num` for displayed percentages. Observed wins: 26,742; losses: 1,702; rates: 94.0% / 6.0%. Wins plus losses differ from total matches by two. The reason is unverified, so no replacement percentages or outcomes are inferred. Separate season panels are excluded.

The profile `.top .inner` ancestor contains exactly one layered mark, while a popup elsewhere contains another `.logo`. Chromium successfully rendered the profile mark from captured public HTML plus original site CSS/assets into a 212×212 PNG, which was visually inspected. The CSS imports external Google fonts; blocked optional font styles no longer cause a false logo error. No repeated clan-page navigation was needed for rendering.

The player-detail response has not been reverified; only the publicly extracted roster and the page's `/clan/detail` GET integration are confirmed. No login, CAPTCHA bypass or authenticated scraping was used.

## Implementation evidence

Profile selectors, four logo layers, `.logo` classes and roster attributes were supplied as examples and then confirmed on the corrected public page. The roster container, Total Stat selectors and nearest-ancestor logo selection are now verified. Count mismatches continue to detect changed/incomplete rosters. Example player JSON remains fixture-supported without claiming a confirmed live player response.

`tests/fixtures/clan.html` is synthetic and changes the example count to three to match the sample roster. `clan-total-statistics.html` is an observed Total Stat excerpt from the corrected public page. `member-detail.json` reproduces the supplied illustrative payload; no attribution to a real player is asserted. `login.html` is an excerpt observed with the original incomplete identifier. Browser tests use synthetic local SVG layers to test original HTML/CSS layering and element-only PNG capture.

Clan EXP stays null because its source remains unverified. Match statistics use the observed panel and its own displayed rates. `calculateOutcomeRates` is tested independently but is not invoked by the live parser until outcome definitions are established. Do not use player API ClanExpRank or Rank as substitute fields.

## Operational policy

The initial implementation conservatively enforced the observed 3,600-second crawl delay between page/API starts. At the user's subsequent request, that blanket cooldown and minimum validator were removed: local request spacing now defaults to zero and remains optionally configurable. Actual HTTP 429 / Retry-After responses still defer fresh requests through the shared request gate. The historical robots.txt observation above remains unchanged. Associated static assets are loaded for a cached HTML logo render or for missing rank emojis extracted from a parsed roster. Startup does not crawl automatically. No browser request bypasses an inaccessible page. Request gates/caches live in one process and are not coordinated across replicas or restarts.

The corrected clan endpoint was verified publicly accessible. Genuine access restrictions still produce clear errors and are not bypassed. Credentials/cookies and authenticated scraping are outside the requested scope.

## Local validation

Verified using Node.js 24.21.0 and the committed npm lockfile:

- 74 Vitest unit tests passed across nine files, including mocked command ownership/expiry/error behavior.
- Four real Chromium tests passed against a local fixture server. The 128×128 PNG was visually inspected; all four synthetic layers and transparent corners were present.
- ESLint, strict TypeScript checking and production compilation passed.
- Production dependency audit reported zero vulnerabilities.
- Configuration validation and assembly/cleanup of the compiled application passed using placeholder credentials, without connecting to Discord or Point Blank.

At initial implementation, Discord login and slash-command deployment were not attempted because application credentials were not provided. Subsequent public-link and Discord verification is documented separately.

## Subsequent Discord setup verification

During setup troubleshooting on October 11, 2026, the locally configured bot token was verified to belong to the configured application without exposing the token. The configured guild command endpoint initially returned HTTP 403 / Discord code 50001 (Missing access). A later read-only check passed, and both `/info-clan` and `/info-member` were successfully registered in the configured guild.

Deployment now performs token/application and command-endpoint preflight checks. `npm run check:discord` runs the same read-only checks without modifying commands. Known authorization errors retain safe numeric metadata and provide targeted setup instructions. All 82 unit tests, lint, strict type checking and production build passed after these changes. Discord Gateway login has not yet been tested.

After the corrected-link/parser/renderer fixes, all 93 unit tests, five local Chromium tests, lint, type checking and production build passed. Live clan parsing returned 91 members with the verified match statistics, and live CSS/assets produced the visually inspected clan mark. These checks reused the captured page instead of repeatedly retrieving it.

## Logo failure follow-up

The user subsequently supplied a successful Discord Gateway ready log and a `Clan logo failed` log containing only the generic error name. The exact failure could not be identified from that record. Standalone rendering and the application's configured LogoService both succeeded under the user's Node.js 22.11.0 runtime, with an installed Chromium executable; these observations do not establish a missing browser or Node version as the cause.

The four image URLs subsequently supplied by the user match the captured profile's image sources: `clanmark_bg_filled_x2.png`, `clanmark_bg_outline_x2.png`, `clanmark_symbol_filled_x2.png`, and `clanmark_symbol_outline_x2.png`. They are sprite sheets selected and colored by the original CSS and the profile's `cf08 cm10 bp11 tl48` classes. Rendering preserves those assets, classes and styling.

Navigation now waits for DOM content, followed by explicit same-origin stylesheet and logo-layer readiness. A local regression test confirms that a stalled unrelated image does not prevent logo capture. Typed safe diagnostics record the failure stage and reason without exposing raw browser messages or query identifiers. Missing browser, stylesheet and layer failures are covered locally.

After these changes, all 93 unit tests, seven local Chromium tests, lint, strict type checking and production build passed under Node.js 24.21.0. The configured LogoService then rendered a 212×212 PNG under Node.js 22.11.0 using the captured clan HTML and live original CSS/assets. That PNG was visually inspected. No additional clan-page fetch or Discord connection was made by this smoke check. The user's earlier failure remains unreplicated; the added diagnostics support identifying it if it recurs.

The user's next failure log identified `stage: browser` and `reason: BROWSER_NOT_INSTALLED`. This indicates launch failed before logo assets were requested. The existing Playwright 1.64.0 Chromium revision 1248 and headless shell were present in the host's default user cache. Direct launch succeeded in both PowerShell and Git Bash. `npm run install:browser` completed successfully, followed by a successful 212×212 render through the configured application service, Node.js 22.11.0 and tsx from Git Bash, reusing the captured HTML. The environment inherited by the user's already-running process has not been inspected, so its exact path discrepancy remains unconfirmed. Installation and startup should run in the same terminal environment and OS account, followed by a bot restart.

## Inline roster rank icons

At the user's request, roster rows now place each original rank image before the bold nickname. Discord application emojis provide the inline images. The captured 91-member roster contains 14 distinct rank image URLs; all 14 resolved to application emoji markup using the configured application's live emoji API and the original official PNG assets. The first row retained TABRAK`Slytherin's observed rank_46 image association. The supplied rank_41 URL was a formatting example, not evidence of a changed rank. No clan-page or player-detail request was made during this verification, and no Discord message was sent.

All 103 offline unit tests, ESLint, strict TypeScript checking and production compilation passed. Coverage includes original image uploads, application emoji reuse, concurrent deduplication, failure recovery, untrusted asset rejection, bounded link fallbacks, and icon retention across navigation and expiry. Actual Discord client rendering of the updated command still requires invocation by the user.
