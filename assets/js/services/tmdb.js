const API = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

export class TmdbClient {
  constructor(token, fetchImpl = fetch, { apiKey = '' } = {}) {
    this.token = token;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async request(path, params = {}, signal) {
    if (!this.token && !this.apiKey) throw new TmdbError('TMDB development credentials are missing.');
    const url = new URL(`${API}${path}`);
    if (!this.token) url.searchParams.set('api_key', this.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    let response;
    try {
      const headers = { Accept: 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      response = await this.fetchImpl(url, { headers, signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new TmdbError('Network error while contacting TMDB.');
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.status_message || ''; } catch {}
      throw new TmdbError(detail || `TMDB request failed (${response.status}).`, response.status);
    }
    return response.json();
  }

  async trending(signal) {
    const data = await this.request('/trending/all/week', {}, signal);
    return (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  }

  async searchMulti(query, signal) {
    const data = await this.request('/search/multi', { query, include_adult: 'false' }, signal);
    return (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  }

  details(mediaType, id, signal) {
    return this.request(`/${mediaType}/${id}`, { append_to_response: 'external_ids,videos' }, signal);
  }

  season(tvId, seasonNumber, signal) {
    return this.request(`/tv/${tvId}/season/${seasonNumber}`, {}, signal);
  }

  image(path, size = 'w500') {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  }
}
