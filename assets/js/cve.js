// CVE sayfası — güncel zafiyetler
// Canlı veri: CIRCL CVE-Search API (CORS destekli, anahtar gerekmez).
// Başarısız olursa content/data/cve-fallback.json kullanılır.

const CVE_API = 'https://cve.circl.lu/api/last';
const CACHE_KEY = 'sp_cve_cache_v1';
const CACHE_TTL = 20 * 60 * 1000; // 20 dk

let allCves = [];
let activeSev = 'all';

document.addEventListener('DOMContentLoaded', () => {
  loadCves();
  document.getElementById('cve-search')?.addEventListener('input', renderCves);
  document.querySelectorAll('[data-sev-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSev = btn.dataset.sevFilter;
      document.querySelectorAll('[data-sev-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCves();
    });
  });
});

async function loadCves() {
  const listEl = document.getElementById('cve-list');
  listEl.innerHTML = `<p class="state-msg">// CVE veritabanı sorgulanıyor...</p>`;

  const cached = getCache();
  if (cached) { allCves = cached; renderCves(); return; }

  try {
    const res = await fetch(CVE_API);
    if (!res.ok) throw new Error('cve api failed');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty cve data');

    allCves = data.slice(0, 40).map(normalizeCircl);
    setCache(allCves);
  } catch (err) {
    allCves = await loadFallback();
  }
  renderCves();
}

function normalizeCircl(item) {
  const score = item.cvss || (item.cvss3 && item.cvss3.baseScore) || null;
  return {
    id: item.id || item.cveID || item.cveMetadata?.cveId || 'CVE-UNKNOWN',
    summary: item.summary || item.containers?.cna?.descriptions?.[0]?.value || 'Açıklama mevcut değil.',
    date: item.Published || item.published || item.datePublished || new Date().toISOString(),
    score: score,
    severity: scoreToSeverity(score),
    link: item.id ? `https://nvd.nist.gov/vuln/detail/${item.id}` : '#',
  };
}

function scoreToSeverity(score) {
  const s = parseFloat(score);
  if (isNaN(s)) return 'unknown';
  if (s >= 9) return 'critical';
  if (s >= 7) return 'high';
  if (s >= 4) return 'medium';
  return 'low';
}

async function loadFallback() {
  try {
    const res = await fetch('content/data/cve-fallback.json');
    return await res.json();
  } catch { return []; }
}

function renderCves() {
  const listEl = document.getElementById('cve-list');
  const q = (document.getElementById('cve-search')?.value || '').toLowerCase();

  let items = allCves;
  if (activeSev !== 'all') items = items.filter(i => i.severity === activeSev);
  if (q) items = items.filter(i => (i.id + i.summary).toLowerCase().includes(q));

  if (items.length === 0) {
    listEl.innerHTML = `<p class="state-msg">// eşleşen CVE bulunamadı</p>`;
    return;
  }

  listEl.innerHTML = items.map(i => `
    <div class="row">
      <div class="row-main">
        <p class="row-meta">
          <span>${formatDate(i.date)}</span>
          <span class="chip sev-${i.severity}">${(i.severity || 'n/a').toUpperCase()}${i.score ? ' · ' + i.score : ''}</span>
        </p>
        <h3 class="row-title"><a href="${escapeAttr(i.link)}" target="_blank" rel="noopener">${escapeHtml(i.id)}</a></h3>
        <p class="row-desc">${escapeHtml((i.summary || '').slice(0, 220))}${(i.summary || '').length > 220 ? '…' : ''}</p>
      </div>
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
function setCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {} }
function formatDate(d) { try { return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s='') { return escapeHtml(s); }
