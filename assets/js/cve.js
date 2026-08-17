// CVE sayfası — güncel zafiyetler (son 2 gün)
// Canlı veri: CIRCL CVE-Search API (CORS destekli, anahtar gerekmez).
// Başarısız olursa veya hiç geçerli kayıt bulunamazsa content/data/cve-fallback.json kullanılır.

const CVE_API = 'https://cve.circl.lu/api/last';
const CACHE_KEY = 'sp_cve_cache_v2';
const CACHE_TTL = 20 * 60 * 1000; // 20 dk
const DAYS_WINDOW = 2; // son N gün

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
  listEl.innerHTML = `<p class="state-msg">// CVE veritabanı sorgulanıyor (son ${DAYS_WINDOW} gün)...</p>`;

  const cached = getCache();
  if (cached) { allCves = cached; renderCves(); return; }

  try {
    const res = await fetch(CVE_API);
    if (!res.ok) throw new Error('cve api failed');
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty cve data');

    const cutoff = Date.now() - DAYS_WINDOW * 24 * 60 * 60 * 1000;

    allCves = raw
      .map(normalizeCircl)
      .filter(isValidRecord)
      .filter(i => new Date(i.date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allCves.length === 0) throw new Error('no cves in window');
    setCache(allCves);
  } catch (err) {
    allCves = await loadFallback();
  }
  renderCves();
}

// CIRCL /api/last bazı kayıtlarda farklı şemalar (klasik cve-search alanları ya da
// CVE Services 5.0 / cveMetadata+containers şeması) döndürebiliyor. İkisini de dener.
function normalizeCircl(item) {
  const id =
    item.id ||
    item.cveMetadata?.cveId ||
    item.cveID ||
    null;

  const summary =
    item.summary ||
    item.containers?.cna?.descriptions?.find(d => d.lang === 'en')?.value ||
    item.containers?.cna?.descriptions?.[0]?.value ||
    null;

  const date =
    item.Published ||
    item.published ||
    item.cveMetadata?.datePublished ||
    item.datePublished ||
    null;

  const score = item.cvss || item.cvss3 || (item.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore) || null;

  return {
    id,
    summary,
    date,
    score,
    severity: scoreToSeverity(score),
    link: buildLink(id),
  };
}

// id ve açıklaması olmayan (henüz "reserved"/boş) kayıtları listeye hiç almıyoruz.
function isValidRecord(i) {
  return !!i.id && !!i.summary && !!i.date && !isNaN(new Date(i.date).getTime());
}

function buildLink(id) {
  if (!id) return '#';
  if (/^CVE-/i.test(id)) return `https://nvd.nist.gov/vuln/detail/${id}`;
  if (/^PYSEC-/i.test(id)) return `https://osv.dev/vulnerability/${id}`;
  if (/^GHSA-/i.test(id)) return `https://github.com/advisories/${id}`;
  return `https://osv.dev/vulnerability/${id}`;
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
