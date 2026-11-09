// Live validation; never print API credentials or request URLs.
import { DEV_TMDB_API_KEY } from '../assets/js/dev-config.js';
import { TmdbClient } from '../assets/js/services/tmdb.js';

const client = new TmdbClient('', fetch, { apiKey: DEV_TMDB_API_KEY });
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 16000);
try {
  const results = await client.trending(controller.signal);
  if (!results.length || !results.every(x => x.media_type === 'movie' || x.media_type === 'tv')) {
    throw new Error('TMDB returned an empty or unexpected catalogue.');
  }
  console.log('TMDB live catalogue verified (' + results.length + ' movie/TV results).');
} catch (e) {
  console.error('TMDB live catalogue check failed:', e.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
