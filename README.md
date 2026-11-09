# PinFlix IMDB/TMDB

A clean, static PinFlix web/PWA project rebuilt from the archived prototype audit. It uses TMDB for movie/TV metadata and keeps local history/watchlist data in the browser.

## Security changes

- No dynamic `innerHTML` rendering in application code.
- When configured with a direct development token, TMDB authorization uses the `Authorization` header. A v3 API key is also supported for development fallback.
- Playback iframe is sandboxed and uses `referrerpolicy="no-referrer"`.
- HTTPS-only playback templates; no provider endpoint is hard-coded.
- CSP blocks inline scripts and mixed HTTP content.
- Search requests are cancellable to prevent stale results from overwriting newer queries.

## Local development

```bash
npm run check
npm run build
npm run dev -- --port=4173
```

Open `http://127.0.0.1:4173`. The demo catalogue loads automatically when development credentials are set in `assets/js/dev-config.js`. No credentials form is displayed.

## Local development credentials (no Cloudflare)

The app supports direct TMDB credentials for development. Edit `assets/js/dev-config.js` **only in a local/private copy**, setting `DEV_TMDB_READ_ACCESS_TOKEN` or `DEV_TMDB_API_KEY`. The repo keeps empty placeholders intentionally: pushing real values to a public GitHub branch or Pages site exposes them to anyone.

The catalogue auto-loads trending movies and TV at startup. Streaming embeds are sandboxed, but untrusted provider ads inside an iframe cannot be removed by TMDB configuration.

## Network-resilient catalogue on GitHub Pages

The app normally queries TMDB directly. Some Android/mobile networks or browsers cannot reach `api.themoviedb.org` even though the GitHub Pages website itself loads.

The GitHub Actions Pages workflow now generates `dist/assets/data/tmdb-catalogue.json` using the development TMDB v3 key during CI. If a visitor's live TMDB request fails or times out, PinFlix uses this **same-origin** snapshot automatically, with cached text search, movie/TV IMDb identifiers, and synthesized episode-number navigation for cached TV seasons.

No Cloudflare Worker, proxy server, or alternate external API service is involved. The snapshot covers a **limited selection of trending/popular titles from the last successful deployment**, not TMDB's entire database. Movie posters still come from TMDB's image host and may be unavailable on blocked networks. Video-provider availability and ad behavior are separate from TMDB metadata.

To refresh the snapshot, run the existing GitHub Pages workflow (manual `workflow_dispatch`) or publish a new commit. The generated snapshot is part of the deployment artifact and no additional credentials are embedded in it.

## Playback template

PinFlix does not ship a third-party streaming service. If you operate or are authorized to use an HTTPS embed provider, configure a URL template in Settings. Supported placeholders: `{imdb}`, `{tmdb}`, `{season}`, `{episode}`.

## GitHub Pages

`.github/workflows/pages.yml` validates pull requests and deploys `main` through GitHub Pages after the repository's Pages source is configured to **GitHub Actions**.

## Native packages

Windows and Android packaging are intentionally not coupled to this web recovery commit. See `docs/NATIVE.md` for the proposed next step after the web branch is accepted and Pages is verified.

## Playback compatibility (GitHub Pages)

The embedded player remains **sandboxed by default**, blocking popups and top-level navigation. Some third-party providers refuse sandboxed iframes and show “Sandboxing is not allowed”. After choosing an authorized playback provider in Settings, visitors may click **Compatibility playback** and confirm the warning to reload the same movie or episode without iframe sandbox restrictions. This is session-only and returns to restricted mode on refresh. Compatibility mode is **not** an ad blocker: the provider may show ads, open popups, or attempt redirects.

You can configure a second authorized HTTPS provider template in Settings. **Try another server** switches manually between primary and backup without changing the selected movie/episode or watch history. Automatic detection of cross-origin iframe playback failures is not possible reliably from this static page.

The GitHub Pages site does not contain the TMDB credentials supplied privately for development; its direct development credential placeholders are empty. Embedding them in a public static build exposes them to visitors.

## GitHub Pages catalogue & built-in playback (2026-11-09)

The GitHub Pages build now includes a **public development-only TMDB v3 API key** to resolve the previously empty catalogue for new visitors. This key is deliberately exposed in static JavaScript, as the owner requested, and can be copied by any visitor; **do not use a private bearer token in the public build**. Rotate or restrict the v3 key before any non-development release. Live TMDB availability is checked from CI with `scripts/smoke-tmdb.mjs`.

The app now derives the two default embedded video sources from validated IMDb IDs, matching the user's working standalone HTML. Visitors do not need to type provider URL templates to show a player. Settings can optionally override both default sources. The default iframe remains sandboxed, and compatibility playback is explicitly opt-in because it removes popup/navigation protection. Provider availability and actual video playback cannot be established by a successful metadata request or CI build.
