const CVE_API = 'https://cve.circl.lu/api/last';

// Cache
const CACHE_KEY = 'sp_cve_cache_v3';
const CACHE_TTL = 20 * 60 * 1000; // 20 dakika

// Sadece son 24 saat
const DAYS_WINDOW = 1;

let allCves = [];
let activeSev = 'all';

// ============================================================
// SAYFA BAŞLANGICI
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadCves();

  // Arama
  const searchInput = document.getElementById('cve-search');

  if (searchInput) {
    searchInput.addEventListener('input', renderCves);
  }

  // Severity filtreleri
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
});

// ============================================================
// CVE VERİLERİNİ ÇEK
// ============================================================

async function loadCves() {

  const listEl = document.getElementById('cve-list');

  if (!listEl) return;

  listEl.innerHTML = `
    <p class="state-msg">
      // CVE veritabanı sorgulanıyor (son 24 saat)...
    </p>
  `;

  // ----------------------------------------------------------
  // CACHE KONTROLÜ
  // ----------------------------------------------------------

  const cached = getCache();

  if (cached && Array.isArray(cached) && cached.length > 0) {

    // Cache'in de gerçekten son 24 saat olduğundan emin ol
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);

    allCves = cached
      .filter(item => {
        const time = new Date(item.date).getTime();
        return !isNaN(time) && time >= cutoff;
      })
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

    renderCves();
    return;
  }

  // ----------------------------------------------------------
  // CANLI API
  // ----------------------------------------------------------

  try {

    const res = await fetch(CVE_API, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`CIRCL API HTTP ${res.status}`);
    }

    const raw = await res.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('CIRCL API boş veri döndürdü');
    }

    // --------------------------------------------------------
    // SON 24 SAAT
    // --------------------------------------------------------

    const cutoff =
      Date.now() -
      (DAYS_WINDOW * 24 * 60 * 60 * 1000);

    allCves = raw
      .map(normalizeCircl)
      .filter(isValidRecord)
      .filter(item => {

        const publishedTime =
          new Date(item.date).getTime();

        return (
          !isNaN(publishedTime) &&
          publishedTime >= cutoff &&
          publishedTime <= Date.now()
        );
      })
      .sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

    // --------------------------------------------------------
    // HİÇ CVE YOKSA FALLBACK
    // --------------------------------------------------------

    if (allCves.length === 0) {
      throw new Error(
        'Son 24 saat içerisinde geçerli CVE bulunamadı'
      );
    }

    // Cache'e kaydet
    setCache(allCves);

  } catch (error) {

    console.error(
      '[CVE] Canlı API hatası:',
      error
    );

    allCves = await loadFallback();

  }

  renderCves();
}

// ============================================================
// CIRCL VERİSİNİ NORMALIZE ET
// ============================================================

function normalizeCircl(item) {

  // ----------------------------------------------------------
  // CVE ID
  // ----------------------------------------------------------

  const id =
    item.id ||
    item.cveMetadata?.cveId ||
    item.cveID ||
    item.cve?.id ||
    null;

  // ----------------------------------------------------------
  // AÇIKLAMA
  // ----------------------------------------------------------

  const summary =
    item.summary ||
    item.description ||
    item.cve?.description ||
    item.containers?.cna?.descriptions
      ?.find(d => d.lang === 'en')
      ?.value ||
    item.containers?.cna?.descriptions?.[0]?.value ||
    null;

  // ----------------------------------------------------------
  // YAYIN TARİHİ
  // ----------------------------------------------------------

  const date =
    item.Published ||
    item.published ||
    item.publishedDate ||
    item.datePublished ||
    item.cveMetadata?.datePublished ||
    item.cve?.published ||
    null;

  // ----------------------------------------------------------
  // CVSS
  // ----------------------------------------------------------

  let score =
    item.cvss ||
    item.cvss3 ||
    item.cvssV3 ||
    item.cvss_v3 ||
    item.baseScore ||
    null;

  // CVE Services 5.0
  if (
    !score &&
    item.metrics?.cvssMetricV31?.length
  ) {
    score =
      item.metrics.cvssMetricV31[0]
        ?.cvssData
        ?.baseScore;
  }

  if (
    !score &&
    item.metrics?.cvssMetricV30?.length
  ) {
    score =
      item.metrics.cvssMetricV30[0]
        ?.cvssData
        ?.baseScore;
  }

  // ----------------------------------------------------------
  // SEVERITY
  // ----------------------------------------------------------

  let severity =
    item.severity ||
    item.cvssSeverity ||
    null;

  if (!severity) {
    severity = scoreToSeverity(score);
  }

  // ----------------------------------------------------------
  // KAYNAK
  // ----------------------------------------------------------

  const source =
    item.source ||
    item.sourceIdentifier ||
    'CIRCL';

  return {

    id: id,

    summary: summary,

    date: date,

    score: score,

    severity:
      String(severity).toLowerCase(),

    source: source,

    link: buildLink(id)

  };
}

// ============================================================
// GEÇERLİ KAYIT KONTROLÜ
// ============================================================

function isValidRecord(item) {

  if (!item) return false;

  if (!item.id) return false;

  if (!item.summary) return false;

  if (!item.date) return false;

  const timestamp =
    new Date(item.date).getTime();

  if (isNaN(timestamp)) {
    return false;
  }

  // Sadece gerçek CVE kayıtları
  if (
    !/^CVE-\d{4}-\d+/i.test(item.id)
  ) {
    return false;
  }

  return true;
}

// ============================================================
// CVE LINK
// ============================================================

function buildLink(id) {

  if (!id) {
    return '#';
  }

  // CVE → NVD
  if (/^CVE-/i.test(id)) {

    return (
      'https://nvd.nist.gov/vuln/detail/' +
      encodeURIComponent(id)
    );

  }

  // PYSEC
  if (/^PYSEC-/i.test(id)) {

    return (
      'https://osv.dev/vulnerability/' +
      encodeURIComponent(id)
    );

  }

  // GHSA
  if (/^GHSA-/i.test(id)) {

    return (
      'https://github.com/advisories/' +
      encodeURIComponent(id)
    );

  }

  // Diğerleri
  return (
    'https://osv.dev/vulnerability/' +
    encodeURIComponent(id)
  );
}

// ============================================================
// CVSS → SEVERITY
// ============================================================

function scoreToSeverity(score) {

  const s = parseFloat(score);

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
// FALLBACK
// ============================================================

async function loadFallback() {

  try {

    const res =
      await fetch(
        'content/data/cve-fallback.json',
        {
          cache: 'no-store'
        }
      );

    if (!res.ok) {
      throw new Error('Fallback bulunamadı');
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return [];
    }

    // Fallback'i de son 24 saat ile sınırla
    const cutoff =
      Date.now() -
      (DAYS_WINDOW * 24 * 60 * 60 * 1000);

    return data
      .map(normalizeCircl)
      .filter(isValidRecord)
      .filter(item => {

        const time =
          new Date(item.date).getTime();

        return (
          !isNaN(time) &&
          time >= cutoff &&
          time <= Date.now()
        );
      })
      .sort((a, b) => {
        return new Date(b.date) -
               new Date(a.date);
      });

  } catch (error) {

    console.error(
      '[CVE] Fallback hatası:',
      error
    );

    return [];
  }
}

// ============================================================
// CVE LİSTESİNİ OLUŞTUR
// ============================================================

function renderCves() {

  const listEl =
    document.getElementById('cve-list');

  if (!listEl) return;

  const searchInput =
    document.getElementById('cve-search');

  const q =
    (
      searchInput?.value ||
      ''
    )
      .trim()
      .toLowerCase();

  // ----------------------------------------------------------
  // FİLTRELE
  // ----------------------------------------------------------

  let items = [...allCves];

  // Severity
  if (activeSev !== 'all') {

    items =
      items.filter(
        item =>
          item.severity === activeSev
      );

  }

  // Arama
  if (q) {

    items =
      items.filter(item => {

        const id =
          String(item.id || '')
            .toLowerCase();

        const summary =
          String(item.summary || '')
            .toLowerCase();

        return (
          id.includes(q) ||
          summary.includes(q)
        );

      });

  }

  // ----------------------------------------------------------
  // BOŞ SONUÇ
  // ----------------------------------------------------------

  if (items.length === 0) {

    listEl.innerHTML = `
      <div class="state-msg">
        // Son 24 saat içerisinde
        eşleşen CVE bulunamadı.
      </div>
    `;

    return;
  }

  // ----------------------------------------------------------
  // HTML
  // ----------------------------------------------------------

  listEl.innerHTML =
    items.map(item => {

      const severity =
        item.severity || 'unknown';

      const score =
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ''
          ? ` · ${escapeHtml(String(item.score))}`
          : '';

      const description =
        String(item.summary || '');

      const shortDescription =
        description.length > 260
          ? description.slice(0, 260) + '…'
          : description;

      return `
        <article class="row">

          <div class="row-main">

            <p class="row-meta">

              <span>
                ${formatDate(item.date)}
              </span>

              <span class="chip sev-${escapeAttr(severity)}">
                ${escapeHtml(
                  severity.toUpperCase()
                )}${score}
              </span>

            </p>

            <h3 class="row-title">

              <a
                href="${escapeAttr(item.link)}"
                target="_blank"
                rel="noopener noreferrer"
                title="NVD'de görüntüle"
              >
                ${escapeHtml(item.id)}
              </a>

            </h3>

            <p class="row-desc">
              ${escapeHtml(shortDescription)}
            </p>

            <div class="cve-source">

              <span>
                Kaynak:
                ${escapeHtml(
                  item.source || 'CIRCL'
                )}
              </span>

              <a
                href="${escapeAttr(item.link)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Detay →
              </a>

            </div>

          </div>

        </article>
      `;

    }).join('');
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

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      !parsed.ts ||
      !Array.isArray(parsed.data)
    ) {
      return null;
    }

    // Cache süresi
    if (
      Date.now() - parsed.ts >
      CACHE_TTL
    ) {
      localStorage.removeItem(
        CACHE_KEY
      );

      return null;
    }

    return parsed.data;

  } catch (error) {

    console.warn(
      '[CVE] Cache okunamadı:',
      error
    );

    return null;
  }
}

// ============================================================
// CACHE KAYDET
// ============================================================

function setCache(data) {

  try {

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data: data
      })
    );

  } catch (error) {

    console.warn(
      '[CVE] Cache kaydedilemedi:',
      error
    );

  }
}

// ============================================================
// TARİH FORMATLAMA
// ============================================================

function formatDate(dateString) {

  if (!dateString) {
    return 'Tarih bilinmiyor';
  }

  try {

    const date =
      new Date(dateString);

    if (isNaN(date.getTime())) {
      return 'Tarih bilinmiyor';
    }

    return date.toLocaleDateString(
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

    return dateString;
  }
}

// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value = '') {

  return String(value).replace(
    /[&<>"']/g,
    char => {

      const map = {

        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'

      };

      return map[char];
    }
  );
}

// ============================================================
// ATTRIBUTE ESCAPE
// ============================================================

function escapeAttr(value = '') {

  return escapeHtml(value);
}

// ============================================================
// MANUEL CACHE TEMİZLEME
// Konsoldan:
// clearCveCache()
// ============================================================

function clearCveCache() {

  try {

    localStorage.removeItem(
      CACHE_KEY
    );

    console.log(
      '[CVE] Cache temizlendi.'
    );

    location.reload();

  } catch (error) {

    console.error(
      '[CVE] Cache temizlenemedi:',
      error
    );

  }
}
