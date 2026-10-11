# Point Blank Clan Discord Bot

A modular TypeScript/Discord.js v14 bot for configured Point Blank Indonesia clans. It provides `/info-clan`, a paginated `/info-member` roster, and `/info-member nick:...` player statistics. Axios and Cheerio retrieve data; Playwright captures the original layered clan logo.

**Live verification:** On October 11, 2026 (Asia/Jakarta), the corrected Hepatica link returned the clan profile and all 91 members without authentication. The original identifier was missing the `WnY3` segment; that different URL returned `Login dibutuhkan.` and a login redirect. The configured identifier now matches the corrected link. Total-statistics selectors and the layered logo are verified against the public page. Clan EXP remains `N/A`; player-detail JSON is still covered by the supplied illustrative fixture, not a confirmed live player request.

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
| `MEMBER_CACHE_TTL_SECONDS` | `120` | Player detail response TTL |
| `LOGO_CACHE_TTL_SECONDS` | `1800` | Rendered logo TTL |
| `LOGO_TIMEOUT_MS` | `20000` | Browser operation timeout |
| `PAGINATION_TIMEOUT_SECONDS` | `120` | Navigation lifetime, maximum 600 |
| `ROSTER_PAGE_SIZE` | `15` | 10–20 members per page |

Clan profiles/rosters are cached for five minutes, player details for two minutes and logos for thirty minutes by default. Cache expiry permits another fetch immediately when optional request spacing is disabled and no actual upstream rate limit is active. All caches are in memory, bounded, deduplicated, and lost on restart. Failures are not cached, except a short 401/403 access circuit breaker. Retries remain bounded and honor upstream `Retry-After` instructions.

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

Command registration replaces this application's commands in the selected guild/global scope with these two commands. Deploy again only when definitions change. Switching scopes does not delete definitions in the old scope; remove obsolete test registrations in the Developer Portal/API as appropriate. Global changes can take time to appear.

`npm run check:discord` performs read-only Discord requests to confirm that the token belongs to `DISCORD_CLIENT_ID` and that the selected command endpoint is accessible. Deployment performs the same checks before changing commands. It does not change the target server or fall back to global registration after an access failure.

## Commands

| Command | Result |
| --- | --- |
| `/info-clan` | Default clan profile and rendered logo |
| `/info-clan clan:hepatica` | Selected configured clan |
| `/info-member` | Default clan roster sorted by rank number, highest first, with Previous/Next buttons |
| `/info-member clan:hepatica` | Selected clan roster sorted by rank number, highest first |
| `/info-member nick:pLebb` | Player statistics from the default clan |
| `/info-member nick:pLebb clan:hepatica` | Player statistics from the selected clan |

Clan IDs autocomplete locally. Exact nickname capitalization takes precedence; case-insensitive matches are accepted if unique. Punctuation, Unicode and spaces are preserved. Roster rows show `1. [rank icon] **nickname**` using each member's original website rank image as a Discord application emoji. Before pagination, members are sorted by the numeric `rank_<number>.png` suffix from highest to lowest, matching the numbers in `pb_rank_<number>` emoji names. Equal ranks keep website order; missing or untrusted rank images appear last. Sorting still works when emoji preparation fails. On first use, the bot reuses existing `pb_rank_<image number>` emojis and uploads any missing icons; the first roster can take longer while those icons are prepared. These application emojis do not consume server emoji slots or require `USE_EXTERNAL_EMOJIS`. If an icon cannot be prepared, its original image remains available through a Rank link; missing rank images show Rank N/A. Unverified rank names are never invented. Individual views use the original rank image thumbnail, independent of the JSON `Rank` metric. See [Discord application emojis](https://docs.discord.com/developers/resources/emoji#application-owned-emoji).

Roster buttons work only for the original requester. They disable at page boundaries and after expiry. Cached parsed roster count must match the profile count when available; partial rosters trigger a clear error. An empty confirmed clan produces an empty list. Logo failure leaves profile data readable and is logged.

Clan profiles show the original clan logo first, followed by the clan name in the largest heading. Clan details come next, then an inline rank badge emoji followed by the verified website rank name, directly above Rank progress. The bot uploads or reuses the original `clan_<number>.png` badge as `pb_clan_rank_<number>`, separate from member rank emojis. If preparation fails, a link to the original badge stays beside the name. A compact progress bar appears beside the progress label and exact percentage; missing progress remains N/A. Overall match results pair win/loss counts with the site's displayed percentages. Discord Components V2 controls this ordering and Markdown text hierarchy, with a small source/timestamp footer. Missing values remain N/A.

## Build, tests, and production

```powershell
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
npm start
```

Unit tests mock external HTTP and use supplied/synthetic fixtures. Browser tests use real Chromium with a local HTTP server; they verify layered rendering, profile logo selection, PNG dimensions, cache reuse, failed resources, and cleanup. No ordinary or browser test calls Point Blank or Discord.

Keep `config/clans.json`, production dependencies, built `dist/`, and the environment available at deployment. Run from the project root or set `CLANS_CONFIG_PATH` explicitly. Install the Chromium version matching the lockfile under the same operating-system account as the bot. `SIGINT`/`SIGTERM` close Discord and the reusable browser. Register commands separately; starting the process does not overwrite them.

## Troubleshooting

- **Invalid environment/config:** compare `.env.example`, validate JSON and unique IDs, and run `npm run check:config`. Errors list variable names, not values.
- **Login required:** first verify that the configured clan `uniqueId` exactly matches a working official link. An incomplete identifier previously produced this message even though the corrected link was public. If an exact working link still returns a genuine access restriction, the bot does not bypass it.
- **Request limit:** confirm `POINTBLANK_MIN_REQUEST_INTERVAL_MS=0` and restart after changing it. A genuine HTTP 429 / `Retry-After` response can still pause fresh requests; follow the wait shown by the bot.
- **Unexpected HTML/incomplete roster:** preserve a safely sanitized permitted response and update fixtures/selectors after inspection. See `docs/architecture/website-verification.md`.
- **Match statistics N/A:** check whether the verified `Total Stat` panel still exists. Statistics are taken from that panel, not current/previous season panels. The observed wins + losses count differs from total matches, so displayed percentages are preserved instead of recalculated. The calculation helper remains separate until outcome definitions are established.
- **Player fields N/A:** individual missing/malformed counters use `N/A`; an entirely unusable response raises an error. Comma-separated integers are supported; arbitrary decimal/localized formats are rejected.
- **Logo unavailable:** inspect the `Clan logo failed` log's `stage` and `reason`. `BROWSER_NOT_INSTALLED` requires stopping the bot, running `npm run install:browser` in the same terminal and OS account used to start it, then restarting. A custom `PLAYWRIGHT_BROWSERS_PATH` must match between installation and runtime; rerun the installer after updating Playwright. `STYLES_FAILED` / `IMAGE_FAILED` mean required site assets failed; `NETWORK_FAILED` / `TIMEOUT` indicate a connection or readiness failure. Multiple profile marks are `ELEMENT_NOT_FOUND`. Restart after source changes or rebuild before `npm start`. Rendering waits for the logo's styles and layers rather than unrelated page images; optional external font imports remain blocked without failing the mark. Raw browser errors and query identifiers are never logged.
- **Slash command absent:** confirm registration scope, installation, application ID, and command permissions.
- **Command registration error 50001 (Missing access):** run `npm run check:discord`. Set `DISCORD_CLIENT_ID` to the Application ID from the same application as the bot token. Set `DISCORD_GUILD_ID` to the **server ID**, not a channel ID: enable Developer Mode, then right-click the server icon and choose Copy Server ID. Install/reauthorize that application into the target server using **Guild Install** with the `bot` and `applications.commands` scopes. Being present in another server does not grant access to this one. Channel permissions or administrator permission do not replace application-command authorization. See [Discord's command authorization documentation](https://docs.discord.com/developers/interactions/application-commands#authorizing-your-application).
- **Expired interaction:** run the command again. Failed/expired replies are logged without stacks or identifiers in Discord messages.

Architecture and verification notes are in `docs/architecture/`; feature requirements, design, tasks and acceptance criteria are in `docs/specs/`. Project conventions are in `AGENTS.md`.
