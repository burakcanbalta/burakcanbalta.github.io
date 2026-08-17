// Tek makale görüntüleme — ?slug=... parametresine göre content/articles/<slug>.md dosyasını
// çeker, marked.js ile HTML'e çevirir ve highlight.js ile kod bloklarını renklendirir.

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const head = document.getElementById('article-head');
  const bodyEl = document.getElementById('md-body');

  if (!slug) {
    bodyEl.innerHTML = `<p class="state-msg error">// makale belirtilmedi</p>`;
    return;
  }

  try {
    const [metaRes, mdRes] = await Promise.all([
      fetch('content/data/articles.json'),
      fetch(`content/articles/${slug}.md`),
    ]);
    if (!mdRes.ok) throw new Error('markdown not found');

    const metaList = await metaRes.json();
    const meta = metaList.find(a => a.slug === slug) || {};
    const mdText = await mdRes.text();

    document.title = (meta.title || slug) + ' — SiberPortal';
    head.innerHTML = `
      <p class="article-meta">
        <span>${formatDate(meta.date)}</span>
        <span>${meta.readTime || ''}</span>
        <span>${(meta.tags || []).join(' · ')}</span>
      </p>
      <h1>${escapeHtml(meta.title || slug)}</h1>
    `;

    bodyEl.innerHTML = window.marked.parse(mdText);
    if (window.hljs) {
      bodyEl.querySelectorAll('pre code').forEach(block => window.hljs.highlightElement(block));
    }
  } catch (e) {
    bodyEl.innerHTML = `<p class="state-msg error">// makale yüklenirken hata oluştu: ${escapeHtml(String(e.message || e))}</p>`;
  }
});

function formatDate(d) { try { return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d || ''; } }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
