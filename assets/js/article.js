// ============================================================
// SİBERPORTAL — TEK MAKALE GÖRÜNTÜLEYİCİ
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  const head = document.getElementById("article-head");
  const body = document.getElementById("md-body");

  // ----------------------------------------------------------
  // Slug yoksa
  // ----------------------------------------------------------

  if (!slug) {
    body.innerHTML = `
      <p class="state-msg error">
        // makale belirtilmedi
      </p>
    `;
    return;
  }

  try {

    // --------------------------------------------------------
    // JSON + Markdown aynı anda yükleniyor
    // --------------------------------------------------------

    const [metaResponse, markdownResponse] = await Promise.all([

      fetch("./content/data/articles.json"),

      fetch(
        "./content/articles/" +
        encodeURIComponent(slug) +
        ".md"
      )

    ]);

    // --------------------------------------------------------
    // Markdown bulunamadı
    // --------------------------------------------------------

    if (!markdownResponse.ok) {
      throw new Error(
        `Markdown dosyası bulunamadı: ${slug}.md`
      );
    }

    // --------------------------------------------------------
    // JSON oku
    // --------------------------------------------------------

    const articles = await metaResponse.json();

    // --------------------------------------------------------
    // İlgili makaleyi bul
    // --------------------------------------------------------

    const article = articles.find(
      item => item.slug === slug
    );

    // --------------------------------------------------------
    // Markdown oku
    // --------------------------------------------------------

    const markdown = await markdownResponse.text();

    // --------------------------------------------------------
    // Metadata
    // --------------------------------------------------------

    const title = article?.title || slug;

    const date = article?.date || "";

    const readTime = article?.readTime || "";

    const tags = article?.tags || [];

    // --------------------------------------------------------
    // Browser title
    // --------------------------------------------------------

    document.title = `${title} — SiberPortal`;

    // --------------------------------------------------------
    // Makale başlığı
    // --------------------------------------------------------

    head.innerHTML = `

      <p class="article-meta">

        <span>
          ${formatDate(date)}
        </span>

        ${
          readTime
            ? `<span>${escapeHtml(readTime)}</span>`
            : ""
        }

        ${
          tags.length
            ? `<span>${tags.map(escapeHtml).join(" · ")}</span>`
            : ""
        }

      </p>

      <h1>
        ${escapeHtml(title)}
      </h1>

    `;

    // --------------------------------------------------------
    // Markdown → HTML
    // --------------------------------------------------------

    if (window.marked) {

      body.innerHTML = marked.parse(markdown);

    } else {

      body.innerHTML = `
        <p class="state-msg error">
          // marked.js yüklenemedi
        </p>
      `;

      return;
    }

    // --------------------------------------------------------
    // Syntax highlighting
    // --------------------------------------------------------

    if (window.hljs) {

      body
        .querySelectorAll("pre code")
        .forEach(block => {

          hljs.highlightElement(block);

        });

    }

  }

  catch (error) {

    console.error(
      "Makale yükleme hatası:",
      error
    );

    body.innerHTML = `

      <div class="state-msg error">

        <p>
          // makale yüklenirken hata oluştu
        </p>

        <p>
          ${escapeHtml(error.message)}
        </p>

      </div>

    `;

  }

});


// ============================================================
// TARİH
// ============================================================

function formatDate(date) {

  if (!date) {
    return "";
  }

  try {

    return new Date(date).toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

  }

  catch {

    return date;

  }

}


// ============================================================
// HTML ESCAPE
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
