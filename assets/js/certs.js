// =========================================================
// SIBERPORTAL — CERTIFICATIONS
// content/data/certs.json üzerinden otomatik render
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('cert-grid');

  if (!grid) return;

  try {
    const response = await fetch('content/data/certs.json', {
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let certs = await response.json();

    const limit = parseInt(grid.dataset.limit || '0', 10);

    if (limit > 0) {
      certs = certs.slice(0, limit);
    }

    renderCertificates(certs, grid);

  } catch (error) {
    console.error('Certificate loading error:', error);

    grid.innerHTML = `
      <p class="state-msg error">
        // sertifikalar yüklenirken hata oluştu
      </p>
    `;
  }
});


// =========================================================
// RENDER
// =========================================================

function renderCertificates(certs, grid) {

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


    // -----------------------------------------------------
    // Certificate thumbnail
    // -----------------------------------------------------

    let thumbnail;

    if (cert.image && cert.image.trim() !== '') {

      thumbnail = `
        <div class="cert-thumb-wrap">
          <img
            class="cert-thumb"
            src="${escapeAttr(cert.image)}"
            alt="${escapeAttr(cert.name)}"
            loading="lazy"
            onerror="this.style.display='none'; this.parentElement.classList.add('cert-image-error');"
          >

          <div class="cert-thumb-fallback">
            🛡
          </div>
        </div>
      `;

    } else {

      thumbnail = `
        <div class="cert-thumb-wrap cert-thumb-placeholder">
          <div class="cert-thumb-fallback visible">
            🛡
          </div>
        </div>
      `;
    }


    // -----------------------------------------------------
    // Card content
    // -----------------------------------------------------

    const inner = `
      ${thumbnail}

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
    `;


    // -----------------------------------------------------
    // Clickable certificate
    // -----------------------------------------------------

    if (cert.link && cert.link.trim() !== '') {

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


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(value = '') {

  return String(value).replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );
}


function escapeAttr(value = '') {
  return escapeHtml(value);
}
