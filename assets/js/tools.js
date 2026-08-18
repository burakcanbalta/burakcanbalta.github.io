/*
 * ============================================================
 * SIBERPORTAL — SIBERTOOLS
 * ============================================================
 *
 * Araç verileri:
 * content/data/tools.json
 *
 * Özellikler:
 * - Araç arama
 * - Kategori filtreleme
 * - Dinamik kategori oluşturma
 * - İstatistikler
 * - Platform bilgisi
 * - Tag desteği
 * - GitHub / Docs linkleri
 * - Güvenli HTML escaping
 * - JSON yükleme hatası gösterimi
 *
 * ============================================================
 */

'use strict';


/* ============================================================
   CONFIG
   ============================================================ */

const TOOLS_DATA_URL = './content/data/tools.json';


/* ============================================================
   STATE
   ============================================================ */

let ALL_TOOLS = [];

let activeCategory = 'all';

let searchQuery = '';


/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    console.log('[SiberTools] Initializing...');

    setupSearch();

    loadTools();

});


/* ============================================================
   LOAD TOOLS
   ============================================================ */

async function loadTools() {

    const grid = document.getElementById('tools-grid');

    if (!grid) {

        console.error(
            '[SiberTools] #tools-grid bulunamadı.'
        );

        return;

    }


    grid.innerHTML = `
        <div class="state-msg">
            // SiberTools veritabanı yükleniyor...
        </div>
    `;


    try {

        console.log(
            '[SiberTools] Loading:',
            TOOLS_DATA_URL
        );


        const response = await fetch(
            TOOLS_DATA_URL,
            {
                cache: 'no-store'
            }
        );


        console.log(
            '[SiberTools] HTTP:',
            response.status
        );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data = await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                'tools.json bir JSON array olmalı.'
            );

        }


        ALL_TOOLS = data
            .filter(isValidTool)
            .map(normalizeTool);


        console.log(
            `[SiberTools] ${ALL_TOOLS.length} araç yüklendi.`
        );


        if (ALL_TOOLS.length === 0) {

            throw new Error(
                'tools.json boş veya geçersiz.'
            );

        }


        buildCategoryFilters();

        renderStats();

        renderTools();

    }

    catch (error) {

        console.error(
            '[SiberTools] Veri yükleme hatası:',
            error
        );


        grid.innerHTML = `

            <div
                class="state-msg error"
                style="
                    grid-column:1/-1;
                    padding:30px;
                    border:1px solid rgba(255,70,70,.25);
                    border-radius:10px;
                "
            >

                <strong>
                    // ARAÇ VERİTABANI YÜKLENEMEDİ
                </strong>

                <br><br>

                ${escapeHtml(error.message)}

                <br><br>

                <small>
                    Kontrol et:
                    <br>
                    <code>
                    content/data/tools.json
                    </code>

                    <br><br>

                    veya tarayıcı konsolunu aç:
                    <br>
                    F12 → Console
                </small>

            </div>

        `;

    }

}


/* ============================================================
   VALIDATE
   ============================================================ */

function isValidTool(tool) {

    return (
        tool &&
        typeof tool === 'object' &&
        typeof tool.name === 'string' &&
        tool.name.trim() !== ''
    );

}


/* ============================================================
   NORMALIZE
   ============================================================ */

function normalizeTool(tool) {

    return {

        name:
            String(tool.name || '')
                .trim(),

        category:
            String(
                tool.category || 'misc'
            )
                .trim()
                .toLowerCase(),

        description:
            String(
                tool.description || 'Güvenlik aracı.'
            )
                .trim(),

        link:
            typeof tool.link === 'string'
                ? tool.link.trim()
                : '',

        github:
            typeof tool.github === 'string'
                ? tool.github.trim()
                : '',

        docs:
            typeof tool.docs === 'string'
                ? tool.docs.trim()
                : '',

        platform:
            Array.isArray(tool.platform)
                ? tool.platform
                : [],

        tags:
            Array.isArray(tool.tags)
                ? tool.tags
                : []

    };

}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

    const input =
        document.getElementById(
            'tools-search'
        );


    if (!input) return;


    input.addEventListener(
        'input',
        event => {

            searchQuery =
                event.target.value
                    .toLowerCase()
                    .trim();


            renderTools();

        }
    );

}


/* ============================================================
   CATEGORY FILTERS
   ============================================================ */

function buildCategoryFilters() {

    const container =
        document.getElementById(
            'cat-filters'
        );


    if (!container) return;


    const categories =
        [...new Set(
            ALL_TOOLS
                .map(tool => tool.category)
                .filter(Boolean)
        )]
        .sort();


    let html = `

        <button
            class="filter-btn active"
            data-category="all"
        >
            tümü
        </button>

    `;


    categories.forEach(category => {

        const count =
            ALL_TOOLS.filter(
                tool =>
                    tool.category === category
            ).length;


        html += `

            <button
                class="filter-btn"
                data-category="${escapeAttr(category)}"
            >
                ${escapeHtml(category)}
                <span style="opacity:.55">
                    (${count})
                </span>
            </button>

        `;

    });


    container.innerHTML = html;


    container
        .querySelectorAll(
            '[data-category]'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    activeCategory =
                        button.dataset.category;


                    container
                        .querySelectorAll(
                            '.filter-btn'
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    'active'
                                )
                        );


                    button.classList.add(
                        'active'
                    );


                    renderTools();

                }
            );

        });

}


/* ============================================================
   FILTER
   ============================================================ */

function getFilteredTools() {

    return ALL_TOOLS.filter(tool => {

        const categoryMatch =
            activeCategory === 'all' ||
            tool.category === activeCategory;


        if (!categoryMatch) {
            return false;
        }


        if (!searchQuery) {
            return true;
        }


        const searchable = [

            tool.name,

            tool.category,

            tool.description,

            ...(tool.tags || []),

            ...(tool.platform || [])

        ]
            .join(' ')
            .toLowerCase();


        return searchable.includes(
            searchQuery
        );

    });

}


/* ============================================================
   RENDER TOOLS
   ============================================================ */

function renderTools() {

    const grid =
        document.getElementById(
            'tools-grid'
        );


    if (!grid) return;


    const tools =
        getFilteredTools();


    if (tools.length === 0) {

        grid.innerHTML = `

            <div
                class="state-msg"
                style="grid-column:1/-1"
            >
                // eşleşen araç bulunamadı
            </div>

        `;

        renderStats();

        return;

    }


    grid.innerHTML =
        tools
            .map(
                (tool, index) =>
                    createToolCard(
                        tool,
                        index
                    )
            )
            .join('');


    renderStats();

}


/* ============================================================
   TOOL CARD
   ============================================================ */

function createToolCard(
    tool,
    index
) {

    const platformHTML =
        tool.platform
            .map(
                platform =>
                    `<span class="chip">
                        ${escapeHtml(platform)}
                    </span>`
            )
            .join('');


    const tagsHTML =
        tool.tags
            .slice(0, 4)
            .map(
                tag =>
                    `<span class="chip">
                        ${escapeHtml(tag)}
                    </span>`
            )
            .join('');


    let linksHTML = '';


    if (tool.link) {

        linksHTML += `

            <a
                class="chip"
                href="${escapeAttr(tool.link)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Docs ↗
            </a>

        `;

    }


    if (
        tool.github &&
        tool.github !== tool.link
    ) {

        linksHTML += `

            <a
                class="chip"
                href="${escapeAttr(tool.github)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                GitHub ↗
            </a>

        `;

    }


    return `

        <article
            class="card tool-card"
            style="
                animation-delay:${index * 20}ms;
            "
        >

            <div class="card-icon">
                ⚒
            </div>


            <h3>
                ${escapeHtml(tool.name)}
            </h3>


            <p>
                ${escapeHtml(tool.description)}
            </p>


            <div
                class="tags"
                style="margin-top:14px;"
            >

                <span class="chip">
                    ${escapeHtml(
                        tool.category
                    )}
                </span>

                ${platformHTML}

                ${tagsHTML}

            </div>


            ${
                linksHTML
                    ? `
                    <div
                        class="tags"
                        style="margin-top:12px;"
                    >
                        ${linksHTML}
                    </div>
                    `
                    : ''
            }

        </article>

    `;

}


/* ============================================================
   STATISTICS
   ============================================================ */

function renderStats() {

    const stats =
        document.getElementById(
            'tools-stats'
        );


    if (!stats) return;


    const visible =
        getFilteredTools();


    const categories =
        new Set(
            ALL_TOOLS.map(
                tool => tool.category
            )
        );


    const offensiveCategories = [

        'recon',

        'web',

        'exploitation',

        'active-directory',

        'password',

        'red-team',

        'network',

        'privilege-escalation'

    ];


    const offensive =
        ALL_TOOLS.filter(
            tool =>
                offensiveCategories.includes(
                    tool.category
                )
        ).length;


    stats.innerHTML = `

        <div class="card">

            <div class="card-icon">
                ⚒
            </div>

            <strong
                style="
                    display:block;
                    font-size:26px;
                "
            >
                ${ALL_TOOLS.length}
            </strong>

            <span>
                TOPLAM ARAÇ
            </span>

        </div>


        <div class="card">

            <div class="card-icon">
                ◈
            </div>

            <strong
                style="
                    display:block;
                    font-size:26px;
                "
            >
                ${categories.size}
            </strong>

            <span>
                KATEGORİ
            </span>

        </div>


        <div class="card">

            <div class="card-icon">
                ⚡
            </div>

            <strong
                style="
                    display:block;
                    font-size:26px;
                "
            >
                ${offensive}
            </strong>

            <span>
                OFFENSIVE / PENTEST
            </span>

        </div>


        <div class="card">

            <div class="card-icon">
                ▣
            </div>

            <strong
                style="
                    display:block;
                    font-size:26px;
                "
            >
                ${visible.length}
            </strong>

            <span>
                GÖRÜNTÜLENİYOR
            </span>

        </div>

    `;

}


/* ============================================================
   SECURITY HELPERS
   ============================================================ */

function escapeHtml(value = '') {

    return String(value)
        .replace(
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


/* ============================================================
   DEBUG
   ============================================================ */

window.SiberTools = {

    getAll: () =>
        ALL_TOOLS,

    getFiltered:
        () =>
            getFilteredTools(),

    reload:
        () =>
            loadTools()

};


console.log(
    '[SiberTools] tools.js loaded.'
);
