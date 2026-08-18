// ============================================================
// SiberPortal — Certifications
// content/data/certs.json -> görselli sertifika kartları
// ============================================================

document.addEventListener("DOMContentLoaded", loadCertificates);

async function loadCertificates() {
  const container = document.getElementById("certs-grid");

  if (!container) return;

  try {
    const response = await fetch("content/data/certs.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const certificates = await response.json();

    if (!Array.isArray(certificates) || certificates.length === 0) {
      container.innerHTML = `
        <p class="state-msg">
          // sertifika bulunamadı
        </p>
      `;
      return;
    }

    renderCertificates(container, certificates);

  } catch (error) {
    console.error("Certificate loading error:", error);

    container.innerHTML = `
      <p class="state-msg error">
        // sertifikalar yüklenemedi
      </p>
    `;
  }
}


// ============================================================
// RENDER
// ============================================================

function renderCertificates(container, certificates) {

  container.innerHTML = certificates.map((cert, index) => {

    const name = escapeHtml(cert.name || "Sertifika");
    const issuer = escapeHtml(cert.issuer || "");
    const date = escapeHtml(cert.date || "");
    const status = escapeHtml(cert.status || "");

    /*
     * JSON'daki /public/... yollarını GitHub Pages için
     * relative public/... yoluna çeviriyoruz.
     */
    const image = normalizePath(cert.image);
    const link = normalizePath(cert.link || cert.image);

    return `
      <article class="cert-card">

        <div class="cert-image-wrap">

          <a
            href="${escapeAttr(link)}"
            target="_blank"
            rel="noopener noreferrer"
            title="${name} — sertifikayı aç"
          >

            <img
              class="cert-image"
              src="${escapeAttr(image)}"
              alt="${name}"
              loading="${index < 4 ? "eager" : "lazy"}"
              decoding="async"
            >

            <div class="cert-image-overlay">
              <span>↗ SERTİFİKAYI AÇ</span>
            </div>

          </a>

        </div>


        <div class="cert-content">

          <div class="cert-meta">

            ${
              status
                ? `<span class="chip sev-low">● ${status.toUpperCase()}</span>`
                : ""
            }

          </div>


          <h3 class="cert-title">
            ${name}
          </h3>


          <p class="cert-issuer">
            ${issuer}
          </p>


          <p class="cert-date">
            ${date}
          </p>

        </div>

      </article>
    `;

  }).join("");
}


// ============================================================
// PATH NORMALIZER
// ============================================================

function normalizePath(path = "") {

  if (!path) return "";

  /*
   * JSON'daki:
   *
   * /public/certificates/file.png
   *
   * yerine:
   *
   * public/certificates/file.png
   *
   * kullanıyoruz.
   */

  return path.replace(/^\/+/, "");
}


// ============================================================
// SECURITY
// ============================================================

function escapeHtml(value = "") {

  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );

}


function escapeAttr(value = "") {
  return escapeHtml(value);
}
