// ============================================================
// SiberPortal — Certifications
// content/data/certs.json
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  loadCertificates
);


// ============================================================
// LOAD
// ============================================================

async function loadCertificates() {

  const container =
    document.getElementById("certs-grid");


  if (!container) {

    console.warn(
      "Certificate container #certs-grid not found."
    );

    return;

  }


  try {

    const response = await fetch(
      "content/data/certs.json",
      {
        cache: "no-store"
      }
    );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const certificates =
      await response.json();


    if (
      !Array.isArray(certificates) ||
      certificates.length === 0
    ) {

      container.innerHTML = `
        <p class="state-msg">
          // sertifika bulunamadı
        </p>
      `;

      return;

    }


    renderCertificates(
      container,
      certificates
    );


  } catch (error) {

    console.error(
      "Certificate loading error:",
      error
    );


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

function renderCertificates(
  container,
  certificates
) {

  container.innerHTML =
    certificates
      .map((cert, index) => {

        const name =
          escapeHtml(
            cert.name || "Sertifika"
          );


        const issuer =
          escapeHtml(
            cert.issuer || ""
          );


        const date =
          escapeHtml(
            cert.date || ""
          );


        const status =
          escapeHtml(
            cert.status || ""
          );


        const image =
          normalizePath(
            cert.image
          );


        const link =
          normalizePath(
            cert.link || cert.image
          );


        return `

          <article class="cert-card">


            <!-- IMAGE -->

            <div class="cert-image-wrap">


              ${
                image
                  ? `

                    <a
                      href="${escapeAttr(link)}"
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

                        <span>
                          ↗ SERTİFİKAYI AÇ
                        </span>

                      </div>

                    </a>

                  `
                  : `

                    <div class="cert-thumb-placeholder">

                      <span>
                        ◇
                      </span>

                      <small>
                        IMAGE NOT AVAILABLE
                      </small>

                    </div>

                  `
              }


              <div class="cert-image-fallback">

                <span>
                  ◇
                </span>

                <small>
                  SERTİFİKA GÖRSELİ YÜKLENEMEDİ
                </small>

              </div>


            </div>


            <!-- INFO -->

            <div class="cert-info">


              ${
                status
                  ? `

                    <span class="cert-status">

                      ● ${status.toUpperCase()}

                    </span>

                  `
                  : ""
              }


              <span class="cert-name">

                ${name}

              </span>


              <span class="cert-issuer">

                ${issuer}

              </span>


              <span class="cert-date">

                ${date}

              </span>


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

      })
      .join("");

}


// ============================================================
// IMAGE ERROR
// ============================================================

function certificateImageError(image) {

  const wrapper =
    image.closest(
      ".cert-image-wrap"
    );


  if (!wrapper) {

    return;

  }


  wrapper.classList.add(
    "image-error"
  );

}


// ============================================================
// PATH NORMALIZER
// ============================================================

function normalizePath(path = "") {

  if (!path) {

    return "";

  }


  return String(path)
    .replace(/^\/+/, "");

}


// ============================================================
// SECURITY
// ============================================================

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
