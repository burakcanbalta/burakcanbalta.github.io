// Sertifikalar — content/data/certs.json içindeki listeye göre otomatik render edilir.
// Yeni sertifika eklemek için: certs.json'a { "name", "issuer", "date", "status", "link" } formatında satır ekle.
// status: "aktif" | "devam" (devam ediyor / henüz tamamlanmadı)

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('cert-grid');
  if (!grid) return;
  try {
    const res = await fetch('content/data/certs.json');
    const certs = await res.json();
    render(certs, grid);
  } catch (e) {
    grid.innerHTML = `<p class="state-msg error">// sertifikalar yüklenemedi</p>`;
  }
});

function render(certs, grid) {
  if (!certs.length) {
    grid.innerHTML = `<p class="state-msg">// henüz sertifika eklenmedi</p>`;
    return;
  }
  grid.innerHTML = certs.map(c => {
    const statusLabel = c.status === 'devam' ? '◐ DEVAM EDİYOR' : '● AKTİF';
    const inner = `
      <span class="cert-status">${statusLabel}</span>
      <span class="cert-name">${escapeHtml(c.name)}</span>
      <span class="cert-issuer">${escapeHtml(c.issuer)}</span>
      <span class="cert-date">${escapeHtml(c.date || '')}</span>
    `;
    return c.link
      ? `<a class="cert-card" href="${escapeAttr(c.link)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="cert-card">${inner}</div>`;
  }).join('');
}

function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s='') { return escapeHtml(s); }
