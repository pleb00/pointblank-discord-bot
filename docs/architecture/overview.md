# Architecture

The application uses ESM and strict TypeScript. Commands own Discord interactions and presentation; services coordinate workflows; the Point Blank client owns HTTP; pure parsers normalize website responses; the renderer owns Chromium. Configuration is validated before Discord login or command registration.

Explicit command deployment also verifies the bot token's application ID and reads the selected command endpoint before overwriting commands. `npm run check:discord` exposes these read-only checks without deployment. Missing access, invalid authentication and application mismatches produce targeted setup messages; no fallback silently changes registration scope. Safe error metadata retains Discord's numeric code and HTTP status without request headers or payloads.

```text
Discord interaction -> command -> clan/member service -> PointBlankClient (Axios)
                              -> embed builders       -> pure Cheerio/Zod parsers
                    -> logo service -> cache -> reusable Playwright browser
JSON + environment -> Zod validation -> clan registry and application context
```

## Source layout

- `src/commands`, `src/events`, `src/embeds`: slash definitions, autocomplete, safe error replies, pagination and Discord size limits.
- `src/config`: required environment and JSON schemas; enabled clan selection.
- `src/clients`: URL construction, response validation, timeout, redirect restrictions, bounded retry and detail cache.
- `src/parsers`, `src/models`: supplied/observed HTML and JSON contracts, null-safe normalized models.
- `src/services`: shared clan snapshots, complete roster checks, exact/ambiguous nickname lookup, logo caching.
- `src/renderers`: serial logo captures, lazy reusable Chromium, short-lived contexts, resource cleanup.
- `src/utils`: TTL deduplication, request budget, formatting, typed errors and safe Pino logging.
- `src/app.ts`: dependency assembly; `src/index.ts`: Discord lifecycle; `src/deploy-commands.ts`: explicit command deployment.

## Workflows

A clan command defers its reply, resolves configuration and gets a cached parsed profile plus raw HTML. The logo service hashes URL/HTML and deduplicates rendering. Chromium loads that exact HTML at its original URL through an intercepted document response and retrieves original same-origin CSS and layered images. A nearest common profile ancestor identifies a single mark using `.info .name` and `.logo`; this selected the actual Hepatica mark despite a second popup logo on the live page. Ambiguity or missing layers produces a visible logo-unavailable note. Blocked external font imports do not invalidate successful same-origin logo styles.

The clan presentation uses a Components V2 Container: the original attached logo first, a large clan-name heading, grouped profile details, an inline rank badge emoji followed by the website rank name, a progress bar underneath, overall results and a small source/timestamp footer. The visual bar approximates the validated percentage while preserving its exact displayed value; unknown progress remains N/A. IsComponentsV2 is added to the completed response, and deferred clan errors use compatible Text Display components. Member commands retain embeds.

A roster uses the same cached HTML and the supplied `a.user[data-env][data-nick]` anchors inside list items. The verified `.clan_section .list.member .over_wrap > ul` container excludes player links in other statistics panels. Minimal supplied fixtures retain a list-item fallback when that container is absent. The live roster contained all 91 reported members. Count mismatches cause an error. Snapshot caching avoids a second clan request. `/info-member {clan}` owns this roster view and accepts only optional configured clan selection, using the default if omitted.

Roster rank images are displayed inline as application emojis before bold nicknames. Before pagination, the command sorts a copy of the roster by validated rank asset number descending; ties retain website order and unavailable ranks come last. This same ordering survives page changes, expiry and emoji failures. RankEmojiService deduplicates each original icon, reuses application-owned `pb_rank_<image number>` member emojis and `pb_clan_rank_<image number>` clan emojis across process restarts, and serializes creation of missing ones. Dedicated clients handle bounded original PNG downloads and Discord's application-emoji API. Only verified official rank asset paths are eligible, with member and clan assets validated separately; no rank comes from player JSON. Resolution happens once per roster command and survives page changes and expiry. Failed setup leaves the roster readable with original-image links or Rank N/A; clan profiles retain the website rank name and original badge link. Raw upstream errors remain excluded from logs.

`/info-player nick:...` accepts only a required nickname and independently searches `/ranking/individual?termtype=3&keyword=...` with the unchanged complete nickname serialized by URLSearchParams. The parser reads only `.nrank_table > .r_tr`: the player identity from `.r_td.name > a[data-env][data-nick]`, game ranking from `.r_td.win`, rank name/icon from `.r_td.rank > .txt` and its `.rank_img img`, and total EXP from `.r_td.exp > .txt`. An explicit `.nodata_n` message distinguishes no matches from changed required markup. Exact case-sensitive matches win; otherwise a unique case-insensitive match among returned rows is accepted. No partial matching is performed. Deployment registers three separate commands: clan profiles, clan member rosters and player searches.

After selecting a player, MemberService retrieves JSON with GET `/clan/detail?div=1&env=...` using only the matched data-env. The HTTP boundary decodes identifiers once and serializes them through URLSearchParams; a raw `+` stays a plus, never a space. The pure detail normalizer combines the HTML game ranking/rank name/icon with JSON Exp, Kill, Death, Headshot, ClanName, ClanTroops and ClanExpRank. It calculates kills/deaths and headshots/kills × 100; missing inputs or zero denominators yield null. JSON Rank does not replace the HTML ranking or rank name/icon.

The player embed uses the nickname as its title and the original rank thumbnail, then two full-width fields: Player Info groups profile, combat and headshot metrics; Clan Info groups name, members and ranking. Integer counters have thousands separators, ratios have two decimal places, and missing values are N/A. Text is escaped and bounded within Discord field limits. The presentation model omits the identifier. Partial counter warnings contain only unavailable field names. Search and detail responses have separate bounded, deduplicated caches using the same TTL and share the request gate with clan retrieval and logo navigation.

## Reliability and resource bounds

Clan/roster snapshots share a TTL. Member raw details and rendered logo buffers have independent TTLs. Identical cache keys share a promise, failures are removed, expired entries are pruned, and caches are bounded (500 data entries, 100 logos). No persistent storage or Redis is required.

HTTP attempts and uncached browser document navigation share a request gate. Local spacing is optional and defaults to zero, so normal requests can run consecutively. Actual upstream HTTP 429 / Retry-After responses still defer fresh requests; an excessive wait fails before spending Discord's reply lifetime. Transient retries are bounded and subject to any explicitly configured spacing or upstream pause. Axios permits only same-origin HTTPS redirects to clan endpoints or the individual ranking endpoint; login/CAPTCHA responses are rejected. Error logs contain endpoint labels/status/codes, never raw Axios errors, query URLs or credentials.

Pagination immediately acknowledges button clicks, serializes edits, limits navigation to the requester, disables boundaries and expires after two minutes by default. Active message IDs prevent the global expired-button handler from competing with collectors. Errors always attempt a resolved reply; expired Discord tokens are logged safely.

The renderer serializes captures to bound browser concurrency, reuses one browser, closes each context in finally, and drains queued captures during shutdown. DOM content and explicit logo-style/layer readiness replace whole-page load waiting, so unrelated stalled images cannot block capture. Safe failure stages/reasons distinguish installation, navigation, styles, image layers and screenshot failures without leaking raw browser messages. Scripts and off-origin requests are blocked. Browser installation is external to the normal npm dependency installation.

## Extension points

Add commands by defining their options/handler, registering the handler in the interaction switch, and adding the definition to explicit deployment. New clans require only JSON edits. Additional verified selectors belong in pure parsers and corresponding fixtures. Match counts and displayed rates come from the verified Total Stat panel; never replace them with season statistics or inferred outcome calculations. Do not interpret rank progress as EXP.
