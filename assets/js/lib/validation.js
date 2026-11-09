export function normalizeImdbId(value = '') {
  const id = String(value).trim();
  return /^tt\d{5,12}$/.test(id) ? id : null;
}

export function positiveInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function normalizeMediaType(value) {
  return value === 'movie' || value === 'tv' ? value : null;
}

export function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function clampText(value, max = 500) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
 
// Restore a saved history/watchlist row without trusting corrupted localStorage values.
export function librarySelection(item) {
  const mediaType = normalizeMediaType(item?.mediaType);
  const tmdbId = positiveInt(item?.tmdbId);
  if (!mediaType || !tmdbId) return null;
  const season = mediaType === 'tv' ? positiveInt(item?.season, { max: 1000 }) : null;
  const episode = mediaType === 'tv' ? positiveInt(item?.episode, { max: 10000 }) : null;
  return { mediaType, tmdbId, season: season && episode ? season : null, episode: season && episode ? episode : null };
}
