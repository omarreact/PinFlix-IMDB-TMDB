const API = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

export class TmdbClient {
  constructor(token, fetchImpl = fetch) {
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(path, params = {}, signal) {
    if (!this.token) throw new TmdbError('TMDB Read Access Token is required.');
    const url = new URL(`${API}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    let response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json'
        },
        signal
      });
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
