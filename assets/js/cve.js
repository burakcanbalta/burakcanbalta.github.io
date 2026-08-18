// ============================================================
// SİBERPORTAL — CVE TAKİBİ
// NVD API 2.0
// Son 24 saatte yayınlanan CVE'ler
// ============================================================

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

const CACHE_KEY = 'siberportal_cve_cache_v5';
const CACHE_TTL = 10 * 60 * 1000; // 10 dakika

// SADECE SON 24 SAAT
const HOURS_WINDOW = 24;

let allCves = [];
let activeSeverity = 'all';
let isLoading = false;


// ============================================================
// BAŞLANGIÇ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const searchInput = document.getElementById('cve-search');

  if (searchInput) {
    searchInput.addEventListener('input', renderCves);
  }

  document.querySelectorAll('[data-sev-filter]').forEach(button => {

    button.addEventListener('click', () => {

      activeSeverity = button.dataset.sevFilter || 'all';

      document
        .querySelectorAll('[data-sev-filter]')
        .forEach(btn => btn.classList.remove('active'));

      button.classList.add('active');

      renderCves();
    });

  });

  loadCves();
});


// ============================================================
// CVE'LERİ ÇEK
// ============================================================

async function loadCves() {

  if (isLoading) return;

  isLoading = true;

  const list = document.getElementById('cve-list');

  if (!list) {
    console.error('cve-list bulunamadı.');
    isLoading = false;
    return;
  }

  list.innerHTML = `
    <div class="state-msg">
      // NVD CVE veritabanı sorgulanıyor...<br>
      // Son 24 saatin zafiyetleri getiriliyor...
    </div>
  `;

  // ----------------------------------------------------------
  // CACHE
  // ----------------------------------------------------------

  const cached = getCache();

  if (cached && Array.isArray(cached) && cached.length > 0) {

    console.log('[CVE] Cache kullanılıyor:', cached.length);

    allCves = cached;

    renderCves();

    isLoading = false;

    // Cache arka planda güncellensin
    setTimeout(() => {
      fetchFreshCves();
    }, 100);

    return;
  }

  await fetchFreshCves();

  isLoading = false;
}


// ============================================================
// NVD'DEN GÜNCEL VERİ ÇEK
// ============================================================

async function fetchFreshCves() {

  const list = document.getElementById('cve-list');

  try {

    const now = new Date();

    // Son 24 saat
    const start = new Date(
      now.getTime() - HOURS_WINDOW * 60 * 60 * 1000
    );

    // NVD tarih formatı:
    // 2026-08-18T00:00:00.000Z

    const pubStartDate = start.toISOString();
    const pubEndDate = now.toISOString();

    const params = new URLSearchParams({

      pubStartDate: pubStartDate,
      pubEndDate: pubEndDate,

      // Maksimum sayfa boyutu
      resultsPerPage: '2000',

      // En güncel kayıtlar
      startIndex: '0'

    });

    const url = `${NVD_API}?${params.toString()}`;

    console.log('[CVE] NVD sorgusu:');
    console.log(url);

    const controller = new AbortController();

    // 20 saniye timeout
    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    const response = await fetch(url, {

      method: 'GET',

      headers: {
        'Accept': 'application/json'
      },

      signal: controller.signal

    });

    clearTimeout(timeout);

    if (!response.ok) {

      throw new Error(
        `NVD HTTP ${response.status}`
      );

    }

    const data = await response.json();

    console.log(
      '[CVE] NVD toplam sonuç:',
      data.totalResults
    );

    if (!Array.isArray(data.vulnerabilities)) {

      throw new Error(
        'NVD beklenen veri formatını döndürmedi.'
      );

    }

    // --------------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------------

    allCves = data.vulnerabilities

      .map(item => normalizeNvdCve(item))

      .filter(Boolean)

      // Güvenlik için tekrar son 24 saat kontrolü
      .filter(cve => {

        if (!cve.published) return false;

        const date = new Date(cve.published);

        return (
          !isNaN(date.getTime()) &&
          date >= start &&
          date <= now
        );

      })

      // En yeni önce
      .sort(
        (a, b) =>
          new Date(b.published) -
          new Date(a.published)
      );

    console.log(
      '[CVE] Son 24 saatte:',
      allCves.length
    );

    // --------------------------------------------------------
    // SONUÇ
    // --------------------------------------------------------

    if (allCves.length === 0) {

      list.innerHTML = `
        <div class="state-msg">
          // Son 24 saat içinde yayınlanmış CVE bulunamadı.
        </div>
      `;

      return;
    }

    setCache(allCves);

    renderCves();

  } catch (error) {

    console.error('[CVE] NVD bağlantı hatası:', error);

    // --------------------------------------------------------
    // CACHE VARSA KULLAN
    // --------------------------------------------------------

    const oldCache = getCache(true);

    if (
      oldCache &&
      Array.isArray(oldCache) &&
      oldCache.length > 0
    ) {

      allCves = oldCache;

      renderCves();

      return;
    }

    // --------------------------------------------------------
    // HATA
    // --------------------------------------------------------

    let message =
      '// NVD CVE veritabanına ulaşılamadı.';

    if (error.name === 'AbortError') {

      message +=
        '<br>// İstek zaman aşımına uğradı.';

    } else {

      message +=
        '<br>// Daha sonra tekrar deneyin.';
    }

    list.innerHTML = `
      <div class="state-msg">
        ${message}
        <br><br>
        <span style="opacity:.65;">
          // NVD API: services.nvd.nist.gov
        </span>
      </div>
    `;

  }

}


// ============================================================
// NVD CVE NORMALIZE
// ============================================================

function normalizeNvdCve(item) {

  try {

    const cve = item?.cve;

    if (!cve) return null;

    const id = cve.id;

    if (!id) return null;

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    let description = '';

    if (Array.isArray(cve.descriptions)) {

      const english =
        cve.descriptions.find(
          d => d.lang === 'en'
        );

      description =
        english?.value ||
        cve.descriptions[0]?.value ||
        '';

    }

    // --------------------------------------------------------
    // PUBLISHED
    // --------------------------------------------------------

    const published =
      cve.published ||
      null;

    // --------------------------------------------------------
    // CVSS
    // --------------------------------------------------------

    const cvss = extractCvss(cve);

    // --------------------------------------------------------
    // SEVERITY
    // --------------------------------------------------------

    let severity =
      cvss.severity ||
      scoreToSeverity(cvss.score);

    // --------------------------------------------------------
    // REFERENCES
    // --------------------------------------------------------

    const references =
      Array.isArray(cve.references)
        ? cve.references
            .map(ref => ref.url)
            .filter(Boolean)
        : [];

    return {

      id: id,

      description: description,

      published: published,

      score: cvss.score,

      severity: severity,

      references: references,

      link:
        `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`

    };

  } catch (error) {

    console.error(
      '[CVE] Normalize hatası:',
      error
    );

    return null;

  }

}


// ============================================================
// CVSS ÇIKAR
// ============================================================

function extractCvss(cve) {

  try {

    const metrics = cve.metrics || {};

    // CVSS v4
    if (
      Array.isArray(metrics.cvssMetricV40) &&
      metrics.cvssMetricV40.length
    ) {

      const metric =
        metrics.cvssMetricV40[0];

      const data =
        metric.cvssData;

      return {

        score:
          data?.baseScore ?? null,

        severity:
          (
            data?.baseSeverity ||
            metric?.baseSeverity ||
            ''
          ).toLowerCase()

      };

    }


    // CVSS v3.1
    if (
      Array.isArray(metrics.cvssMetricV31) &&
      metrics.cvssMetricV31.length
    ) {

      const metric =
        metrics.cvssMetricV31[0];

      const data =
        metric.cvssData;

      return {

        score:
          data?.baseScore ?? null,

        severity:
          (
            data?.baseSeverity ||
            metric?.baseSeverity ||
            ''
          ).toLowerCase()

      };

    }


    // CVSS v3.0
    if (
      Array.isArray(metrics.cvssMetricV30) &&
      metrics.cvssMetricV30.length
    ) {

      const metric =
        metrics.cvssMetricV30[0];

      const data =
        metric.cvssData;

      return {

        score:
          data?.baseScore ?? null,

        severity:
          (
            data?.baseSeverity ||
            metric?.baseSeverity ||
            ''
          ).toLowerCase()

      };

    }


    // CVSS v2
    if (
      Array.isArray(metrics.cvssMetricV2) &&
      metrics.cvssMetricV2.length
    ) {

      const metric =
        metrics.cvssMetricV2[0];

      const data =
        metric.cvssData;

      return {

        score:
          data?.baseScore ?? null,

        severity:
          scoreToSeverity(data?.baseScore)

      };

    }

  } catch (error) {

    console.error(
      '[CVE] CVSS parse hatası:',
      error
    );

  }

  return {

    score: null,

    severity: 'unknown'

  };

}


// ============================================================
// SCORE → SEVERITY
// ============================================================

function scoreToSeverity(score) {

  const s =
    parseFloat(score);

  if (isNaN(s)) {
    return 'unknown';
  }

  if (s >= 9.0) {
    return 'critical';
  }

  if (s >= 7.0) {
    return 'high';
  }

  if (s >= 4.0) {
    return 'medium';
  }

  return 'low';

}


// ============================================================
// CVE RENDER
// ============================================================

function renderCves() {

  const list =
    document.getElementById('cve-list');

  if (!list) return;

  const search =
    (
      document.getElementById('cve-search')
        ?.value || ''
    )
      .trim()
      .toLowerCase();


  let items =
    [...allCves];


  // ----------------------------------------------------------
  // SEVERITY
  // ----------------------------------------------------------

  if (activeSeverity !== 'all') {

    items =
      items.filter(
        cve =>
          cve.severity === activeSeverity
      );

  }


  // ----------------------------------------------------------
  // SEARCH
  // ----------------------------------------------------------

  if (search) {

    items =
      items.filter(cve => {

        const text =
          `${cve.id} ${cve.description}`
            .toLowerCase();

        return text.includes(search);

      });

  }


  // ----------------------------------------------------------
  // EMPTY
  // ----------------------------------------------------------

  if (items.length === 0) {

    list.innerHTML = `
      <div class="state-msg">
        // Eşleşen CVE bulunamadı.
      </div>
    `;

    return;

  }


  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  list.innerHTML =
    items.map(renderCve).join('');

}


// ============================================================
// TEK CVE HTML
// ============================================================

function renderCve(cve) {

  const severity =
    cve.severity || 'unknown';

  const score =
    cve.score !== null &&
    cve.score !== undefined
      ? ` · ${cve.score}`
      : '';

  const description =
    cve.description || 'Açıklama bulunamadı.';

  const shortDescription =
    description.length > 260
      ? description.slice(0, 260) + '…'
      : description;


  return `

    <article class="row">

      <div class="row-main">

        <p class="row-meta">

          <span>
            ${formatDate(cve.published)}
          </span>

          <span class="chip sev-${escapeHtml(severity)}">
            ${escapeHtml(severity.toUpperCase())}${score}
          </span>

        </p>


        <h3 class="row-title">

          <a
            href="${escapeAttr(cve.link)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(cve.id)}
          </a>

        </h3>


        <p class="row-desc">
          ${escapeHtml(shortDescription)}
        </p>


        <div
          style="
            margin-top:12px;
            font-family:'JetBrains Mono',monospace;
            font-size:11px;
            opacity:.55;
          "
        >
          NVD →
        </div>

      </div>

    </article>

  `;

}


// ============================================================
// TARİH
// ============================================================

function formatDate(date) {

  if (!date) {
    return '';
  }

  try {

    return new Date(date).toLocaleString(
      'tr-TR',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  } catch {

    return date;

  }

}


// ============================================================
// CACHE
// ============================================================

function getCache(ignoreExpiry = false) {

  try {

    const raw =
      localStorage.getItem(CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      !Array.isArray(parsed.data)
    ) {

      return null;

    }

    if (!ignoreExpiry) {

      if (
        Date.now() - parsed.timestamp >
        CACHE_TTL
      ) {

        return null;

      }

    }

    return parsed.data;

  } catch {

    return null;

  }

}


// ============================================================
// CACHE YAZ
// ============================================================

function setCache(data) {

  try {

    localStorage.setItem(

      CACHE_KEY,

      JSON.stringify({

        timestamp: Date.now(),

        data: data

      })

    );

  } catch (error) {

    console.warn(
      '[CVE] Cache yazılamadı:',
      error
    );

  }

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value = '') {

  return String(value).replace(

    /[&<>"']/g,

    char => ({

      '&': '&amp;',

      '<': '&lt;',

      '>': '&gt;',

      '"': '&quot;',

      "'": '&#39;'

    }[char])

  );

}


function escapeAttr(value = '') {

  return escapeHtml(value);

}
