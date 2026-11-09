# PinFlix IMDb / TMDB

A static GitHub Pages movie and TV discovery site. The frontend uses TMDB metadata, IMDb identifiers and user-initiated third-party iframe players. It keeps watch history and watchlists in browser storage.

## Zero-configuration visitor experience

**No visitor setup page, credential prompt, playback URL input, or Settings dialog.** The source configuration belongs in the repository:
- `assets/js/dev-config.js`: TMDB development **v3 browser API key** (already included by the owner; it is visible to every public visitor). Do **not** publish the private TMDB Read Access Token here.
- `assets/js/services/providers.js`: fixed primary/backup player URLs for MultiEmbed and VSEmbed.
- `assets/js/app.js`: automatic catalogue, movie/TV details, episode navigation, video frame, manual **Try another server**, history/watchlist and browser UI.
- `assets/js/services/player-security.js`: restricted iframe by default. **Compatibility playback** is an explicit temporary opt-in for providers that reject sandbox restrictions. It can enable unwanted ads, popups or navigation; it does not remove advertising.

The imported example file `PinFlix_Dev_Compatibility_Fix.html` supplied the reference player URL patterns and direct-code setup. The repository retains its original PinFlix design and modular architecture instead of replacing it with the example's page layout.

## GitHub Pages TMDB fallback

Live TMDB calls remain the preferred source. When the user's Android network/browser cannot reach `api.themoviedb.org`, the app loads `assets/data/tmdb-catalogue.json` **from the same GitHub Pages origin**. GitHub Actions builds this limited trending/popular snapshot at deployment time. It includes cached metadata and IMDb IDs, and generates episode-number navigation from cached season counts. Search in fallback mode only covers those cached titles.

This does not unblock direct TMDB access, TMDB poster/CDN access, or third-party video servers. A cached catalogue is not a complete TMDB mirror. The origin of a streaming popup or in-frame advertisement is independent from TMDB metadata.

## Run and validate

```bash
npm run check
npm run build
npm run dev -- --port=4173
```

The pull-request GitHub Actions workflow runs tests, a live metadata smoke check, builds the static output and generates the snapshot. It does **not** deploy pull requests. The `main` push workflow publishes GitHub Pages.

## Security / limitations

- Public GitHub Pages **cannot keep client-side keys secret**. Rotate or restrict the development v3 key before production; never commit the private bearer token.
- All third-party video players are external to PinFlix and may have ads or fail under sandboxing. Actual video playback is not verified by a metadata smoke test.
- Browser history and watchlist require no account and remain device-local.
- Provider switching is user-initiated. Cross-origin iframes do not reliably expose playback-health signals for automatic failover.
- The project uses safe text rendering for TMDB content, a Content Security Policy, and sandbox restrictions on player frames.

Native Android/Windows packaging is not part of this static site change; see `docs/NATIVE.md`.
