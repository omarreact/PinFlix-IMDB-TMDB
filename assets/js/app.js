import { clampText, normalizeImdbId, librarySelection } from './lib/validation.js';
import { storage } from './services/storage.js';
import { TmdbClient, TmdbError } from './services/tmdb.js';
import { buildBuiltinProviderUrl, BUILTIN_PROVIDERS } from './services/providers.js';
import { applyPlaybackSecurity } from './services/player-security.js';
import { DEV_TMDB_API_KEY } from './dev-config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  client: null, searchAbort: null, active: null, season: null,
  playback: null, providerIndex: 0, compatibilityMode: false
};

const els = {
  search: $('#search-input'), searchBtn: $('#search-submit'), results: $('#search-results'), summary: $('#search-summary'),
  status: $('#app-status'),
  playerSection: $('#player-section'), frame: $('#stream-frame'), playerTitle: $('#player-title'),
  switchProvider: $('#switch-provider'), compatibility: $('#toggle-compatibility'),
  securityNote: $('#player-security-note'),
  detail: $('#detail-panel'), trailer: $('#trailer-link'), seasons: $('#season-select'), episodes: $('#episodes'),
  nextEpisode: $('#next-episode'), history: $('#history-list'), watchlist: $('#watchlist-list'), tabs: $$('.tab'), panels: $$('.tab-panel')
};

function setStatus(message = '', tone = 'info') {
  els.status.textContent = message;
  els.status.dataset.tone = tone;
  els.status.classList.toggle('is-visible', Boolean(message));
}

function showSnapshotNotice() {
  if (!state.client?.usingSnapshot) return setStatus('');
  const generated = state.client.snapshotGeneratedAt;
  const dateText = generated && !Number.isNaN(Date.parse(generated))
    ? new Date(generated).toLocaleDateString() : 'the last deployment';
  setStatus(`TMDB is unreachable from this browser. Showing cached catalogue from ${dateText}. Search covers cached titles only.`, 'info');
}

function configureClient() {
  // Only the public development v3 key is shipped to browsers.
  const apiKey = DEV_TMDB_API_KEY.trim();
  state.client = new TmdbClient('', fetch, {
    apiKey,
    catalogueUrl: './assets/data/tmdb-catalogue.json'
  });
  // The deployment embeds a cached catalogue directly in HTML. Read it now
  // so TMDB outages and service-worker/CDN failures cannot hide the catalogue.
  const block = document.getElementById('pinflix-embedded-catalogue');
  if (block?.content?.textContent) {
    try {
      const snapshot = JSON.parse(block.content.textContent);
      if (snapshot.version === 1 && Array.isArray(snapshot.items) &&
          snapshot.items.length > 0 && snapshot.details && typeof snapshot.details === 'object') {
        state.client.cataloguePromise = Promise.resolve(snapshot);
      }
    } catch {
      // Older builds and invalid data fall back to the original JSON endpoint.
    }
  }
  els.searchBtn.disabled = !state.client;
}

function poster(item) {
  const img = document.createElement('img');
  const fallback = 'assets/icons/poster-placeholder.svg';
  img.loading = 'lazy';
  img.alt = `Poster for ${titleFor(item)} (${yearFor(item)})`;
  // In snapshot mode the TMDB image CDN may be blocked along with the API.
  img.src = state.client?.usingSnapshot ? fallback : (state.client?.image(item.poster_path) || fallback);
  img.addEventListener('error', () => { img.src = fallback; }, { once: true });
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
  open.setAttribute('aria-label', `Open ${titleFor(item)}`);
  open.addEventListener('click', () => openDetails(item));
  const save = document.createElement('button'); save.className = 'button button--quiet'; save.type = 'button';
  save.textContent = storage.isSaved(item.media_type, item.id) ? 'Saved' : 'Add';
  save.setAttribute('aria-label', `Toggle watchlist for ${titleFor(item)}`);
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
  setStatus('Loading trending movies and TV…');
  try {
    const results = await state.client.trending(controller.signal);
    els.results.replaceChildren(...(results.length ? results.map(createCard) : [empty('No trending titles available right now.')]));
    els.summary.textContent = state.client.usingSnapshot
      ? `Cached movies and TV shows (${results.length} titles)`
      : (results.length ? 'Trending movies and TV shows from TMDB' : 'No titles returned.');
    showSnapshotNotice();
  } catch (error) {
    if (error?.name !== 'AbortError') setStatus(error instanceof TmdbError ? error.message : 'Unable to load catalogue.', 'error');
  } finally { els.searchBtn.disabled = !state.client; }
}

async function performSearch(event) {
  event?.preventDefault();
  const query = els.search.value.trim();
  if (!state.client) return setStatus('TMDB catalogue is unavailable.', 'error');
  if (query.length < 2) return setStatus('Enter at least two characters.', 'error');
  state.searchAbort?.abort();
  const controller = new AbortController(); state.searchAbort = controller;
  els.searchBtn.disabled = true; setStatus('Searching…');
  try {
    const results = await state.client.searchMulti(query, controller.signal);
    els.results.replaceChildren(...(results.length ? results.map(createCard) : [empty(state.client.usingSnapshot
      ? 'No matches in the cached selection. Try a different title.'
      : 'No matching movies or TV shows. Try another search.')]));
    els.summary.textContent = results.length
      ? `${results.length} movie/TV result${results.length === 1 ? '' : 's'} for “${query}”${state.client.usingSnapshot ? ' (cached)' : ''}`
      : `No movie or TV results for “${query}”${state.client.usingSnapshot ? ' in the cached selection' : ''}.`;
    showSnapshotNotice();
  } catch (error) {
    if (error.name !== 'AbortError') setStatus(error instanceof TmdbError ? error.message : 'Search failed.', 'error');
  } finally { els.searchBtn.disabled = !state.client; }
}

function focusSection(heading) {
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openDetails(item, { season = null, episode = null } = {}) {
  setStatus('Loading title details…');
  try {
    const detail = await state.client.details(item.media_type, item.id);
    state.active = {
      mediaType: item.media_type, tmdbId: item.id, title: titleFor(detail), poster: detail.poster_path || '', year: yearFor(detail),
      imdbId: normalizeImdbId(detail.external_ids?.imdb_id || '') || ''
    };
    // Stop the previous title's video before displaying a new movie or TV show.
    state.playback = null;
    els.frame.src = 'about:blank';
    els.playerSection.hidden = true;
    renderDetails(detail);
    if (item.media_type === 'tv') {
      await setupSeasons(detail, { season, episode });
      focusSection($('#detail-title'));
    } else {
      state.season = null;
      els.seasons.closest('.field').hidden = true;
      els.episodes.hidden = true;
      playActive();
      focusSection($('#player-title'));
    }
    showSnapshotNotice();
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

async function setupSeasons(detail, restore = {}) {
  const seasons = (detail.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
  els.seasons.replaceChildren(...seasons.map(season => {
    const option = document.createElement('option');
    option.value = String(season.season_number);
    option.textContent = season.name || `Season ${season.season_number} (${season.episode_count} episodes)`;
    return option;
  }));
  els.seasons.closest('.field').hidden = seasons.length === 0;
  els.episodes.hidden = seasons.length === 0;
  if (seasons.length) {
    const selected = seasons.find(s => s.season_number === restore.season)?.season_number ?? seasons[0].season_number;
    els.seasons.value = String(selected);
    await loadSeason(selected, selected === restore.season ? restore.episode : null);
  } else {
    els.episodes.replaceChildren(empty('No indexed seasons are available for this title.'));
  }
}

async function loadSeason(seasonNumber, restoreEpisode = null) {
  if (!state.active || state.active.mediaType !== 'tv') return;
  setStatus(`Loading season ${seasonNumber}…`);
  try {
    const data = await state.client.season(state.active.tmdbId, seasonNumber);
    state.season = data;
    const episodes = data.episodes || [];
    els.episodes.replaceChildren(...(episodes.length ? episodes.map(ep => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'episode-card';
      const strong = document.createElement('strong');
      strong.textContent = `E${ep.episode_number} · ${clampText(ep.name || 'Episode', 100)}`;
      const span = document.createElement('span');
      span.textContent = clampText(ep.overview || ep.air_date || 'Episode details unavailable.', 150);
      button.append(strong, span);
      button.addEventListener('click', () => {
        playActive(seasonNumber, ep.episode_number);
        focusSection($('#player-title'));
      });
      return button;
    }) : [empty('No episodes are listed for this season.')]));
    const selectedEpisode = episodes.find(ep => ep.episode_number === restoreEpisode) || episodes[0];
    if (selectedEpisode) playActive(seasonNumber, selectedEpisode.episode_number);
    showSnapshotNotice();
  } catch (error) { setStatus(error.message || 'Unable to load season.', 'error'); }
}

function renderPlayback() {
  if (!state.playback) return;
  const item = state.playback;
  // Provider endpoints are maintained in services/providers.js, not visitor Settings.
  const builtinProvider = BUILTIN_PROVIDERS[state.providerIndex] || BUILTIN_PROVIDERS[0];
  const url = buildBuiltinProviderUrl(builtinProvider.id, item);
  els.playerSection.hidden = false;
  els.playerTitle.textContent = item.mediaType === 'tv'
    ? `${item.title} · S${item.season}E${item.episode}`
    : item.title;

  // Clear the prior document before changing sandbox permissions.
  els.frame.src = 'about:blank';
  applyPlaybackSecurity(els.frame, state.compatibilityMode);
  els.frame.src = url || 'about:blank';
  const emptyNotice = $('#provider-empty');
  emptyNotice.hidden = Boolean(url);
  if (!url) {
    emptyNotice.textContent = item.imdbId
      ? 'No playable URL could be generated. Check the source configuration.'
      : 'TMDB has no IMDb ID for this title. Choose another movie or show.';
  }

  els.switchProvider.hidden = BUILTIN_PROVIDERS.length < 2 || !url;
  els.switchProvider.textContent = state.providerIndex === 0
    ? 'Try another server'
    : 'Return to primary server';
  els.compatibility.hidden = !url;
  els.compatibility.textContent = state.compatibilityMode ? 'Return to restricted mode' : 'Compatibility playback';
  els.compatibility.setAttribute('aria-pressed', String(state.compatibilityMode));
  els.securityNote.hidden = !url;
  els.securityNote.dataset.risk = state.compatibilityMode ? 'warning' : 'safe';
  const providerLabel = builtinProvider.label;
  els.securityNote.textContent = state.compatibilityMode
    ? providerLabel + ': Compatibility mode removes iframe sandbox restrictions; ads, popups or redirects are possible.'
    : providerLabel + ': Restricted mode blocks popups and top-page navigation. If the player says “Sandboxing is not allowed”, choose Compatibility playback.';
}

function playActive(season, episode) {
  if (!state.active) return;
  const item = { ...state.active, season, episode };
  state.playback = item;
  renderPlayback();
  storage.addHistory(item);
  renderLibrary();
  els.nextEpisode.hidden = item.mediaType !== 'tv';
  if (item.mediaType === 'tv') els.nextEpisode.dataset.episode = String(episode || 0);
}

function switchPlaybackProvider() {
  if (!state.playback || BUILTIN_PROVIDERS.length < 2) return;
  state.providerIndex = (state.providerIndex + 1) % BUILTIN_PROVIDERS.length;
  renderPlayback();
  setStatus(`${BUILTIN_PROVIDERS[state.providerIndex].label} selected.`, 'info');
}

function toggleCompatibilityPlayback() {
  if (!state.playback) return;
  if (!state.compatibilityMode) {
    const approved = window.confirm(
      'This provider may reject sandboxing. Compatibility playback removes iframe restrictions and can allow ads, popups, or redirects. Continue?'
    );
    if (!approved) return;
  }
  state.compatibilityMode = !state.compatibilityMode;
  renderPlayback();
}

function nextEpisode() {
  const current = Number(els.nextEpisode.dataset.episode || 0);
  const episodes = state.season?.episodes || [];
  const idx = episodes.findIndex(ep => ep.episode_number === current);
  if (idx >= 0 && idx + 1 < episodes.length) playActive(Number(els.seasons.value), episodes[idx + 1].episode_number);
  else setStatus('This is the last episode loaded for the season.', 'info');
}

async function reopenStoredItem(item) {
  const selection = librarySelection(item);
  if (!selection) return setStatus('This saved title has invalid metadata.', 'error');
  switchTab('discover');
  await openDetails({ media_type: selection.mediaType, id: selection.tmdbId }, {
    season: selection.season, episode: selection.episode
  });
}

function libraryCard(item, type) {
  const row = document.createElement('article');
  row.className = 'library-item';
  const open = document.createElement('button');
  open.className = 'library-open';
  open.type = 'button';
  const title = document.createElement('strong');
  title.textContent = item.title || 'Untitled';
  const meta = document.createElement('small');
  meta.textContent = `${item.mediaType === 'tv' ? 'TV' : 'Movie'}${item.season ? ` • S${item.season}E${item.episode}` : ''} • ${item.year || '—'}`;
  open.append(title, meta);
  open.setAttribute('aria-label', `Open ${item.title || 'saved title'}${item.season ? ` season ${item.season}, episode ${item.episode}` : ''}`);
  open.addEventListener('click', () => reopenStoredItem(item));
  row.append(open);
  if (type === 'watchlist') {
    const remove = document.createElement('button');
    remove.className = 'button button--quiet';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${item.title || 'title'} from watchlist`);
    remove.addEventListener('click', () => { storage.toggleWatchlist(item); renderLibrary(); });
    row.append(remove);
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
els.seasons.addEventListener('change', () => loadSeason(Number(els.seasons.value)));
els.nextEpisode.addEventListener('click', nextEpisode);
els.switchProvider.addEventListener('click', switchPlaybackProvider);
els.compatibility.addEventListener('click', toggleCompatibilityPlayback);
$('#clear-library').addEventListener('click', () => { storage.clearLibrary(); renderLibrary(); setStatus('Local library cleared.', 'success'); });
els.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

configureClient(); renderLibrary(); switchTab('discover');
if (!applyDeepLink() && state.client) loadCatalogue();
if (!state.client) setStatus('The catalogue could not be initialized.', 'error');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('./sw.js').catch(() => {});
