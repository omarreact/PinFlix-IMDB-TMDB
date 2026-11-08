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

export function providerTemplateIsValid(value = '') {
  const template = String(value).trim();
  if (!template) return true;
  try {
    const test = template
      .replaceAll('{imdb}', 'tt1375666')
      .replaceAll('{tmdb}', '27205')
      .replaceAll('{season}', '1')
      .replaceAll('{episode}', '1');
    const url = new URL(test);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
