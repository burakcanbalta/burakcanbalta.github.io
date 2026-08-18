document.addEventListener("DOMContentLoaded", loadCertificates);

async function loadCertificates() {
  const container = document.getElementById("certs-grid");

  if (!container) {
    return;
  }

  try {
    const response = await fetch("content/data/certs.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    let certificates = [];

    if (Array.isArray(data)) {
      certificates = data;
    } else if (Array.isArray(data.certificates)) {
      certificates = data.certificates;
    } else if (Array.isArray(data.certs)) {
      certificates = data.certs;
    } else {
      throw new Error("certs.json içinde sertifika listesi bulunamadı");
    }

    if (certificates.length === 0) {
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

function renderCertificates(container, certificates) {
  container.innerHTML = certificates.map((cert, index) => {

    const name = escapeHtml(
      cert.name ||
      cert.title ||
      cert.certification ||
      "Sertifika"
    );

    const issuer = escapeHtml(
      cert.issuer ||
      cert.organization ||
      cert.provider ||
      cert.platform ||
      ""
    );

    const date = escapeHtml(
      cert.date ||
      cert.issueDate ||
      cert.issued ||
      cert.year ||
      ""
    );

    const status = escapeHtml(
      cert.status ||
      "VERIFIED"
    );

    const image = normalizePath(
      cert.image ||
      cert.img ||
      cert.thumbnail ||
      cert.certificateImage ||
      ""
    );

    const link = normalizePath(
      cert.link ||
      cert.url ||
      cert.verify ||
      cert.verification ||
      cert.credentialUrl ||
      cert.image ||
      ""
    );

    return `
      <article class="cert-card">

        <div class="cert-image-wrap">

          ${
            image
              ? `
                <a
                  href="${escapeAttr(link || image)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="${name} — sertifikayı aç"
                >

                  <img
                    class="cert-thumb"
                    src="${escapeAttr(image)}"
                    alt="${name}"
                    loading="${index < 4 ? "eager" : "lazy"}"
                    decoding="async"
                    onerror="certificateImageError(this)"
                  >

                  <div class="cert-image-overlay">
                    <span>↗ SERTİFİKAYI AÇ</span>
                  </div>

                </a>
              `
              : `
                <div class="cert-thumb-placeholder">
                  <span>◇</span>
                  <small>IMAGE NOT AVAILABLE</small>
                </div>
              `
          }

          <div class="cert-image-fallback">
            <span>◇</span>
            <small>SERTİFİKA GÖRSELİ YÜKLENEMEDİ</small>
          </div>

        </div>

        <div class="cert-info">

          <span class="cert-status">
            ● ${status.toUpperCase()}
          </span>

          <span class="cert-name">
            ${name}
          </span>

          <span class="cert-issuer">
            ${issuer}
          </span>

          ${
            date
              ? `
                <span class="cert-date">
                  ${date}
                </span>
              `
              : ""
          }

          ${
            link
              ? `
                <a
                  class="cert-open"
                  href="${escapeAttr(link)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ↗ SERTİFİKAYI AÇ
                </a>
              `
              : ""
          }

        </div>

      </article>
    `;

  }).join("");
}

function certificateImageError(image) {
  const wrapper = image.closest(".cert-image-wrap");

  if (!wrapper) {
    return;
  }

  wrapper.classList.add("image-error");
}

function normalizePath(path = "") {
  if (!path) {
    return "";
  }

  let value = String(path).trim();

  value = value.replace(/^\.\/+/, "");
  value = value.replace(/^\/+/, "");

  return value;
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
