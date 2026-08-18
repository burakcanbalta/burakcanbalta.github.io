// ============================================================
// SiberTools
// Tool database + search + category filtering
// ============================================================

let ALL_TOOLS = [];
let activeCat = 'all';


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const grid = document.getElementById('tools-grid');

  if (!grid) return;

  try {

    const response = await fetch('content/data/tools.json', {
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    ALL_TOOLS = await response.json();

    if (!Array.isArray(ALL_TOOLS)) {
      throw new Error('tools.json bir array değil');
    }

    buildFilters();
    render();

  } catch (error) {

    console.error('SiberTools yükleme hatası:', error);

    grid.innerHTML = `
      <p class="state-msg error">
        // araçlar yüklenemedi
      </p>
    `;
  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  const search = document.getElementById('tools-search');

  if (search) {

    search.addEventListener('input', () => {
      render();
    });

  }

});


// ============================================================
// CATEGORY FILTERS
// ============================================================

function buildFilters() {

  const bar = document.getElementById('cat-filters');

  if (!bar) return;


  // Kategorileri benzersiz şekilde al
  const categories = [
    ...new Set(
      ALL_TOOLS
        .map(tool => tool.category)
        .filter(Boolean)
    )
  ].sort();


  // Tümü
  let html = `
    <button
      class="filter-btn active"
      data-cat="all"
    >
      tümü
    </button>
  `;


  // Kategoriler
  html += categories.map(category => {

    const count = ALL_TOOLS.filter(
      tool => tool.category === category
    ).length;

    return `
      <button
        class="filter-btn"
        data-cat="${escapeAttr(category)}"
      >
        ${escapeHtml(category)} (${count})
      </button>
    `;

  }).join('');


  bar.innerHTML = html;


  // ==========================================================
  // FILTER EVENTS
  // ==========================================================

  bar.querySelectorAll('.filter-btn').forEach(button => {

    button.addEventListener('click', () => {

      activeCat = button.dataset.cat || 'all';


      // Aktif butonu değiştir
      bar
        .querySelectorAll('.filter-btn')
        .forEach(btn => {
          btn.classList.remove('active');
        });


      button.classList.add('active');


      render();

    });

  });

}


// ============================================================
// FILTER + RENDER
// ============================================================

function render() {

  const grid = document.getElementById('tools-grid');

  if (!grid) return;


  const searchInput =
    document.getElementById('tools-search');

  const query =
    (searchInput?.value || '')
      .trim()
      .toLowerCase();


  let items = [...ALL_TOOLS];


  // ==========================================================
  // CATEGORY
  // ==========================================================

  if (activeCat !== 'all') {

    items = items.filter(tool =>
      String(tool.category || '').toLowerCase() ===
      activeCat.toLowerCase()
    );

  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  if (query) {

    items = items.filter(tool => {

      const searchableText = [

        tool.name,

        tool.category,

        tool.description,

        tool.technology,

        tool.tags,

        tool.platform

      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();


      return searchableText.includes(query);

    });

  }


  // ==========================================================
  // EMPTY
  // ==========================================================

  if (items.length === 0) {

    grid.innerHTML = `
      <div class="state-msg">
        // eşleşen araç bulunamadı
      </div>
    `;

    return;

  }


  // ==========================================================
  // TOOL CARDS
  // ==========================================================

  grid.innerHTML = items.map(tool => {

    const name =
      escapeHtml(tool.name || 'Unknown Tool');

    const description =
      escapeHtml(
        tool.description ||
        'Açıklama bulunmuyor.'
      );

    const category =
      escapeHtml(
        tool.category ||
        'uncategorized'
      );


    // İsteğe bağlı teknoloji
    const technology =
      tool.technology
        ? `
          <span class="chip">
            ${escapeHtml(tool.technology)}
          </span>
        `
        : '';


    // İsteğe bağlı platform
    const platform =
      tool.platform
        ? `
          <span class="chip">
            ${escapeHtml(tool.platform)}
          </span>
        `
        : '';


    // Docs link
    const docs =
      tool.link
        ? `
          <a
            class="chip"
            href="${escapeAttr(tool.link)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs ↗
          </a>
        `
        : '';


    return `
      <div class="card tool-card">

        <div class="card-icon">
          ⚒
        </div>

        <h3>
          ${name}
        </h3>

        <p>
          ${description}
        </p>

        <div class="tags">

          <span class="chip">
            ${category}
          </span>

          ${technology}

          ${platform}

          ${docs}

        </div>

      </div>
    `;

  }).join('');

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
