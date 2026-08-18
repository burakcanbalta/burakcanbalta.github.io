```javascript
// ============================================================
// SiberPortal — Shared Behaviors
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // ----------------------------------------------------------
  // MOBILE NAV
  // ----------------------------------------------------------

  const navToggle = document.querySelector(".navtoggle");
  const nav = document.querySelector(".nav");

  if (navToggle && nav) {

    navToggle.addEventListener("click", () => {
      nav.classList.toggle("open");
    });

  }


  // ----------------------------------------------------------
  // FOOTER YEAR
  // ----------------------------------------------------------

  document
    .querySelectorAll(".footer-year")
    .forEach(el => {
      el.textContent = new Date().getFullYear();
    });


  // ----------------------------------------------------------
  // TERMINAL
  // ----------------------------------------------------------

  initTerminal();

});


// ============================================================
// INTERACTIVE TERMINAL
// ============================================================

function initTerminal() {

  const term = document.querySelector("[data-terminal]");

  if (!term) return;


  const body = term.querySelector(".term-body");
  const input = term.querySelector(".term-input");


  if (!body || !input) return;


  // ----------------------------------------------------------
  // COMMANDS
  // ----------------------------------------------------------

  const CMDS = {

    help: () =>
      `Kullanılabilir komutlar:
help, whoami, skills, certs, projeler, iletisim, temizle`,

    whoami: () =>
      `burakcanbalta — Siber Güvenlik Araştırmacısı & Pentester
Odak: Web App Sec, API Security, Red Team, Active Directory`,

    skills: () =>
      `Web / API Security — 85%
Active Directory Pentest — 75%
Network / Recon — 80%
Linux / Bash Scripting — 80%
Python — 70%
Exploitation — 75%`,

    certs: () =>
      `→ Sertifikalar için "hakkimda.html#sertifikalar" adresine git.`,

    projeler: () =>
      `→ Makaleler ve writeup'lar için "makaleler.html" sayfasına git.`,

    iletisim: () =>
      `mail: burakcanbalta@proton.me
github: github.com/burakcanbalta
linkedin: linkedin.com/in/burak-balta-976a64261/
youtube: youtube.com/@SiberPortal`,

    temizle: () =>
      "__CLEAR__"

  };


  // ----------------------------------------------------------
  // HTML ESCAPE
  // ----------------------------------------------------------

  function escapeHtml(value) {

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


  // ----------------------------------------------------------
  // PRINT LINE
  // ----------------------------------------------------------

  function printLine(text, html = false) {

    const p = document.createElement("p");

    p.className = "term-line";


    if (html) {
      p.innerHTML = text;
    } else {
      p.textContent = text;
    }


    const inputRow =
      body.querySelector(".term-input-row");


    if (inputRow) {
      body.insertBefore(p, inputRow);
    } else {
      body.appendChild(p);
    }

  }


  // ----------------------------------------------------------
  // RUN COMMAND
  // ----------------------------------------------------------

  function runCommand(raw) {

    const command = raw.trim().toLowerCase();


    // Kullanıcının girdiği komutu terminale yaz

    printLine(
      `<span class="p">burak@sibersec:~$</span> ` +
      `<span class="out">${escapeHtml(raw)}</span>`,
      true
    );


    if (!command) return;


    // Komut mevcut mu?

    if (CMDS[command]) {

      const output = CMDS[command]();


      // CLEAR

      if (output === "__CLEAR__") {

        body
          .querySelectorAll(".term-line")
          .forEach(line => line.remove());

        return;
      }


      // Çıktıyı yaz

      printLine(
        escapeHtml(output)
          .replace(/\n/g, "<br>"),
        true
      );


      return;
    }


    // Bilinmeyen komut

    printLine(
      `komut bulunamadı: ` +
      `<span class="out">${escapeHtml(command)}</span>` +
      ` — "help" yaz.`,
      true
    );

  }


  // ----------------------------------------------------------
  // ENTER
  // ----------------------------------------------------------

  input.addEventListener("keydown", event => {

    if (event.key !== "Enter") return;


    event.preventDefault();


    runCommand(input.value);


    input.value = "";


    body.scrollTop = body.scrollHeight;

  });


  // ----------------------------------------------------------
  // CLICK TERMINAL → FOCUS
  // ----------------------------------------------------------

  term.addEventListener("click", () => {

    input.focus();

  });


  // ----------------------------------------------------------
  // INITIAL FOCUS
  // ----------------------------------------------------------

  input.focus();

}
```
