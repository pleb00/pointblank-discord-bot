# Point Blank Discord Bot

A modular TypeScript/Discord.js v14 bot for Point Blank Indonesia. It provides `/info-clan` profiles, paginated `/info-member` clan rosters, `/info-player nick:...` ranking information and `/webstore` product catalogues. Axios and Cheerio retrieve data; Playwright captures the original layered clan logo.

**Live verification:** On October 11, 2026 (Asia/Jakarta), the corrected Hepatica link returned the clan profile and all 91 members without authentication. The original identifier was missing the `WnY3` segment; that different URL returned `Login dibutuhkan.` and a login redirect. The configured identifier now matches the corrected link. Total-statistics selectors and the layered logo are verified against the public page. On October 12, individual ranking search with `termtype=3` returned usable `pLebb` HTML; searching `pLeb` returned the site's explicit no-match response. The extracted player identifier was also verified against `/clan/detail?div=1`. `/info-player` now combines the search identity/rank with the detail JSON and calculated ratios. Clan profile EXP remains `N/A`.

The bot has no fixed request cooldown by default. Commands reuse cached data and can fetch clan profiles and player details consecutively. Actual HTTP 429 responses and `Retry-After` instructions from Point Blank still pause fresh requests temporarily. See the request and cache settings below.

## Prerequisites and installation

- Node.js 24 LTS, version 24.17.0 or later within the 24.x series. `.node-version` records the version used for verification. [Node.js releases](https://nodejs.org/en/about/previous-releases)
- npm and a Discord application with a bot.
- Chromium installed through Playwright. Linux hosts may need system libraries (`npx playwright install --with-deps chromium`).

From the project directory:

```powershell
npm ci
npm run install:browser
Copy-Item .env.example .env
```

On macOS/Linux use `cp .env.example .env`. Edit `.env` with your credentials. `.env` is ignored; never commit or paste tokens into logs.

## Discord application setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) and add a bot.
2. Copy its token into `DISCORD_TOKEN` and application ID into `DISCORD_CLIENT_ID`.
3. Enable Discord Developer Mode to copy your test server ID into `DISCORD_GUILD_ID`.
4. Generate an installation/OAuth2 URL with the `bot` and `applications.commands` scopes. Grant **View Channels**, **Send Messages**, **Embed Links**, and **Attach Files**. Use a normal text channel; administrator permission and privileged gateway intents are unnecessary.
5. Install the bot into your server. Ensure channel overrides allow those permissions and members may use application commands.

The bot uses only the Guilds gateway intent. Nicknames and upstream strings are escaped for presentation, and mentions are disabled.

## Configuration

`DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are required. Set `DISCORD_GUILD_ID` for fast development registration; leave it blank for global commands.

| Setting | Default | Meaning |
| --- | --- | --- |
| `POINTBLANK_BASE_URL` | `https://www.pointblank.id` | Official HTTPS origin only |
| `CLANS_CONFIG_PATH` | `config/clans.json` | JSON path, relative to the working directory |
| `LOG_LEVEL` | `info` | Pino level |
| `REQUEST_TIMEOUT_MS` | `15000` | Per HTTP attempt timeout |
| `REQUEST_MAX_RETRIES` | `2` | Additional transient attempts, subject to the shared request budget |
| `POINTBLANK_MIN_REQUEST_INTERVAL_MS` | `0` | Optional spacing between page/API requests; 0 disables the local cooldown |
| `REQUEST_MAX_QUEUE_WAIT_MS` | `2000` | Long waits produce a readable rate-limit message |
| `CLAN_CACHE_TTL_SECONDS` | `300` | Shared clan profile/roster snapshot TTL |
| `MEMBER_CACHE_TTL_SECONDS` | `120` | Player nickname search and detail response TTL |
| `WEBSTORE_CACHE_TTL_SECONDS` | `120` | Parsed webstore category/page TTL |
| `LOGO_CACHE_TTL_SECONDS` | `1800` | Rendered logo TTL |
| `LOGO_TIMEOUT_MS` | `20000` | Browser operation timeout |
| `PAGINATION_TIMEOUT_SECONDS` | `120` | Navigation lifetime, maximum 600 |
| `ROSTER_PAGE_SIZE` | `15` | 10–20 members per page |

Clan profiles/rosters are cached for five minutes, player nickname searches/details and webstore pages for two minutes, and logos for thirty minutes by default. Cache expiry permits another fetch immediately when optional request spacing is disabled and no actual upstream rate limit is active. All caches are in memory, bounded, deduplicated, and lost on restart. HTTP/access failures are not cached, except a short 401/403 access circuit breaker. Retries remain bounded and honor upstream `Retry-After` instructions.

Optional request spacing and upstream rate-limit pauses apply to document/API retrieval and uncached logo navigation through the same request gate. Cached HTML is fulfilled at the original URL in Chromium; associated CSS/images/fonts load to render it, while scripts and other origins are blocked. Ordinary parsing never launches Chromium. Run a single process for this deployment; in-memory request gates are not coordinated across replicas or restarts.

Edit `config/clans.json` to add clans:

```json
{
  "defaultClan": "hepatica",
  "clans": [
    {
      "id": "hepatica",
      "name": "Hepatica",
      "uniqueId": "COPY_THE_EXACT_CLAN_ENV_FROM_THE_OFFICIAL_URL",
      "enabled": true
    }
  ]
}
```

The real supplied Hepatica identifier is already present in the repository's configuration. IDs must be unique lowercase letters/numbers/hyphens, up to 64 characters. The default must reference an enabled clan. Preserve `uniqueId` exactly, including plus signs and padding; do not percent-decode the configured clan string. Restart after JSON changes. Disabled clans are excluded from lookup and autocomplete.

```powershell
npm run check:config
npm run check:discord
npm run deploy:commands
npm run dev
```

Command registration replaces this application's commands in the selected guild/global scope with these four commands. Run `npm run deploy:commands` after upgrading to register `/info-clan {clan}`, `/info-member {clan}`, `/info-player {nick}` and `/webstore {category} {page?}`, then restart the bot (rebuild first when using `npm start`). `/info-member` keeps only its clan option; nickname lookup belongs to `/info-player`. Deploy again only when definitions change. Switching scopes does not delete definitions in the old scope; remove obsolete test registrations in the Developer Portal/API as appropriate. Global changes can take time to appear.

`npm run check:discord` performs read-only Discord requests to confirm that the token belongs to `DISCORD_CLIENT_ID` and that the selected command endpoint is accessible. Deployment performs the same checks before changing commands. It does not change the target server or fall back to global registration after an access failure.

## Commands

| Command | Result |
| --- | --- |
| `/info-clan` | Default clan profile and rendered logo |
| `/info-clan clan:hepatica` | Selected configured clan |
| `/info-member` | Default clan roster sorted by rank number, highest first, with Previous/Next buttons |
| `/info-member clan:hepatica` | Selected clan roster sorted by rank number, highest first |
| `/info-player nick:pLebb` | Grouped player statistics, K/D and headshot ratios, plus clan name/member count/ranking |
| `/webstore category:Trending` | Trending products with thumbnails, prices, product links and Previous/Next buttons |
| `/webstore category:New` | Newly listed products |
| `/webstore category:Sale` | Sale prices, original prices and advertised discounts |
| `/webstore category:Star page:2` | Star Ratings catalogue, starting on upstream page two |

Clan IDs autocomplete locally. `/info-clan` and `/info-member` accept only an optional configured clan, using the default if omitted. `/info-player` accepts only a required nickname. Nickname search requests `/ranking/individual` with fixed `termtype=3` and the complete nickname as `keyword`; it does not require clan membership. Missing characters do not produce a partial match. Exact nickname capitalization takes precedence; a unique case-insensitive match is accepted only if returned by the search. Punctuation, Unicode, spaces and plus signs are preserved. The matched HTML row supplies game ranking and rank name/icon. Its exact `data-env` is decoded once at the HTTP boundary and serialized through URLSearchParams for a GET to `/clan/detail?div=1&env=...`; identifiers never appear in replies or logs.

The nickname is the embed title, with the original rank icon as its thumbnail. A **Player Info** section shows Game Ranking, Rank, Total EXP, Kill, Death, Kill/Death Ratio, Headshot and Headshot Ratio, separated into profile, combat and headshot groups. EXP and counters come from the detail JSON. K/D is kills divided by deaths; headshot ratio is headshots divided by kills as a percentage. Both display two decimal places; missing inputs or a zero denominator show N/A. A **Clan Info** section shows Name from ClanName, Members from ClanTroops and Ranking from ClanExpRank. Missing/malformed fields show N/A; an entirely unusable detail response raises a clear error. JSON Rank does not replace the search ranking or rank name/icon.

Roster rows show `1. [rank icon] **nickname**` using each member's original website rank image as a Discord application emoji. Before pagination, members are sorted by the numeric `rank_<number>.png` suffix from highest to lowest, matching the numbers in `pb_rank_<number>` emoji names. Equal ranks keep website order; missing or untrusted rank images appear last. Sorting still works when emoji preparation fails. On first use, the bot reuses existing `pb_rank_<image number>` emojis and uploads any missing icons; the first roster can take longer while those icons are prepared. These application emojis do not consume server emoji slots or require `USE_EXTERNAL_EMOJIS`. If an icon cannot be prepared, its original image remains available through a Rank link; missing rank images show Rank N/A. Unverified rank names are never invented. Individual views use the original search-result rank image thumbnail, independent of the JSON `Rank` metric. See [Discord application emojis](https://docs.discord.com/developers/resources/emoji#application-owned-emoji).

Roster buttons work only for the original requester. They disable at page boundaries and after expiry. Cached parsed roster count must match the profile count when available; partial rosters trigger a clear error. An empty confirmed clan produces an empty list. Logo failure leaves profile data readable and is logged.

Clan profiles show the original clan logo first, followed by the clan name in the largest heading. Clan details come next, then an inline rank badge emoji followed by the verified website rank name, directly above Rank progress. The bot uploads or reuses the original `clan_<number>.png` badge as `pb_clan_rank_<number>`, separate from member rank emojis. If preparation fails, a link to the original badge stays beside the name. A compact progress bar appears beside the progress label and exact percentage; missing progress remains N/A. Overall match results pair win/loss counts with the site's displayed percentages. Discord Components V2 controls this ordering and Markdown text hierarchy, with a small source/timestamp footer. Missing values remain N/A.

`/webstore` requires one of **Trending**, **New**, **Sale** or **Star**. The optional positive `page` chooses the starting catalogue page; omission starts on page one. It fetches `/webstore/more/best`, `/new`, `/sale` or `/star` under the same `/webstore/more/` prefix, adding `?page=2` for later pages. Five product cards appear per screen in website order, with original thumbnails, names linking to the product page, prices/currency, available tags, advertised discounts and explicit star ratings. Unknown prices, currencies, discounts and ratings show N/A. The header shows the upstream catalogue page/count and current item range. Previous/Next moves through all items and fetches another upstream page only when necessary. Only the requester can navigate; controls disable at boundaries and expire after two minutes by default. A failed later fetch keeps the current catalogue available and reports the error privately, permitting retry. Catalogue data uses the shared request gate and its own two-minute cache; cart, wishlist and purchase operations are outside this command.

On October 12, 2026 (Asia/Jakarta), all four category endpoints returned usable public HTML; Trending page two and its final page also returned usable data. The initial New request encountered a connection reset before a subsequent successful request. Observed fixtures and the user's supplied index excerpt have separate provenance. Discord display verification requires invoking the registered command.

## Build, tests, and production

```powershell
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
npm start
```

Unit tests mock external HTTP and use supplied, observed or synthetic fixtures with documented provenance. Browser tests use real Chromium with a local HTTP server; they verify layered rendering, profile logo selection, PNG dimensions, cache reuse, failed resources, and cleanup. No ordinary or browser test calls Point Blank or Discord.

Keep `config/clans.json`, production dependencies, built `dist/`, and the environment available at deployment. Run from the project root or set `CLANS_CONFIG_PATH` explicitly. Install the Chromium version matching the lockfile under the same operating-system account as the bot. `SIGINT`/`SIGTERM` close Discord and the reusable browser. Register commands separately; starting the process does not overwrite them.

## Troubleshooting

- **Invalid environment/config:** compare `.env.example`, validate JSON and unique IDs, and run `npm run check:config`. Errors list variable names, not values.
- **Login required:** first verify that the configured clan `uniqueId` exactly matches a working official link. An incomplete identifier previously produced this message even though the corrected link was public. If an exact working link still returns a genuine access restriction, the bot does not bypass it.
- **Request limit:** confirm `POINTBLANK_MIN_REQUEST_INTERVAL_MS=0` and restart after changing it. A genuine HTTP 429 / `Retry-After` response can still pause fresh requests; follow the wait shown by the bot.
- **Unexpected HTML/incomplete roster:** preserve a safely sanitized permitted response and update fixtures/selectors after inspection. See `docs/architecture/website-verification.md`.
- **Match statistics N/A:** check whether the verified `Total Stat` panel still exists. Statistics are taken from that panel, not current/previous season panels. The observed wins + losses count differs from total matches, so displayed percentages are preserved instead of recalculated. The calculation helper remains separate until outcome definitions are established.
- **Player not found:** enter the complete nickname, including punctuation and spaces. Search is independent of the configured clan; missing characters are not completed automatically.
- **Player fields N/A:** missing/malformed game ranking, detail counters, clan counters or rank names use `N/A`. Ratios require both inputs and a nonzero denominator. Comma-separated integers are supported; arbitrary decimal/localized formats are rejected. Changed required search selectors or entirely unusable detail JSON raise a clear error.
- **Logo unavailable:** inspect the `Clan logo failed` log's `stage` and `reason`. `BROWSER_NOT_INSTALLED` requires stopping the bot, running `npm run install:browser` in the same terminal and OS account used to start it, then restarting. A custom `PLAYWRIGHT_BROWSERS_PATH` must match between installation and runtime; rerun the installer after updating Playwright. `STYLES_FAILED` / `IMAGE_FAILED` mean required site assets failed; `NETWORK_FAILED` / `TIMEOUT` indicate a connection or readiness failure. Multiple profile marks are `ELEMENT_NOT_FOUND`. Restart after source changes or rebuild before `npm start`. Rendering waits for the logo's styles and layers rather than unrelated page images; optional external font imports remain blocked without failing the mark. Raw browser errors and query identifiers are never logged.
- **Slash command absent:** confirm registration scope, installation, application ID, and command permissions.
- **Command registration error 50001 (Missing access):** run `npm run check:discord`. Set `DISCORD_CLIENT_ID` to the Application ID from the same application as the bot token. Set `DISCORD_GUILD_ID` to the **server ID**, not a channel ID: enable Developer Mode, then right-click the server icon and choose Copy Server ID. Install/reauthorize that application into the target server using **Guild Install** with the `bot` and `applications.commands` scopes. Being present in another server does not grant access to this one. Channel permissions or administrator permission do not replace application-command authorization. See [Discord's command authorization documentation](https://docs.discord.com/developers/interactions/application-commands#authorizing-your-application).
- **Expired interaction:** run the command again. Failed/expired replies are logged without stacks or identifiers in Discord messages.

Architecture and verification notes are in `docs/architecture/`; feature requirements, design, tasks and acceptance criteria are in `docs/specs/`. Project conventions are in `AGENTS.md`.
