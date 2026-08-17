// Makaleler sayfası — content/data/articles.json içindeki meta verilere göre listeler.
// Yeni makale eklemek için: content/articles/ altına .md dosyası koy + articles.json'a satır ekle.

let ALL_ARTICLES = [];
let activeTag = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('article-list');
  try {
    const res = await fetch('content/data/articles.json');
    ALL_ARTICLES = await res.json();
    ALL_ARTICLES.sort((a, b) => new Date(b.date) - new Date(a.date));
    buildTagFilters();
    render();
  } catch (e) {
    listEl.innerHTML = `<p class="state-msg error">// makaleler yüklenemedi</p>`;
  }
  document.getElementById('article-search')?.addEventListener('input', render);
});

function buildTagFilters() {
  const tags = new Set();
  ALL_ARTICLES.forEach(a => (a.tags || []).forEach(t => tags.add(t)));
  const bar = document.getElementById('tag-filters');
  if (!bar) return;
  bar.innerHTML = `<button class="filter-btn active" data-tag="all">tümü</button>` +
    [...tags].map(t => `<button class="filter-btn" data-tag="${t}">${t}</button>`).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTag = btn.dataset.tag;
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

function render() {
  const listEl = document.getElementById('article-list');
  const q = (document.getElementById('article-search')?.value || '').toLowerCase();

  let items = ALL_ARTICLES;
  if (activeTag !== 'all') items = items.filter(a => (a.tags || []).includes(activeTag));
  if (q) items = items.filter(a => (a.title + ' ' + a.excerpt).toLowerCase().includes(q));

  if (items.length === 0) {
    listEl.innerHTML = `<p class="state-msg">// eşleşen makale bulunamadı</p>`;
    return;
  }

  listEl.innerHTML = items.map(a => `
    <div class="row">
      <div class="row-main">
        <p class="row-meta">
          <span>${formatDate(a.date)}</span>
          <span>${a.readTime || ''}</span>
        </p>
        <h3 class="row-title"><a href="makale.html?slug=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></h3>
        <p class="row-desc">${escapeHtml(a.excerpt || '')}</p>
        <div class="tags">${(a.tags || []).map(t => `<span class="chip">${t}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');
}

function formatDate(d) { try { return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
