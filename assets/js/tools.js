// SiberTools / Writeups sayfası

let ALL_TOOLS = [];
let activeCat = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('tools-grid');
  try {
    const res = await fetch('content/data/tools.json');
    ALL_TOOLS = await res.json();
    buildFilters();
    render();
  } catch (e) {
    grid.innerHTML = `<p class="state-msg error">// araçlar yüklenemedi</p>`;
  }
  document.getElementById('tools-search')?.addEventListener('input', render);
});

function buildFilters() {
  const cats = new Set(ALL_TOOLS.map(t => t.category));
  const bar = document.getElementById('cat-filters');
  if (!bar) return;
  bar.innerHTML = `<button class="filter-btn active" data-cat="all">tümü</button>` +
    [...cats].map(c => `<button class="filter-btn" data-cat="${c}">${c}</button>`).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat;
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

function render() {
  const grid = document.getElementById('tools-grid');
  const q = (document.getElementById('tools-search')?.value || '').toLowerCase();

  let items = ALL_TOOLS;
  if (activeCat !== 'all') items = items.filter(t => t.category === activeCat);
  if (q) items = items.filter(t => (t.name + t.description).toLowerCase().includes(q));

  if (items.length === 0) {
    grid.innerHTML = `<p class="state-msg">// eşleşen araç bulunamadı</p>`;
    return;
  }

  grid.innerHTML = items.map(t => `
    <div class="card">
      <div class="card-icon">⚒</div>
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.description)}</p>
      <div class="tags">
        <span class="chip">${escapeHtml(t.category)}</span>
        ${t.link ? `<a class="chip" href="${escapeAttr(t.link)}" target="_blank" rel="noopener">bağlantı ↗</a>` : ''}
      </div>
    </div>
  `).join('');
}

function escapeHtml(s='') { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s='') { return escapeHtml(s); }
