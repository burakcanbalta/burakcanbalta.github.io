// Haberler sayfası — global siber güvenlik / hacker / zero-day haberleri
// Canlı veri: RSS2JSON proxy üzerinden ünlü güvenlik kaynaklarından çekilir.
// Ağ isteği başarısız olursa (CORS/limit) content/data/news-fallback.json kullanılır.

const FEEDS = [
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
];

const CACHE_KEY = 'sp_news_cache_v2';
const CACHE_TTL = 30 * 60 * 1000; // 30 dk
const DAYS_WINDOW = 2; // son N gün

let allItems = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  loadNews();
  document.getElementById('news-search')?.addEventListener('input', renderNews);
  document.querySelectorAll('[data-source-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.sourceFilter;
      document.querySelectorAll('[data-source-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNews();
    });
  });
});

async function loadNews() {
  const listEl = document.getElementById('news-list');
  listEl.innerHTML = `<p class="state-msg">// haberler yükleniyor...</p>`;

  const cached = getCache();
  if (cached) {
    allItems = cached;
    renderNews();
    return;
  }

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const items = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    if (items.length === 0) throw new Error('no live items');

    const cutoff = Date.now() - DAYS_WINDOW * 24 * 60 * 60 * 1000;
    const recent = items.filter(i => {
      const t = new Date(i.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const finalItems = recent.length > 0 ? recent : items; // hiç son 2 günlük haber yoksa, en güncel olanları göster
    finalItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    allItems = finalItems.slice(0, 40);
    setCache(allItems);
  } catch (err) {
    allItems = await loadFallback();
  }
  renderNews();
}

async function fetchFeed(feed) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('feed fetch failed: ' + feed.name);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('feed status not ok: ' + feed.name);
  return (data.items || []).slice(0, 15).map(it => ({
    title: it.title,
    link: it.link,
    date: it.pubDate,
    source: feed.name,
    desc: stripHtml(it.description || '').slice(0, 180),
  }));
}

async function loadFallback() {
  try {
    const res = await fetch('content/data/news-fallback.json');
    return await res.json();
  } catch {
    return [];
  }
}

function renderNews() {
  const listEl = document.getElementById('news-list');
  const q = (document.getElementById('news-search')?.value || '').toLowerCase();

  let items = allItems;
  if (activeFilter !== 'all') items = items.filter(i => i.source === activeFilter);
  if (q) items = items.filter(i => (i.title + i.desc).toLowerCase().includes(q));

  if (items.length === 0) {
    listEl.innerHTML = `<p class="state-msg">// eşleşen haber bulunamadı</p>`;
    return;
  }

  listEl.innerHTML = items.map(i => `
    <div class="row">
      <div class="row-main">
        <p class="row-meta">
          <span>${formatDate(i.date)}</span>
        </p>
        <h3 class="row-title"><a href="${escapeAttr(i.link)}" target="_blank" rel="noopener">${escapeHtml(i.title)}</a></h3>
        <p class="row-desc">${escapeHtml(i.desc)}${i.desc ? '…' : ''}</p>
      </div>
      <div class="row-side"><span class="source-pill">${escapeHtml(i.source)}</span></div>
    </div>
  `).join('');
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function setCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
function formatDate(d) { try { return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s='') { return escapeHtml(s); }
