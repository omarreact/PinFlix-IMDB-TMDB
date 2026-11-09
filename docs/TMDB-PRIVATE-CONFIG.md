# Private TMDB configuration for GitHub Pages

## Why a Worker is required

GitHub Pages serves static files. API tokens inserted into HTML, JavaScript, generated config, or Pages artifacts are visible to visitors, even when they originate from GitHub Actions secrets. Do **not** commit either supplied TMDB credential.

The site supports a separate Cloudflare Worker which holds the TMDB Read Access Token in a server-side secret and forwards only approved metadata requests. No video or media files pass through this proxy.

## Secure setup (after approval to create/deploy a Worker)

1. Rotate the TMDB Read Access Token and API key previously shared in chat.
2. Authenticate Wrangler with the Cloudflare account you control.
3. From `workers/tmdb-proxy` run `npx wrangler secret put TMDB_READ_ACCESS_TOKEN` and enter the **new read-access token** in the interactive prompt. Do not put it in command arguments or source files.
4. Deploy with `npx wrangler deploy` **only after staging/testing and deployment approval**. Record the exact Worker HTTPS URL.
5. Set `TMDB_PROXY_BASE_URL` in `assets/js/config.js` to that Worker URL (without a trailing slash) on a separate branch/PR and validate in staging. This is a **public endpoint URL, not a secret**.
6. After approval, merge the tested configuration to the GitHub Pages branch. The catalogue will load automatically on desktop and mobile without entering a TMDB token in Settings.

The worker only allows requests from `https://omarreact.github.io` and local development origins, supports GET and preflight OPTIONS, and allowlists TMDB paths for trending, multi-search, media details, and TV seasons.

**Security caveat:** Checking the browser Origin is not strong authentication; clients can spoof this header. Apply Cloudflare rate limits / WAF protections to the Worker as appropriate, review quota usage, and consider account-level authentication if restricted access is required.

## Status

The API credentials have **not** been saved to GitHub or Cloudflare by this code change. They must be installed as a Cloudflare Worker secret after rotation and authorization. The public site will continue using its existing per-browser token setup until the proxy endpoint is configured.

The TMDB API key is not necessary: the proxy uses only the TMDB API Read Access Token. Never use GitHub Pages build-time substitution to put either credential into shipped JS.
