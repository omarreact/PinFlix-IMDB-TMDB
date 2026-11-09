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

## Playback template

PinFlix does not ship a third-party streaming service. If you operate or are authorized to use an HTTPS embed provider, configure a URL template in Settings. Supported placeholders: `{imdb}`, `{tmdb}`, `{season}`, `{episode}`.

## GitHub Pages

`.github/workflows/pages.yml` validates pull requests and deploys `main` through GitHub Pages after the repository's Pages source is configured to **GitHub Actions**.

## Native packages

Windows and Android packaging are intentionally not coupled to this web recovery commit. See `docs/NATIVE.md` for the proposed next step after the web branch is accepted and Pages is verified.
