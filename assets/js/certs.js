// =========================================================
// SIBERPORTAL — CERTIFICATIONS
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('cert-grid');

  if (!grid) return;

  try {
    const res = await fetch('content/data/certs.json', {
      cache: 'no-cache'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    let certs = await res.json();

    const limit = parseInt(grid.dataset.limit || '0', 10);

    if (limit > 0) {
      certs = certs.slice(0, limit);
    }

    renderCerts(certs, grid);

  } catch (error) {

    console.error('Certificate loading error:', error);

    grid.innerHTML = `
      <p class="state-msg error">
        // sertifikalar yüklenemedi
      </p>
    `;
  }
});


function renderCerts(certs, grid) {

  if (!Array.isArray(certs) || certs.length === 0) {

    grid.innerHTML = `
      <p class="state-msg">
        // henüz sertifika eklenmedi
      </p>
    `;

    return;
  }


  grid.innerHTML = certs.map(cert => {

    const statusLabel =
      cert.status === 'devam'
        ? '◐ DEVAM EDİYOR'
        : '● AKTİF';


    /*
     * Sertifika görseli
     */

    const thumbnail = cert.image
      ? `
        <div class="cert-image-wrap">

          <img
            class="cert-thumb"
            src="${escapeAttr(cert.image)}"
            alt="${escapeAttr(cert.name)}"
            loading="lazy"
            onerror="this.style.display='none'; this.parentElement.classList.add('image-error');"
          >

          <div class="cert-image-fallback">
            <span>🛡</span>
            <small>PREVIEW UNAVAILABLE</small>
          </div>

        </div>
      `
      : `
        <div class="cert-image-wrap no-image">

          <div class="cert-thumb-placeholder">
            <span>🛡</span>
          </div>

        </div>
      `;


    /*
     * Kart içeriği
     */

    const inner = `
      ${thumbnail}

      <div class="cert-info">

        <span class="cert-status">
          ${statusLabel}
        </span>

        <span class="cert-name">
          ${escapeHtml(cert.name)}
        </span>

        <span class="cert-issuer">
          ${escapeHtml(cert.issuer)}
        </span>

        <span class="cert-date">
          ${escapeHtml(cert.date || '')}
        </span>

      </div>
    `;


    /*
     * Link varsa kart komple tıklanabilir.
     */

    if (cert.link) {

      return `
        <a
          class="cert-card"
          href="${escapeAttr(cert.link)}"
          target="_blank"
          rel="noopener noreferrer"
          title="${escapeAttr(cert.name)} — sertifikayı aç"
        >
          ${inner}
        </a>
      `;

    }


    return `
      <div class="cert-card">
        ${inner}
      </div>
    `;

  }).join('');
}


/*
 * HTML escaping
 */

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
