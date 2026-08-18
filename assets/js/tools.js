// ============================================================
// SİBERPORTAL — SiberTools
// Red Team / Pentest / Security Arsenal
// ============================================================

let ALL_TOOLS = [];
let activeCat = 'all';
let activeLevel = 'all';
let activeTag = 'all';


// ============================================================
// BAŞLANGIÇ
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const grid = document.getElementById('tools-grid');

  if (!grid) return;

  grid.innerHTML = `
    <p class="state-msg">
      // SiberTools yükleniyor...
    </p>
  `;

  try {

    const res = await fetch('content/data/tools.json', {
      cache: 'no-cache'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error('tools.json array değil');
    }

    ALL_TOOLS = data;

    console.log(
      `[SiberTools] ${ALL_TOOLS.length} araç yüklendi.`
    );

    buildFilters();
    buildStats();
    render();

  } catch (error) {

    console.error(
      '[SiberTools] yükleme hatası:',
      error
    );

    grid.innerHTML = `
      <div class="state-msg error">
        // araçlar yüklenemedi
        <br>
        // content/data/tools.json kontrol edin
      </div>
    `;

  }


  // ----------------------------------------------------------
  // ARAMA
  // ----------------------------------------------------------

  const search =
    document.getElementById('tools-search');

  if (search) {

    search.addEventListener(
      'input',
      render
    );

  }

});


// ============================================================
// FİLTRELER
// ============================================================

function buildFilters() {

  const bar =
    document.getElementById('cat-filters');

  if (!bar) return;


  // ----------------------------------------------------------
  // KATEGORİLER
  // ----------------------------------------------------------

  const categories =
    new Set();

  ALL_TOOLS.forEach(tool => {

    if (tool.category) {
      categories.add(tool.category);
    }

  });


  // ----------------------------------------------------------
  // LEVEL'LER
  // ----------------------------------------------------------

  const levels =
    new Set();

  ALL_TOOLS.forEach(tool => {

    if (tool.level) {
      levels.add(tool.level);
    }

  });


  // ----------------------------------------------------------
  // TAG'LER
  // ----------------------------------------------------------

  const tags =
    new Set();

  ALL_TOOLS.forEach(tool => {

    if (Array.isArray(tool.tags)) {

      tool.tags.forEach(tag => {

        if (tag) {
          tags.add(tag);
        }

      });

    }

  });


  // ----------------------------------------------------------
  // HTML
  // ----------------------------------------------------------

  let html = `

    <button
      class="filter-btn active"
      data-cat="all"
    >
      tümü
    </button>

  `;


  [...categories]
    .sort()
    .forEach(category => {

      html += `

        <button
          class="filter-btn"
          data-cat="${escapeAttr(category)}"
        >
          ${escapeHtml(category)}
        </button>

      `;

    });


  bar.innerHTML = html;


  // ----------------------------------------------------------
  // KATEGORİ EVENT
  // ----------------------------------------------------------

  bar
    .querySelectorAll('[data-cat]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          activeCat =
            button.dataset.cat || 'all';

          bar
            .querySelectorAll('[data-cat]')
            .forEach(btn =>
              btn.classList.remove('active')
            );

          button.classList.add('active');

          render();

        }
      );

    });


  // ----------------------------------------------------------
  // ADVANCED FILTER BAR
  // ----------------------------------------------------------

  const existingAdvanced =
    document.getElementById(
      'tools-advanced-filters'
    );

  if (existingAdvanced) {
    existingAdvanced.remove();
  }


  if (levels.size > 0 || tags.size > 0) {

    const advanced =
      document.createElement('div');

    advanced.id =
      'tools-advanced-filters';

    advanced.className =
      'toolbar';

    advanced.style.marginTop =
      '-14px';


    let advancedHTML = '';


    // LEVEL
    if (levels.size > 0) {

      advancedHTML += `

        <select
          id="tools-level-filter"
          class="filter-btn"
        >
          <option value="all">
            tüm seviyeler
          </option>

          ${[...levels]
            .sort()
            .map(level => `
              <option value="${escapeAttr(level)}">
                ${escapeHtml(level)}
              </option>
            `)
            .join('')}

        </select>

      `;

    }


    // TAG
    if (tags.size > 0) {

      advancedHTML += `

        <select
          id="tools-tag-filter"
          class="filter-btn"
        >
          <option value="all">
            tüm tagler
          </option>

          ${[...tags]
            .sort()
            .map(tag => `
              <option value="${escapeAttr(tag)}">
                ${escapeHtml(tag)}
              </option>
            `)
            .join('')}

        </select>

      `;

    }


    advanced.innerHTML =
      advancedHTML;

    bar.parentElement.insertBefore(
      advanced,
      document.getElementById('tools-grid')
    );


    // LEVEL EVENT

    document
      .getElementById('tools-level-filter')
      ?.addEventListener(
        'change',
        event => {

          activeLevel =
            event.target.value;

          render();

        }
      );


    // TAG EVENT

    document
      .getElementById('tools-tag-filter')
      ?.addEventListener(
        'change',
        event => {

          activeTag =
            event.target.value;

          render();

        }
      );

  }

}


// ============================================================
// İSTATİSTİKLER
// ============================================================

function buildStats() {

  const existing =
    document.getElementById(
      'tools-stats'
    );

  if (existing) {
    existing.remove();
  }


  const categories =
    new Set(
      ALL_TOOLS
        .map(t => t.category)
        .filter(Boolean)
    );


  const redTeamCount =
    ALL_TOOLS.filter(tool => {

      const text =
        JSON.stringify(tool)
          .toLowerCase();

      return (
        text.includes('red team') ||
        text.includes('redteam') ||
        text.includes('pentest')
      );

    }).length;


  const webCount =
    ALL_TOOLS.filter(tool => {

      const text =
        JSON.stringify(tool)
          .toLowerCase();

      return (
        text.includes('web') ||
        text.includes('api')
      );

    }).length;


  const stats =
    document.createElement('div');

  stats.id =
    'tools-stats';

  stats.className =
    'grid grid-3';

  stats.style.marginBottom =
    '28px';


  stats.innerHTML = `

    <div class="card">

      <div class="card-icon">
        ⚒
      </div>

      <h3>
        ${ALL_TOOLS.length}
      </h3>

      <p>
        TOPLAM ARAÇ
      </p>

    </div>


    <div class="card">

      <div class="card-icon">
        ◈
      </div>

      <h3>
        ${categories.size}
      </h3>

      <p>
        KATEGORİ
      </p>

    </div>


    <div class="card">

      <div class="card-icon">
        ⚡
      </div>

      <h3>
        ${redTeamCount}
      </h3>

      <p>
        OFFENSIVE / PENTEST
      </p>

    </div>

  `;


  const grid =
    document.getElementById(
      'tools-grid'
    );

  if (grid) {

    grid.parentElement.insertBefore(
      stats,
      grid
    );

  }

}


// ============================================================
// RENDER
// ============================================================

function render() {

  const grid =
    document.getElementById(
      'tools-grid'
    );

  if (!grid) return;


  const search =
    (
      document.getElementById(
        'tools-search'
      )?.value || ''
    )
      .trim()
      .toLowerCase();


  // ----------------------------------------------------------
  // FİLTRELE
  // ----------------------------------------------------------

  let items =
    [...ALL_TOOLS];


  // CATEGORY

  if (activeCat !== 'all') {

    items =
      items.filter(
        tool =>
          tool.category === activeCat
      );

  }


  // LEVEL

  if (activeLevel !== 'all') {

    items =
      items.filter(
        tool =>
          String(tool.level || '')
            .toLowerCase() ===
          activeLevel.toLowerCase()
      );

  }


  // TAG

  if (activeTag !== 'all') {

    items =
      items.filter(tool => {

        if (!Array.isArray(tool.tags)) {
          return false;
        }

        return tool.tags.some(
          tag =>
            String(tag).toLowerCase() ===
            activeTag.toLowerCase()
        );

      });

  }


  // SEARCH

  if (search) {

    items =
      items.filter(tool => {

        const searchable = [

          tool.name,

          tool.description,

          tool.category,

          tool.level,

          tool.os,

          tool.command,

          tool.usage,

          ...(Array.isArray(tool.tags)
            ? tool.tags
            : [])

        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();


        return searchable.includes(search);

      });

  }


  // ----------------------------------------------------------
  // EMPTY
  // ----------------------------------------------------------

  if (items.length === 0) {

    grid.innerHTML = `

      <div class="state-msg">

        // eşleşen araç bulunamadı

        <br>

        // başka bir kategori veya arama terimi deneyin

      </div>

    `;

    return;

  }


  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  grid.innerHTML =
    items
      .map(renderTool)
      .join('');

}


// ============================================================
// TOOL CARD
// ============================================================

function renderTool(tool) {

  const name =
    tool.name || 'Unnamed Tool';


  const description =
    tool.description ||
    'Açıklama bulunmuyor.';


  const category =
    tool.category ||
    'Other';


  const level =
    tool.level ||
    '';


  const os =
    tool.os ||
    '';


  const command =
    tool.command ||
    tool.usage ||
    '';


  const tags =
    Array.isArray(tool.tags)
      ? tool.tags
      : [];


  // ----------------------------------------------------------
  // LINKLER
  // ----------------------------------------------------------

  const github =
    tool.github ||
    tool.github_url ||
    '';


  const docs =
    tool.docs ||
    tool.documentation ||
    tool.docs_url ||
    tool.link ||
    '';


  // ----------------------------------------------------------
  // ESSENTIAL
  // ----------------------------------------------------------

  const isEssential =
    tool.essential === true ||
    tool.featured === true;


  // ----------------------------------------------------------
  // TAG HTML
  // ----------------------------------------------------------

  const tagsHTML =
    tags
      .slice(0, 5)
      .map(tag => `

        <span class="chip">
          ${escapeHtml(tag)}
        </span>

      `)
      .join('');


  // ----------------------------------------------------------
  // LEVEL
  // ----------------------------------------------------------

  const levelHTML =
    level
      ? `

        <span class="chip tool-level">
          ${escapeHtml(level)}
        </span>

      `
      : '';


  // ----------------------------------------------------------
  // OS
  // ----------------------------------------------------------

  const osHTML =
    os
      ? `

        <span class="chip">
          ${escapeHtml(os)}
        </span>

      `
      : '';


  // ----------------------------------------------------------
  // KOMUT
  // ----------------------------------------------------------

  const commandHTML =
    command
      ? `

        <div class="tool-command">

          <span class="command-prefix">
            $
          </span>

          <code>
            ${escapeHtml(command)}
          </code>

        </div>

      `
      : '';


  // ----------------------------------------------------------
  // LINKLER
  // ----------------------------------------------------------

  let linksHTML = '';


  if (github) {

    linksHTML += `

      <a
        class="chip tool-link"
        href="${escapeAttr(github)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub ↗
      </a>

    `;

  }


  if (docs) {

    // GitHub ve docs aynıysa iki kere göstermeyelim

    if (docs !== github) {

      linksHTML += `

        <a
          class="chip tool-link"
          href="${escapeAttr(docs)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs ↗
        </a>

      `;

    }

  }


  // ----------------------------------------------------------
  // CARD
  // ----------------------------------------------------------

  return `

    <article class="card tool-card">

      <div class="tool-top">

        <div class="card-icon">
          ⚒
        </div>

        ${
          isEssential
            ? `
              <span class="tool-essential">
                ★ ESSENTIAL
              </span>
            `
            : ''
        }

      </div>


      <div class="tool-header">

        <div>

          <h3>
            ${escapeHtml(name)}
          </h3>

          <span class="tool-category">
            ${escapeHtml(category)}
          </span>

        </div>

      </div>


      <p class="tool-description">
        ${escapeHtml(description)}
      </p>


      ${
        tagsHTML ||
        levelHTML ||
        osHTML
          ? `

            <div class="tags">

              ${levelHTML}

              ${osHTML}

              ${tagsHTML}

            </div>

          `
          : ''
      }


      ${commandHTML}


      ${
        linksHTML
          ? `

            <div
              class="tags"
              style="margin-top:14px;"
            >

              ${linksHTML}

            </div>

          `
          : ''
      }

    </article>

  `;

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
