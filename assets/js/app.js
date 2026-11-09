import { clampText, normalizeImdbId, providerTemplateIsValid } from './lib/validation.js';
import { storage } from './services/storage.js';
import { TmdbClient, TmdbError } from './services/tmdb.js';
import { buildProviderUrl } from './services/providers.js';
import { TMDB_PROXY_BASE_URL } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { client: null, searchAbort: null, active: null, season: null };

const els = {
  search: $('#search-input'), searchBtn: $('#search-submit'), results: $('#search-results'), summary: $('#search-summary'),
  status: $('#app-status'), settings: $('#settings-dialog'),
  provider: $('#provider-template'), playerSection: $('#player-section'), frame: $('#stream-frame'), playerTitle: $('#player-title'),
  detail: $('#detail-panel'), trailer: $('#trailer-link'), seasons: $('#season-select'), episodes: $('#episodes'),
  nextEpisode: $('#next-episode'), history: $('#history-list'), watchlist: $('#watchlist-list'), tabs: $$('.tab'), panels: $$('.tab-panel')
};

function setStatus(message = '', tone = 'info') {
  els.status.textContent = message;
  els.status.dataset.tone = tone;
  els.status.classList.toggle('is-visible', Boolean(message));
}

function configureClient() {
  const token = storage.getToken();
  const proxy = TMDB_PROXY_BASE_URL.trim();
  state.client = proxy
    ? new TmdbClient('', fetch, { proxyBaseUrl: proxy })
    : (token ? new TmdbClient(token) : null);
  els.searchBtn.disabled = !state.client;
}

function saveSettings(event) {
  event.preventDefault();
  const provider = els.provider.value.trim();
  if (provider && !providerTemplateIsValid(provider)) {
    setStatus('Playback template must produce a valid HTTPS URL.', 'error');
    return;
  }
  storage.setProviderTemplate(provider);
  configureClient();
  els.settings.close();
  setStatus('Settings saved.', 'success');
  if (state.client) loadCatalogue();
}

function openSettings() {
  els.provider.value = storage.getProviderTemplate();
  els.settings.showModal();
}

function poster(item) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = '';
  img.src = state.client?.image(item.poster_path) || 'assets/icons/poster-placeholder.svg';
  img.addEventListener('error', () => { img.src = 'assets/icons/poster-placeholder.svg'; }, { once: true });
  return img;
}

function titleFor(item) { return clampText(item.title || item.name || 'Untitled', 120); }
function yearFor(item) { return (item.release_date || item.first_air_date || '').slice(0, 4) || '—'; }

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'movie-card';
  card.append(poster(item));
  const body = document.createElement('div'); body.className = 'movie-card__body';
  const title = document.createElement('h3'); title.className = 'movie-card__title'; title.textContent = titleFor(item);
  const meta = document.createElement('p'); meta.className = 'movie-card__meta'; meta.textContent = `${item.media_type === 'tv' ? 'TV' : 'Movie'} • ${yearFor(item)}`;
  const overview = document.createElement('p'); overview.className = 'movie-card__overview'; overview.textContent = clampText(item.overview || 'No synopsis available.', 180);
  const actions = document.createElement('div'); actions.className = 'card-actions';
  const open = document.createElement('button'); open.className = 'button button--primary'; open.type = 'button'; open.textContent = item.media_type === 'tv' ? 'Browse episodes' : 'Open';
  open.addEventListener('click', () => openDetails(item));
  const save = document.createElement('button'); save.className = 'button button--quiet'; save.type = 'button';
  save.textContent = storage.isSaved(item.media_type, item.id) ? 'Saved' : 'Add';
  save.addEventListener('click', () => {
    const result = storage.toggleWatchlist({ mediaType: item.media_type, tmdbId: item.id, title: titleFor(item), poster: item.poster_path || '', year: yearFor(item) });
    save.textContent = result.saved ? 'Saved' : 'Add'; renderLibrary();
  });
  actions.append(open, save); body.append(title, meta, overview, actions); card.append(body); return card;
}

async function loadCatalogue() {
  if (!state.client) return;
  state.searchAbort?.abort();
  const controller = new AbortController();
  state.searchAbort = controller;
  els.searchBtn.disabled = true;
  setStatus('Loading trending movies and TV shows…');
  try {
    const results = await state.client.trending(controller.signal);
    els.results.replaceChildren(...results.map(createCard));
    els.summary.textContent = results.length
      ? 'Trending movies and TV shows on TMDB'
      : 'No trending titles were returned by TMDB.';
    setStatus('');
  } catch (error) {
    if (error.name !== 'AbortError')
      setStatus(error instanceof TmdbError ? error.message : 'Catalogue loading failed.', 'error');
  } finally {
    els.searchBtn.disabled = !state.client;
  }
}

async function performSearch(event) {
  event?.preventDefault();
  const query = els.search.value.trim();
  if (!state.client) return openSettings();
  if (query.length < 2) return setStatus('Enter at least two characters.', 'error');
  state.searchAbort?.abort();
  const controller = new AbortController(); state.searchAbort = controller;
  els.searchBtn.disabled = true; setStatus('Searching…');
  try {
    const results = await state.client.searchMulti(query, controller.signal);
    els.results.replaceChildren(...results.map(createCard));
    els.summary.textContent = results.length ? `${results.length} movie/TV result${results.length === 1 ? '' : 's'} for “${query}”` : `No movie or TV results for “${query}”.`;
    setStatus('');
  } catch (error) {
    if (error.name !== 'AbortError') setStatus(error instanceof TmdbError ? error.message : 'Search failed.', 'error');
  } finally { els.searchBtn.disabled = !state.client; }
}

async function openDetails(item) {
  setStatus('Loading title details…');
  try {
    const detail = await state.client.details(item.media_type, item.id);
    state.active = {
      mediaType: item.media_type, tmdbId: item.id, title: titleFor(detail), poster: detail.poster_path || '', year: yearFor(detail),
      imdbId: normalizeImdbId(detail.external_ids?.imdb_id || '') || ''
    };
    renderDetails(detail);
    if (item.media_type === 'tv') await setupSeasons(detail);
    else playActive();
    setStatus('');
  } catch (error) { setStatus(error.message || 'Unable to load title.', 'error'); }
}

function renderDetails(detail) {
  els.detail.hidden = false;
  $('#detail-title').textContent = titleFor(detail);
  $('#detail-meta').textContent = `${detail.media_type === 'tv' || detail.name ? 'TV' : 'Movie'} • ${yearFor(detail)}${detail.runtime ? ` • ${detail.runtime} min` : ''}`;
  $('#detail-overview').textContent = clampText(detail.overview || 'No synopsis available.', 700);
  const trailer = (detail.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
  els.trailer.hidden = !trailer;
  els.trailer.href = trailer ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}` : '#';
}

async function setupSeasons(detail) {
  const seasons = (detail.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
  els.seasons.replaceChildren(...seasons.map(season => {
    const option = document.createElement('option'); option.value = String(season.season_number); option.textContent = season.name || `Season ${season.season_number}`; return option;
  }));
  els.seasons.closest('.field').hidden = seasons.length === 0;
  els.episodes.hidden = false;
  if (seasons.length) await loadSeason(Number(els.seasons.value));
}

async function loadSeason(seasonNumber) {
  if (!state.active || state.active.mediaType !== 'tv') return;
  setStatus(`Loading season ${seasonNumber}…`);
  try {
    const data = await state.client.season(state.active.tmdbId, seasonNumber);
    state.season = data;
    els.episodes.replaceChildren(...(data.episodes || []).map(ep => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'episode-card';
      const strong = document.createElement('strong'); strong.textContent = `E${ep.episode_number} · ${clampText(ep.name || 'Episode', 100)}`;
      const span = document.createElement('span'); span.textContent = clampText(ep.overview || ep.air_date || 'No description.', 150);
      button.append(strong, span); button.addEventListener('click', () => playActive(seasonNumber, ep.episode_number)); return button;
    }));
    if (data.episodes?.length) playActive(seasonNumber, data.episodes[0].episode_number);
    setStatus('');
  } catch (error) { setStatus(error.message || 'Unable to load season.', 'error'); }
}

function playActive(season, episode) {
  if (!state.active) return;
  const item = { ...state.active, season, episode };
  const template = storage.getProviderTemplate();
  const url = buildProviderUrl(template, item);
  els.playerSection.hidden = false;
  els.playerTitle.textContent = item.mediaType === 'tv' ? `${item.title} · S${season}E${episode}` : item.title;
  els.frame.src = url || 'about:blank';
  $('#provider-empty').hidden = Boolean(url);
  storage.addHistory(item); renderLibrary();
  els.nextEpisode.hidden = item.mediaType !== 'tv';
  if (item.mediaType === 'tv') els.nextEpisode.dataset.episode = String(episode || 0);
}

function nextEpisode() {
  const current = Number(els.nextEpisode.dataset.episode || 0);
  const episodes = state.season?.episodes || [];
  const idx = episodes.findIndex(ep => ep.episode_number === current);
  if (idx >= 0 && idx + 1 < episodes.length) playActive(Number(els.seasons.value), episodes[idx + 1].episode_number);
  else setStatus('This is the last episode loaded for the season.', 'info');
}

function libraryCard(item, type) {
  const row = document.createElement('article'); row.className = 'library-item';
  const info = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.title || 'Untitled';
  const meta = document.createElement('small'); meta.textContent = `${item.mediaType === 'tv' ? 'TV' : 'Movie'}${item.season ? ` • S${item.season}E${item.episode}` : ''} • ${item.year || '—'}`;
  info.append(title, meta); row.append(info);
  if (type === 'watchlist') {
    const remove = document.createElement('button'); remove.className = 'button button--quiet'; remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => { storage.toggleWatchlist(item); renderLibrary(); }); row.append(remove);
  }
  return row;
}

function renderLibrary() {
  const history = storage.getHistory(); const watchlist = storage.getWatchlist();
  els.history.replaceChildren(...(history.length ? history.map(i => libraryCard(i, 'history')) : [empty('No watch history yet.') ]));
  els.watchlist.replaceChildren(...(watchlist.length ? watchlist.map(i => libraryCard(i, 'watchlist')) : [empty('Your watchlist is empty.') ]));
}

function empty(text) { const p = document.createElement('p'); p.className = 'empty-state'; p.textContent = text; return p; }

function switchTab(name) {
  els.tabs.forEach(tab => { const active = tab.dataset.tab === name; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
  els.panels.forEach(panel => { panel.hidden = panel.id !== `${name}-panel`; });
}

function applyDeepLink() {
  const params = new URLSearchParams(location.search); const query = params.get('q');
  if (query) { els.search.value = clampText(query, 120); if (state.client) performSearch(); }
  return Boolean(query);
}

$('#search-form').addEventListener('submit', performSearch);
$('#open-settings').addEventListener('click', openSettings);
$('#settings-form').addEventListener('submit', saveSettings);
$('#settings-cancel').addEventListener('click', () => els.settings.close());
els.seasons.addEventListener('change', () => loadSeason(Number(els.seasons.value)));
els.nextEpisode.addEventListener('click', nextEpisode);
$('#clear-library').addEventListener('click', () => { storage.clearLibrary(); renderLibrary(); setStatus('Local library cleared.', 'success'); });
els.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

configureClient(); renderLibrary(); switchTab('discover');
if (!applyDeepLink() && state.client) loadCatalogue();
if (!state.client) setStatus('TMDB metadata proxy has not been configured yet.', 'error');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('./sw.js').catch(() => {});
