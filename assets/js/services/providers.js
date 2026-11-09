import { normalizeImdbId, positiveInt } from '../lib/validation.js';

// Defaults mirror the movie/TV iframe URL patterns in the user's working HTML.
// These are third-party, user-initiated embeds, not TMDB video streams.
export const BUILTIN_PROVIDERS = Object.freeze([
  Object.freeze({ id: 'multiembed', label: 'MultiEmbed' }),
  Object.freeze({ id: 'vsembed', label: 'VSEmbed' })
]);

export function buildBuiltinProviderUrl(providerId, item) {
  const imdb = normalizeImdbId(item?.imdbId);
  if (!imdb || !['movie', 'tv'].includes(item?.mediaType)) return '';
  const isTv = item.mediaType === 'tv';
  const season = isTv ? positiveInt(item.season, { max: 1000 }) : null;
  const episode = isTv ? positiveInt(item.episode, { max: 10000 }) : null;
  if (isTv && (!season || !episode)) return '';

  let url;
  if (providerId === 'multiembed') {
    url = new URL('https://multiembed.mov/');
    url.searchParams.set('video_id', imdb);
    if (isTv) {
      url.searchParams.set('s', String(season));
      url.searchParams.set('e', String(episode));
    }
  } else if (providerId === 'vsembed') {
    url = new URL(isTv ? 'https://vsembed.ru/embed/tv' : 'https://vsembed.ru/embed/movie');
    url.searchParams.set('imdb', imdb);
    if (isTv) {
      url.searchParams.set('season', String(season));
      url.searchParams.set('episode', String(episode));
    }
  } else return '';

  return url.toString();
}
