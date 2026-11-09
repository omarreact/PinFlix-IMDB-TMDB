const API = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

export class TmdbClient {
  constructor(token, fetchImpl = fetch, { apiKey = '', catalogueUrl = '' } = {}) {
    this.token = token;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.catalogueUrl = catalogueUrl;
    this.cataloguePromise = null;
    this.usingSnapshot = false;
    this.snapshotGeneratedAt = '';
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
      const timeout = AbortSignal.timeout(8500);
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      response = await this.fetchImpl(url, { headers, signal: requestSignal });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
        throw new TmdbError('TMDB request timed out.');
      throw new TmdbError('Network error while contacting TMDB.');
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.status_message || ''; } catch {}
      throw new TmdbError(detail || `TMDB request failed (${response.status}).`, response.status);
    }
    return response.json();
  }

  async loadSnapshot() {
    if (!this.catalogueUrl) throw new TmdbError('No local catalogue is configured.');
    if (!this.cataloguePromise) {
      this.cataloguePromise = Promise.resolve()
        .then(() => this.fetchImpl(this.catalogueUrl, { headers: { Accept: 'application/json' } }))
        .then(async response => {
          if (!response.ok) throw new Error('Cached catalogue unavailable');
          const snapshot = await response.json();
          if (snapshot.version !== 1 || !Array.isArray(snapshot.items) ||
              typeof snapshot.details !== 'object' || !snapshot.details)
            throw new Error('Invalid cached catalogue');
          return snapshot;
        })
        .catch(error => { this.cataloguePromise = null; throw error; });
    }
    return this.cataloguePromise;
  }

  async withSnapshot(operation, fallback) {
    try {
      const result = await operation();
      this.usingSnapshot = false;
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (!this.catalogueUrl) throw error;
      try {
        const snapshot = await this.loadSnapshot();
        this.usingSnapshot = true;
        this.snapshotGeneratedAt = snapshot.generated_at || '';
        return fallback(snapshot);
      } catch {
        // Preserve original live error if GitHub Pages also cannot serve snapshot.
        throw error;
      }
    }
  }

  trending(signal) {
    return this.withSnapshot(
      async () => {
        const data = await this.request('/trending/all/week', {}, signal);
        return (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
      },
      snapshot => snapshot.items
    );
  }

  searchMulti(query, signal) {
    return this.withSnapshot(
      async () => {
        const data = await this.request('/search/multi', { query, include_adult: 'false' }, signal);
        return (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
      },
      snapshot => {
        const term = String(query).trim().toLocaleLowerCase();
        return snapshot.items.filter(item =>
          [item.title || item.name || '', item.overview || '']
            .some(value => value.toLocaleLowerCase().includes(term))
        );
      }
    );
  }

  details(mediaType, id, signal) {
    return this.withSnapshot(
      () => this.request(`/${mediaType}/${id}`, { append_to_response: 'external_ids,videos' }, signal),
      snapshot => {
        const detail = snapshot.details[`${mediaType}:${id}`];
        if (!detail) throw new TmdbError('This title is not in the offline catalogue.');
        return detail;
      }
    );
  }

  season(tvId, seasonNumber, signal) {
    return this.withSnapshot(
      () => this.request(`/tv/${tvId}/season/${seasonNumber}`, {}, signal),
      snapshot => {
        const detail = snapshot.details[`tv:${tvId}`];
        const season = (detail?.seasons || []).find(row => row.season_number === Number(seasonNumber));
        if (!season) throw new TmdbError('Season details unavailable in the cached catalogue.');
        // Playback only needs season/episode numbers; offline labels are intentionally generic.
        return {
          season_number: Number(seasonNumber),
          episodes: Array.from({ length: Math.min(Number(season.episode_count) || 0, 300) }, (_, i) => ({
            episode_number: i + 1,
            name: `Episode ${i + 1}`,
            overview: 'Episode synopsis unavailable while TMDB is unreachable.'
          }))
        };
      }
    );
  }

  image(path, size = 'w500') {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  }
}
