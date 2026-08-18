/*
 * ============================================================
 * SİBERPORTAL — LIVE CVE TRACKER
 * ============================================================
 *
 * Kaynak:
 *   CIRCL / Vulnerability-Lookup API
 *
 * Görev:
 *   - Son 3 günde yayınlanan CVE'leri getir
 *   - CVSS skorlarını normalize et
 *   - Severity filtrele
 *   - Arama
 *   - NVD / CIRCL bağlantıları
 *   - LocalStorage cache
 *   - API başarısız olursa fallback JSON
 *
 * GitHub Pages uyumlu — backend gerektirmez.
 * ============================================================
 */

(() => {
  'use strict';

  /* ==========================================================
     CONFIG
     ========================================================== */

  const API_BASE = 'https://cve.circl.lu/api';

  // Son kaç gün?
  const DAYS_WINDOW = 3;

  // CIRCL API maksimum 100 kayıt döndürüyor.
  // Sayfalama ile daha fazlasını çekiyoruz.
  const PER_PAGE = 100;

  // Güvenlik amacıyla maksimum sayfa.
  const MAX_PAGES = 10;

  // Cache: 20 dakika
  const CACHE_KEY = 'sp_cve_cache_v4';
  const CACHE_TTL = 20 * 60 * 1000;

  // Otomatik yenileme: 20 dakika
  const AUTO_REFRESH_INTERVAL = 20 * 60 * 1000;

  // State
  let allCves = [];
  let activeSev = 'all';
  let loading = false;


  /* ==========================================================
     INIT
     ========================================================== */

  document.addEventListener('DOMContentLoaded', () => {

    setupSearch();

    setupSeverityFilters();

    loadCves();

    // Sayfa açık kaldığı sürece otomatik güncelle
    setInterval(() => {
      loadCves(true);
    }, AUTO_REFRESH_INTERVAL);

  });


  /* ==========================================================
     SEARCH
     ========================================================== */

  function setupSearch() {

    const search = document.getElementById('cve-search');

    if (!search) return;

    search.addEventListener('input', () => {
      renderCves();
    });

  }


  /* ==========================================================
     SEVERITY FILTER
     ========================================================== */

  function setupSeverityFilters() {

    const buttons = document.querySelectorAll('[data-sev-filter]');

    buttons.forEach(button => {

      button.addEventListener('click', () => {

        activeSev = (
          button.dataset.sevFilter || 'all'
        ).toLowerCase();

        buttons.forEach(btn => {
          btn.classList.remove('active');
        });

        button.classList.add('active');

        renderCves();

      });

    });

  }


  /* ==========================================================
     MAIN LOADER
     ========================================================== */

  async function loadCves(forceRefresh = false) {

    if (loading) return;

    loading = true;

    const listEl = document.getElementById('cve-list');

    if (!listEl) {
      loading = false;
      return;
    }

    if (!forceRefresh) {

      listEl.innerHTML = `
        <p class="state-msg">
          // CVE veritabanı sorgulanıyor...
        </p>
      `;

    }

    /*
     * --------------------------------------------------------
     * CACHE
     * --------------------------------------------------------
     */

    if (!forceRefresh) {

      const cached = getCache();

      if (cached && Array.isArray(cached)) {

        allCves = cached;

        renderCves();

        loading = false;

        return;

      }

    }


    /*
     * --------------------------------------------------------
     * LIVE API
     * --------------------------------------------------------
     */

    try {

      const cves = await fetchRecentCves();

      if (!cves.length) {

        throw new Error(
          'Son 3 gün içerisinde geçerli CVE bulunamadı.'
        );

      }

      allCves = cves;

      setCache(allCves);

      renderCves();

    } catch (error) {

      console.error(
        '[CVE] Live feed error:',
        error
      );

      /*
       * ------------------------------------------------------
       * FALLBACK
       * ------------------------------------------------------
       */

      const fallback = await loadFallback();

      if (fallback.length) {

        allCves = fallback;

        renderCves();

      } else {

        listEl.innerHTML = `
          <div class="state-msg">
            <strong>CVE-BİLGİ</strong><br><br>
            Canlı CVE akışına şu anda ulaşılamadı.
            <br><br>
            <a
              href="https://nvd.nist.gov/vuln/search"
              target="_blank"
              rel="noopener"
            >
              NVD'den güncel zafiyetleri görüntüle →
            </a>
          </div>
        `;

      }

    } finally {

      loading = false;

    }

  }


  /* ==========================================================
     FETCH RECENT CVES
     ========================================================== */

  async function fetchRecentCves() {

    const since = getSinceDate();

    let results = [];

    /*
     * API:
     *
     * /api/vulnerability/
     *
     * since
     * date_sort=published
     * sort_order=desc
     * per_page=100
     *
     * CIRCL API güncel dokümantasyona göre
     * paginated response döndürüyor:
     *
     * {
     *   metadata: {...},
     *   data: [...]
     * }
     */

    for (let page = 1; page <= MAX_PAGES; page++) {

      const url = new URL(
        `${API_BASE}/vulnerability/`
      );

      url.searchParams.set(
        'source',
        'cvelistv5'
      );

      url.searchParams.set(
        'since',
        since
      );

      url.searchParams.set(
        'date_sort',
        'published'
      );

      url.searchParams.set(
        'sort_order',
        'desc'
      );

      url.searchParams.set(
        'per_page',
        String(PER_PAGE)
      );

      url.searchParams.set(
        'page',
        String(page)
      );

      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      let response;

      try {

        response = await fetch(
          url.toString(),
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            signal: controller.signal,
            cache: 'no-store'
          }
        );

      } finally {

        clearTimeout(timeout);

      }

      if (!response.ok) {

        throw new Error(
          `CIRCL HTTP ${response.status}`
        );

      }

      const json = await response.json();

      /*
       * Yeni API:
       * json.data
       *
       * Eski/alternatif format:
       * json itself array
       */

      let pageData = [];

      if (Array.isArray(json)) {

        pageData = json;

      } else if (Array.isArray(json.data)) {

        pageData = json.data;

      }

      if (!pageData.length) {
        break;
      }

      results.push(...pageData);

      /*
       * Daha fazla sayfa yoksa dur.
       */

      const metadata = json.metadata || {};

      const total = Number(
        metadata.count || 0
      );

      const currentPage = Number(
        metadata.page || page
      );

      const pageSize = Number(
        metadata.per_page || PER_PAGE
      );

      if (
        total > 0 &&
        currentPage * pageSize >= total
      ) {
        break;
      }

      if (pageData.length < PER_PAGE) {
        break;
      }

    }


    /*
     * --------------------------------------------------------
     * NORMALIZE
     * --------------------------------------------------------
     */

    const cutoff = Date.now() -
      DAYS_WINDOW * 24 * 60 * 60 * 1000;

    const normalized = results

      .map(normalizeCve)

      .filter(Boolean)

      .filter(cve => {

        const timestamp =
          new Date(cve.published).getTime();

        return (
          !Number.isNaN(timestamp) &&
          timestamp >= cutoff
        );

      });


    /*
     * Duplicate CVE ID temizliği
     */

    const unique = new Map();

    normalized.forEach(cve => {

      if (!unique.has(cve.id)) {
        unique.set(cve.id, cve);
      }

    });


    /*
     * En yeni → en eski
     */

    return Array.from(unique.values())
      .sort(
        (a, b) =>
          new Date(b.published) -
          new Date(a.published)
      );

  }


  /* ==========================================================
     NORMALIZE CVE
     ========================================================== */

  function normalizeCve(item) {

    if (!item || typeof item !== 'object') {
      return null;
    }


    /*
     * --------------------------------------------------------
     * ID
     * --------------------------------------------------------
     */

    const id =
      item.id ||
      item.cveMetadata?.cveId ||
      item.cveID ||
      item.CVE_data_meta?.ID ||
      null;


    /*
     * Sadece gerçek CVE kayıtları
     *
     * Böylece GHSA / PYSEC / WID vb.
     * kayıtları ana CVE listesine sokmuyoruz.
     */

    if (
      !id ||
      !/^CVE-\d{4}-\d+$/i.test(id)
    ) {
      return null;
    }


    /*
     * --------------------------------------------------------
     * DESCRIPTION
     * --------------------------------------------------------
     */

    const description =
      getDescription(item);


    if (!description) {
      return null;
    }


    /*
     * --------------------------------------------------------
     * PUBLISHED
     * --------------------------------------------------------
     */

    const published =
      getPublishedDate(item);


    if (!published) {
      return null;
    }


    /*
     * --------------------------------------------------------
     * CVSS
     * --------------------------------------------------------
     */

    const scoreInfo =
      getCvss(item);


    /*
     * --------------------------------------------------------
     * RETURN
     * --------------------------------------------------------
     */

    return {

      id: id.toUpperCase(),

      summary: description,

      published,

      score: scoreInfo.score,

      severity: scoreInfo.severity,

      version: scoreInfo.version,

      link:
        `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`,

      circl:
        `https://cve.circl.lu/cve/${encodeURIComponent(id)}`

    };

  }


  /* ==========================================================
     DESCRIPTION PARSER
     ========================================================== */

  function getDescription(item) {

    /*
     * Classic CVE JSON
     */

    if (
      Array.isArray(
        item.descriptions
      )
    ) {

      const english =
        item.descriptions.find(
          d =>
            d &&
            (
              d.lang === 'en' ||
              d.lang === 'eng'
            )
        );

      if (english?.value) {
        return english.value;
      }

      if (
        item.descriptions[0]?.value
      ) {
        return item.descriptions[0].value;
      }

    }


    /*
     * CVE 5.x CNA
     */

    const cna =
      item.containers?.cna;

    if (
      Array.isArray(
        cna?.descriptions
      )
    ) {

      const english =
        cna.descriptions.find(
          d =>
            d &&
            (
              d.lang === 'en' ||
              d.lang === 'eng'
            )
        );

      if (english?.value) {
        return english.value;
      }

      if (
        cna.descriptions[0]?.value
      ) {
        return cna.descriptions[0].value;
      }

    }


    /*
     * Eski CIRCL formatı
     */

    if (item.summary) {
      return item.summary;
    }

    if (item.details) {
      return item.details;
    }


    return '';

  }


  /* ==========================================================
     PUBLISHED DATE
     ========================================================== */

  function getPublishedDate(item) {

    return (
      item.published ||
      item.Published ||
      item.datePublished ||
      item.cveMetadata?.datePublished ||
      item.cve?.published ||
      null
    );

  }


  /* ==========================================================
     CVSS PARSER
     ========================================================== */

  function getCvss(item) {

    const candidates = [];


    /*
     * --------------------------------------------------------
     * CVE 5.x containers
     * --------------------------------------------------------
     */

    const cna =
      item.containers?.cna;

    if (
      Array.isArray(cna?.metrics)
    ) {

      candidates.push(
        ...cna.metrics
      );

    }


    /*
     * --------------------------------------------------------
     * ADP containers
     * --------------------------------------------------------
     */

    if (
      Array.isArray(
        item.containers?.adp
      )
    ) {

      item.containers.adp.forEach(
        container => {

          if (
            Array.isArray(
              container.metrics
            )
          ) {

            candidates.push(
              ...container.metrics
            );

          }

        }
      );

    }


    /*
     * --------------------------------------------------------
     * Classic NVD format
     * --------------------------------------------------------
     */

    if (
      Array.isArray(
        item.metrics?.cvssMetricV40
      )
    ) {

      item.metrics.cvssMetricV40.forEach(
        metric => {

          candidates.push({
            cvssV4_0:
              metric.cvssData
          });

        }
      );

    }


    if (
      Array.isArray(
        item.metrics?.cvssMetricV31
      )
    ) {

      item.metrics.cvssMetricV31.forEach(
        metric => {

          candidates.push({
            cvssV3_1:
              metric.cvssData
          });

        }
      );

    }


    if (
      Array.isArray(
        item.metrics?.cvssMetricV30
      )
    ) {

      item.metrics.cvssMetricV30.forEach(
        metric => {

          candidates.push({
            cvssV3_0:
              metric.cvssData
          });

        }
      );

    }


    /*
     * --------------------------------------------------------
     * Eski CIRCL formatları
     * --------------------------------------------------------
     */

    if (item.cvss) {

      candidates.push({
        cvssV3:
          item.cvss
      });

    }

    if (item.cvss3) {

      candidates.push({
        cvssV3:
          item.cvss3
      });

    }


    /*
     * --------------------------------------------------------
     * Find highest quality score
     *
     * CVSS 4 > 3.1 > 3.0 > generic
     * --------------------------------------------------------
     */

    let best = null;


    for (const metric of candidates) {

      if (!metric) continue;


      const data =
        metric.cvssV4_0 ||
        metric.cvssV3_1 ||
        metric.cvssV3_0 ||
        metric.cvssV3 ||
        metric.cvssData ||
        null;


      if (!data) continue;


      const rawScore =
        data.baseScore ??
        data.base_score ??
        metric.baseScore ??
        metric.base_score ??
        null;


      const score =
        parseFloat(rawScore);


      if (
        Number.isNaN(score) ||
        score < 0 ||
        score > 10
      ) {
        continue;
      }


      const version =
        data.version ||
        metric.version ||
        (
          metric.cvssV4_0
            ? '4.0'
            : metric.cvssV3_1
              ? '3.1'
              : '3.0'
        );


      /*
       * Öncelik:
       * CVSS 4.0
       * CVSS 3.1
       * CVSS 3.0
       */

      let priority = 1;

      if (
        String(version).startsWith('4')
      ) {
        priority = 3;
      } else if (
        String(version).startsWith('3.1')
      ) {
        priority = 2;
      }


      const candidate = {
        score,
        version,
        priority,
        severity:
          normalizeSeverity(
            data.baseSeverity ||
            metric.baseSeverity ||
            scoreToSeverity(score)
          )
      };


      if (
        !best ||
        candidate.priority > best.priority ||
        (
          candidate.priority === best.priority &&
          candidate.score > best.score
        )
      ) {

        best = candidate;

      }

    }


    if (!best) {

      return {
        score: null,
        severity: 'unknown',
        version: null
      };

    }


    return best;

  }


  /* ==========================================================
     SEVERITY
     ========================================================== */

  function normalizeSeverity(severity) {

    if (!severity) {
      return 'unknown';
    }

    const s =
      String(severity)
        .trim()
        .toLowerCase();


    if (s.includes('critical')) {
      return 'critical';
    }

    if (s.includes('high')) {
      return 'high';
    }

    if (s.includes('medium')) {
      return 'medium';
    }

    if (s.includes('low')) {
      return 'low';
    }

    if (s.includes('none')) {
      return 'low';
    }

    return 'unknown';

  }


  function scoreToSeverity(score) {

    const s =
      parseFloat(score);


    if (Number.isNaN(s)) {
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


    if (s > 0) {
      return 'low';
    }


    return 'unknown';

  }


  /* ==========================================================
     RENDER
     ========================================================== */

  function renderCves() {

    const listEl =
      document.getElementById(
        'cve-list'
      );

    if (!listEl) return;


    const search =
      document.getElementById(
        'cve-search'
      );


    const query =
      (
        search?.value ||
        ''
      )
        .trim()
        .toLowerCase();


    let items = [...allCves];


    /*
     * Severity filter
     */

    if (
      activeSev !== 'all'
    ) {

      items =
        items.filter(
          cve =>
            cve.severity === activeSev
        );

    }


    /*
     * Search
     */

    if (query) {

      items =
        items.filter(
          cve => {

            const haystack = [

              cve.id,

              cve.summary,

              cve.severity,

              cve.score

            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();


            return haystack.includes(
              query
            );

          }
        );

    }


    /*
     * Empty
     */

    if (!items.length) {

      listEl.innerHTML = `
        <div class="state-msg">
          // eşleşen CVE bulunamadı
        </div>
      `;

      return;

    }


    /*
     * Render
     */

    listEl.innerHTML =
      items.map(
        renderCveCard
      ).join('');

  }


  /* ==========================================================
     CVE CARD
     ========================================================== */

  function renderCveCard(cve) {

    const description =
      truncate(
        cve.summary,
        260
      );


    const score =
      cve.score !== null &&
      cve.score !== undefined
        ? Number(cve.score).toFixed(1)
        : 'N/A';


    const severity =
      (
        cve.severity ||
        'unknown'
      ).toUpperCase();


    const version =
      cve.version
        ? `CVSS ${escapeHtml(cve.version)}`
        : 'CVSS';


    return `

      <article class="row">

        <div class="row-main">

          <p class="row-meta">

            <span>
              ${formatDate(cve.published)}
            </span>

            <span
              class="chip sev-${escapeAttr(
                cve.severity
              )}"
            >
              ${severity}
              ${score !== 'N/A'
                ? ` · ${score}`
                : ''
              }
            </span>

            ${
              cve.version
                ? `
                  <span class="chip">
                    ${version}
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
              title="NVD'de görüntüle"
            >
              ${escapeHtml(cve.id)}
            </a>

          </h3>


          <p class="row-desc">
            ${escapeHtml(description)}
          </p>


          <div
            style="
              display:flex;
              gap:14px;
              flex-wrap:wrap;
              margin-top:10px;
              font-size:.72rem;
              font-family:'JetBrains Mono',monospace;
            "
          >

            <a
              href="${escapeAttr(cve.link)}"
              target="_blank"
              rel="noopener noreferrer"
              style="color:var(--green);"
            >
              NVD →
            </a>

            <a
              href="${escapeAttr(cve.circl)}"
              target="_blank"
              rel="noopener noreferrer"
              style="color:var(--cyan);"
            >
              CIRCL →
            </a>

          </div>

        </div>

      </article>

    `;

  }


  /* ==========================================================
     FALLBACK
     ========================================================== */

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


      const json =
        await response.json();


      /*
       * Fallback array
       */

      const data =
        Array.isArray(json)
          ? json
          : Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.cves)
              ? json.cves
              : [];


      return data

        .map(normalizeCve)

        .filter(Boolean)

        .sort(
          (a, b) =>
            new Date(b.published) -
            new Date(a.published)
        );

    } catch (error) {

      console.error(
        '[CVE] Fallback error:',
        error
      );

      return [];

    }

  }


  /* ==========================================================
     CACHE
     ========================================================== */

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


      if (
        Date.now() - parsed.ts >
        CACHE_TTL
      ) {

        localStorage.removeItem(
          CACHE_KEY
        );

        return null;

      }


      /*
       * Cache'in de 3 günlük
       * pencere içerisinde olduğundan emin ol.
       */

      const cutoff =
        Date.now() -
        DAYS_WINDOW *
        24 *
        60 *
        60 *
        1000;


      return parsed.data.filter(
        cve => {

          const date =
            new Date(
              cve.published
            ).getTime();

          return (
            !Number.isNaN(date) &&
            date >= cutoff
          );

        }
      );

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

      // localStorage kapalıysa
      // site çalışmaya devam eder.

    }

  }


  /* ==========================================================
     DATE
     ========================================================== */

  function getSinceDate() {

    const date =
      new Date(
        Date.now() -
        DAYS_WINDOW *
        24 *
        60 *
        60 *
        1000
      );


    return date
      .toISOString()
      .slice(0, 10);

  }


  function formatDate(dateString) {

    if (!dateString) {
      return 'Tarih bilinmiyor';
    }


    const date =
      new Date(dateString);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Tarih bilinmiyor';
    }


    return date.toLocaleDateString(
      'tr-TR',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );

  }


  /* ==========================================================
     TEXT HELPERS
     ========================================================== */

  function truncate(text, length) {

    const value =
      String(text || '');


    if (
      value.length <= length
    ) {
      return value;
    }


    return (
      value.slice(0, length) +
      '…'
    );

  }


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


})();
