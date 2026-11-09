# PinFlix IMDb / TMDB

A modular, vanilla-JavaScript static site for GitHub Pages and Vercel. TMDB provides live movie/TV metadata, IMDb IDs map titles to the built-in MultiEmbed and VSEmbed iframe sources, and watchlist/history stay in localStorage.

## Architecture

- `assets/js/app.js`: discover/search UI, accessible title details, TV episodes, playback and stored-title reopening.
- `assets/js/dev-config.js`: intentionally public **TMDB v3 development API key**. Public static JavaScript cannot keep secrets. Never commit a private bearer token.
- `assets/js/services/tmdb.js`: live TMDB requests first, then same-origin snapshot fallback.
- `assets/js/services/providers.js`: fixed MultiEmbed/VSEmbed movie and episode URLs. There are **no** visitor Settings fields or user-entered player URLs.
- `assets/js/services/player-security.js`: restricted sandbox by default; user-confirmed session-only compatibility mode can enable provider ads, popups or redirects.
- `assets/js/services/storage.js`: browser-local watchlist and episode-specific history with stable identity keys.

## Development and deployment

Node.js 20+ is supported. In the repository root:

```bash
npm run check
npm run build
npm run dev
```

`npm run build` creates a **fully deployable `dist/`**: copies the static assets, fetches the public TMDB trending/popular catalogue, includes a same-origin JSON snapshot and embeds an inert `<template id="pinflix-embedded-catalogue">` in `dist/index.html`. The public TMDB v3 key and reachable TMDB endpoints are required during build; the output never includes a private bearer token.

`npm run dev` serves the built `dist/` at `http://127.0.0.1:4173` (use `npm run dev -- --port=4174` to change port). Rebuild to refresh the local catalogue.

`npm run build:vercel` uses the identical clean build. `vercel.json` specifies `dist` as Vercel's output. GitHub Actions runs checks, a live TMDB smoke test and the same `npm run build`, then deploys that tested `dist` artifact to GitHub Pages on `main`.

## Browser behavior and limitations

- Live TMDB is preferred. If unavailable, the embedded snapshot supplies a **limited** cached set for discovery, search, details and generic season/episode counts.
- Cached mode shows a clear notice and local placeholder posters, without requiring `image.tmdb.org`. Live-mode images also fall back to the placeholder on error.
- History and Watchlist title buttons reopen saved entries; saved TV history attempts to restore the recorded season/episode. Remove and Clear local library are preserved.
- Playback stays within third-party iframes; the app does not host movies or verify their availability. **Try another server** is manual because a cross-origin iframe cannot reliably report playback health. Compatibility mode requires a warning confirmation and is not an ad blocker.
- The versioned service worker caches only PinFlix's own assets and does not turn failed JSON requests into HTML.

## Verification

`npm run check` includes validation, provider URL tests, sandbox alignment, cached catalogue injection and escaping, and library restoration checks. A successful build or HTTP status is not evidence of real video playback: test both servers, device responsiveness and actual movie/TV behavior manually.

No React, Next.js, runtime backend or Cloudflare proxy is required. Native packaging is separate; see `docs/NATIVE.md`.
