// ============================================================
// SİBERPORTAL — CVE TAKİP SİSTEMİ
// ============================================================
// Kaynak: NVD API 2.0
// Son 3 günde yayınlanan CVE'leri getirir.
// Arama + severity filtreleme + CVSS + NVD bağlantısı
// ============================================================

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

const DAYS_WINDOW = 3;

// Cache
const CACHE_KEY = 'siberportal_cve_cache_v3';
const CACHE_TTL = 10 * 60 * 1000; // 10 dakika

let allCves = [];
let activeSev = 'all';
let isLoading = false;


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const search = document.getElementById('cve-search');

  if (search) {
    search.addEventListener('input', renderCves);
  }

  document.querySelectorAll('[data-sev-filter]').forEach(btn => {

    btn.addEventListener('click', () => {

      activeSev = btn.dataset.sevFilter;

      document
        .querySelectorAll('[data-sev-filter]')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      renderCves();
    });

  });

  loadCves();

});


// ============================================================
// LOAD CVES
// ============================================================

async function loadCves() {

  if (isLoading) return;

  isLoading = true;

  const listEl = document.getElementById('cve-list');

  if (!listEl) {
    isLoading = false;
    return;
  }

  listEl.innerHTML = `
    <p class="state-msg">
      // NVD CVE veritabanı sorgulanıyor...
      <br>
      // Son ${DAYS_WINDOW} günün zafiyetleri getiriliyor...
    </p>
  `;


  // ----------------------------------------------------------
  // CACHE
  // ----------------------------------------------------------

  const cached = getCache();

  if (cached && Array.isArray(cached) && cached.length > 0) {

    allCves = cached;

    renderCves();

    isLoading = false;

    return;
  }


  // ----------------------------------------------------------
  // DATE RANGE
  // ----------------------------------------------------------

  const now = new Date();

  const start = new Date(
    now.getTime() - DAYS_WINDOW * 24 * 60 * 60 * 1000
  );

  // NVD API ISO formatı
  const pubStartDate = start.toISOString();
  const pubEndDate = now.toISOString();


  // ----------------------------------------------------------
  // API URL
  // ----------------------------------------------------------

  const url =
    `${NVD_API}?` +
    `pubStartDate=${encodeURIComponent(pubStartDate)}` +
    `&pubEndDate=${encodeURIComponent(pubEndDate)}` +
    `&resultsPerPage=2000`;


  try {

    console.log('[CVE] NVD sorgusu:', url);


    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });


    if (!response.ok) {

      throw new Error(
        `NVD API HTTP ${response.status}`
      );

    }


    const data = await response.json();


    if (
      !data ||
      !Array.isArray(data.vulnerabilities)
    ) {

      throw new Error(
        'NVD geçerli veri döndürmedi'
      );

    }


    // --------------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------------

    allCves = data.vulnerabilities
      .map(item => normalizeNVD(item))
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );


    // --------------------------------------------------------
    // CACHE
    // --------------------------------------------------------

    if (allCves.length > 0) {

      setCache(allCves);

    }


    console.log(
      `[CVE] ${allCves.length} CVE bulundu.`
    );


    renderCves();


  } catch (error) {

    console.error(
      '[CVE] API hatası:',
      error
    );


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    allCves = await loadFallback();

    if (allCves.length > 0) {

      renderCves();

    } else {

      listEl.innerHTML = `
        <div class="state-msg">

          <p>
            // CVE veritabanına şu anda ulaşılamadı.
          </p>

          <p style="margin-top:10px;">
            // NVD API bağlantısını kontrol et veya sayfayı yenile.
          </p>

          <a
            href="https://nvd.nist.gov/vuln/search"
            target="_blank"
            rel="noopener"
            style="
              display:inline-block;
              margin-top:15px;
              color:var(--green);
            "
          >
            → NVD CVE Database
          </a>

        </div>
      `;

    }

  } finally {

    isLoading = false;

  }

}


// ============================================================
// NORMALIZE NVD RECORD
// ============================================================

function normalizeNVD(item) {

  try {

    const cve = item.cve;

    if (!cve) return null;


    const id = cve.id;

    if (!id) return null;


    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    let description = '';

    if (
      Array.isArray(cve.descriptions)
    ) {

      const english =
        cve.descriptions.find(
          d => d.lang === 'en'
        );

      if (english) {

        description = english.value;

      } else if (
        cve.descriptions[0]
      ) {

        description =
          cve.descriptions[0].value;

      }

    }


    // --------------------------------------------------------
    // PUBLISHED
    // --------------------------------------------------------

    const date = cve.published;


    // --------------------------------------------------------
    // CVSS
    // --------------------------------------------------------

    const cvssData =
      getCVSS(cve);


    const score =
      cvssData?.baseScore ?? null;


    const severity =
      cvssData?.baseSeverity
        ? cvssData.baseSeverity.toLowerCase()
        : scoreToSeverity(score);


    // --------------------------------------------------------
    // CWE
    // --------------------------------------------------------

    let cwe = '';

    if (
      Array.isArray(cve.weaknesses)
    ) {

      for (const weakness of cve.weaknesses) {

        if (
          Array.isArray(
            weakness.description
          )
        ) {

          const found =
            weakness.description.find(
              d => d.lang === 'en'
            );

          if (found) {

            cwe = found.value;

            break;

          }

        }

      }

    }


    return {

      id,

      summary:
        description ||
        'Açıklama mevcut değil.',

      date,

      score,

      severity,

      cwe,

      link:
        `https://nvd.nist.gov/vuln/detail/${id}`

    };


  } catch (error) {

    console.error(
      '[CVE] Normalize error:',
      error
    );

    return null;

  }

}


// ============================================================
// GET CVSS
// ============================================================

function getCVSS(cve) {

  const metrics =
    cve.metrics;

  if (!metrics) return null;


  // CVSS 4.0
  if (
    Array.isArray(
      metrics.cvssMetricV40
    ) &&
    metrics.cvssMetricV40.length
  ) {

    return (
      metrics.cvssMetricV40[0]
        .cvssData
    );

  }


  // CVSS 3.1
  if (
    Array.isArray(
      metrics.cvssMetricV31
    ) &&
    metrics.cvssMetricV31.length
  ) {

    return (
      metrics.cvssMetricV31[0]
        .cvssData
    );

  }


  // CVSS 3.0
  if (
    Array.isArray(
      metrics.cvssMetricV30
    ) &&
    metrics.cvssMetricV30.length
  ) {

    return (
      metrics.cvssMetricV30[0]
        .cvssData
    );

  }


  // CVSS 2.0
  if (
    Array.isArray(
      metrics.cvssMetricV2
    ) &&
    metrics.cvssMetricV2.length
  ) {

    return (
      metrics.cvssMetricV2[0]
        .cvssData
    );

  }


  return null;

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
// RENDER
// ============================================================

function renderCves() {

  const listEl =
    document.getElementById(
      'cve-list'
    );

  if (!listEl) return;


  const searchInput =
    document.getElementById(
      'cve-search'
    );


  const query =
    (
      searchInput?.value || ''
    )
      .trim()
      .toLowerCase();


  let items =
    [...allCves];


  // ----------------------------------------------------------
  // SEVERITY FILTER
  // ----------------------------------------------------------

  if (activeSev !== 'all') {

    items =
      items.filter(
        cve =>
          cve.severity ===
          activeSev
      );

  }


  // ----------------------------------------------------------
  // SEARCH
  // ----------------------------------------------------------

  if (query) {

    items =
      items.filter(cve => {

        const text =
          `${cve.id} ${cve.summary} ${cve.cwe}`
            .toLowerCase();

        return text.includes(query);

      });

  }


  // ----------------------------------------------------------
  // EMPTY
  // ----------------------------------------------------------

  if (items.length === 0) {

    listEl.innerHTML = `

      <div class="state-msg">

        // Eşleşen CVE bulunamadı.

      </div>

    `;

    return;

  }


  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  listEl.innerHTML =
    items
      .map(renderCVE)
      .join('');

}


// ============================================================
// RENDER SINGLE CVE
// ============================================================

function renderCVE(cve) {

  const severity =
    (
      cve.severity ||
      'unknown'
    ).toLowerCase();


  const score =
    cve.score !== null &&
    cve.score !== undefined
      ? Number(cve.score).toFixed(1)
      : null;


  return `

    <article class="row">

      <div class="row-main">

        <p class="row-meta">

          <span>
            ${formatDate(cve.date)}
          </span>

          <span
            class="chip sev-${escapeAttr(
              severity
            )}"
          >
            ${severity.toUpperCase()}
            ${score ? ` · ${score}` : ''}
          </span>

          ${
            cve.cwe
              ? `
                <span class="chip">
                  ${escapeHtml(cve.cwe)}
                </span>
              `
              : ''
          }

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

          ${escapeHtml(
            cve.summary
          )}

        </p>


        <div
          style="
            margin-top:12px;
            font-family:'JetBrains Mono',monospace;
            font-size:11px;
            color:#64748b;
          "
        >

          <span>
            SOURCE: NVD
          </span>

          <span style="margin-left:15px;">
            →
            <a
              href="${escapeAttr(cve.link)}"
              target="_blank"
              rel="noopener noreferrer"
              style="color:var(--green);"
            >
              DETAYI GÖR
            </a>
          </span>

        </div>

      </div>

    </article>

  `;

}


// ============================================================
// FALLBACK
// ============================================================

async function loadFallback() {

  try {

    const response =
      await fetch(
        'content/data/cve-fallback.json',
        {
          cache: 'no-store'
        }
      );


    if (!response.ok) {

      return [];

    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      return [];

    }


    return data
      .map(item => {

        return {

          id:
            item.id ||
            item.cve_id,

          summary:
            item.summary ||
            item.description ||
            'Açıklama mevcut değil.',

          date:
            item.date ||
            item.published,

          score:
            item.score ?? null,

          severity:
            item.severity ||
            scoreToSeverity(
              item.score
            ),

          cwe:
            item.cwe || '',

          link:
            item.link ||
            `https://nvd.nist.gov/vuln/detail/${
              item.id ||
              item.cve_id
            }`

        };

      })
      .filter(
        item =>
          item.id &&
          item.summary
      );

  } catch (error) {

    console.error(
      '[CVE] Fallback error:',
      error
    );

    return [];

  }

}


// ============================================================
// CACHE
// ============================================================

function getCache() {

  try {

    const raw =
      localStorage.getItem(
        CACHE_KEY
      );


    if (!raw) return null;


    const parsed =
      JSON.parse(raw);


    if (
      !parsed ||
      !parsed.ts ||
      !Array.isArray(
        parsed.data
      )
    ) {

      return null;

    }


    if (
      Date.now() -
      parsed.ts >
      CACHE_TTL
    ) {

      localStorage.removeItem(
        CACHE_KEY
      );

      return null;

    }


    return parsed.data;

  } catch {

    return null;

  }

}


function setCache(data) {

  try {

    localStorage.setItem(

      CACHE_KEY,

      JSON.stringify({

        ts: Date.now(),

        data

      })

    );

  } catch {

    // localStorage kapalıysa sorun değil

  }

}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(date) {

  if (!date) return 'Tarih yok';


  try {

    return new Date(
      date
    ).toLocaleString(
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
// HTML ESCAPE
// ============================================================

function escapeHtml(value = '') {

  return String(value)
    .replace(
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
