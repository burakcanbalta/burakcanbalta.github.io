// ============================================================
// SİBERPORTAL — MAKALELER
// content/data/articles.json üzerinden makaleleri listeler.
// ============================================================

let ALL_ARTICLES = [];

document.addEventListener("DOMContentLoaded", async () => {
    const listEl = document.getElementById("article-list");
    const searchEl = document.getElementById("article-search");

    if (!listEl) return;

    try {
        const response = await fetch(
            "./content/data/articles.json?v=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "articles.json yüklenemedi: HTTP " + response.status
            );
        }

        ALL_ARTICLES = await response.json();

        if (!Array.isArray(ALL_ARTICLES)) {
            throw new Error("articles.json geçerli bir JSON array değil");
        }

        // En yeni makaleler üstte
        ALL_ARTICLES.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        renderArticles();

        if (searchEl) {
            searchEl.addEventListener("input", renderArticles);
        }

    } catch (error) {

        console.error("Makale sistemi hatası:", error);

        listEl.innerHTML = `
            <div class="state-msg error">
                // makaleler yüklenemedi
                <br>
                // ${escapeHtml(error.message)}
            </div>
        `;
    }
});


function renderArticles() {

    const listEl = document.getElementById("article-list");

    if (!listEl) return;

    const searchEl = document.getElementById("article-search");

    const query = (
        searchEl?.value || ""
    ).trim().toLowerCase();


    let articles = ALL_ARTICLES;


    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if (query) {

        articles = articles.filter(article => {

            const title = article.title || "";
            const excerpt = article.excerpt || "";
            const tags = Array.isArray(article.tags)
                ? article.tags.join(" ")
                : "";

            const searchableText = (
                title + " " +
                excerpt + " " +
                tags
            ).toLowerCase();

            return searchableText.includes(query);
        });
    }


    // --------------------------------------------------------
    // SONUÇ YOK
    // --------------------------------------------------------

    if (articles.length === 0) {

        listEl.innerHTML = `
            <p class="state-msg">
                // eşleşen makale bulunamadı
            </p>
        `;

        return;
    }


    // --------------------------------------------------------
    // MAKALELER
    // --------------------------------------------------------

    listEl.innerHTML = articles.map(article => {

        const slug = article.slug || "";
        const title = article.title || slug;
        const excerpt = article.excerpt || "";
        const readTime = article.readTime || "";

        const tags = Array.isArray(article.tags)
            ? article.tags
            : [];


        return `
            <div class="row">

                <div class="row-main">

                    <p class="row-meta">

                        <span>
                            ${formatDate(article.date)}
                        </span>

                        <span>
                            ${escapeHtml(readTime)}
                        </span>

                    </p>


                    <h3 class="row-title">

                        <a
                            href="makale.html?slug=${encodeURIComponent(slug)}"
                        >
                            ${escapeHtml(title)}
                        </a>

                    </h3>


                    <p class="row-desc">
                        ${escapeHtml(excerpt)}
                    </p>


                    <div class="tags">

                        ${tags.map(tag => `
                            <span class="chip">
                                ${escapeHtml(tag)}
                            </span>
                        `).join("")}

                    </div>

                </div>

            </div>
        `;

    }).join("");
}


// ============================================================
// TARİH
// ============================================================

function formatDate(date) {

    if (!date) return "";

    try {

        return new Date(date).toLocaleDateString(
            "tr-TR",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    } catch {

        return date;
    }
}


// ============================================================
// HTML ESCAPE
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
        }[char])
    );
}
