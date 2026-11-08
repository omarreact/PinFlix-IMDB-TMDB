# Recovery notes

The repository's original `main` branch contains only a README and `movie-and-tv (2).zip`. The previous Codex workspace was not pushed to GitHub.

The archived audit established that the original application was a single static `index.html` using TMDB metadata, browser storage, and third-party playback iframes. The audit also reproduced a stored DOM-XSS issue caused by unsafe HTML insertion from deep-link/history values.

This recovery rebuild preserves the core metadata/search/season/watchlist/history concepts while replacing unsafe rendering, separating modules, adding validation/tests/PWA support, and introducing a GitHub Pages workflow.
