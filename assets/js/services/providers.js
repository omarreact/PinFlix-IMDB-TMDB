import { normalizeImdbId, positiveInt, providerTemplateIsValid } from '../lib/validation.js';

export function buildProviderUrl(template, item) {
  if (!template || !providerTemplateIsValid(template)) return '';
  const imdb = normalizeImdbId(item.imdbId) || '';
  const season = item.mediaType === 'tv' ? positiveInt(item.season, { max: 1000 }) : null;
  const episode = item.mediaType === 'tv' ? positiveInt(item.episode, { max: 10000 }) : null;
  const replacements = {
    '{imdb}': imdb,
    '{tmdb}': String(item.tmdbId || ''),
    '{season}': season ? String(season) : '',
    '{episode}': episode ? String(episode) : ''
  };
  let url = template;
  for (const [key, value] of Object.entries(replacements)) url = url.replaceAll(key, encodeURIComponent(value));
  return new URL(url).toString();
}
