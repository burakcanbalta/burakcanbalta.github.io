// ============================================================
// SiberPortal — Shared Behaviors + Interactive Terminal
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  initNavigation();

  initFooterYear();

  initTerminal();

});


// ============================================================
// NAVIGATION
// ============================================================

function initNavigation() {

  const navToggle = document.querySelector(".navtoggle");
  const nav = document.querySelector(".nav");

  if (!navToggle || !nav) {
    return;
  }

  navToggle.addEventListener("click", () => {

    nav.classList.toggle("open");

  });

}


// ============================================================
// FOOTER YEAR
// ============================================================

function initFooterYear() {

  document
    .querySelectorAll(".footer-year")
    .forEach(element => {

      element.textContent = new Date().getFullYear();

    });

}


// ============================================================
// INTERACTIVE TERMINAL
// ============================================================

function initTerminal() {

  const terminal = document.querySelector("[data-terminal]");

  if (!terminal) {
    return;
  }


  const body = terminal.querySelector(".term-body");

  const input = terminal.querySelector(".term-input");


  if (!body || !input) {
    return;
  }


  // ----------------------------------------------------------
  // COMMANDS
  // ----------------------------------------------------------

  const commands = {

    help: () => {

      return [
        "Kullanılabilir komutlar:",
        "",
        "help      → komutları göster",
        "whoami    → kullanıcı bilgisi",
        "skills    → teknik yetenekler",
        "certs     → sertifikalar",
        "projeler  → projeler / writeup'lar",
        "iletisim  → iletişim bilgileri",
        "temizle   → terminali temizle"
      ].join("\n");

    },


    whoami: () => {

      return [
        "burakcanbalta",
        "",
        "Siber Güvenlik Araştırmacısı & Pentester",
        "",
        "Odak:",
        "Web Application Security",
        "API Security",
        "Active Directory",
        "Red Team",
        "Vulnerability Research"
      ].join("\n");

    },


    skills: () => {

      return [
        "WEB / API SECURITY        85%",
        "ACTIVE DIRECTORY PENTEST  75%",
        "NETWORK / RECON           80%",
        "LINUX / BASH SCRIPTING    80%",
        "PYTHON                    70%",
        "EXPLOITATION              75%"
      ].join("\n");

    },


    certs: () => {

      return [
        "Sertifikalar:",
        "",
        "→ TryHackMe — Offensive Pentesting",
        "→ CyberExam — Junior SOC Analyst",
        "→ CyberWarFare Labs — Web-RTA",
        "→ CyberWarFare Labs — API-RTA",
        "→ TryHackMe — Jr Penetration Tester",
        "→ TryHackMe — Red Teaming",
        "",
        "Detaylar için aşağıdaki CERTIFICATIONS bölümüne bak."
      ].join("\n");

    },


    projeler: () => {

      return [
        "Projeler / çalışmalar:",
        "",
        "→ SiberPortal",
        "→ CTF / HTB Writeup'ları",
        "→ Web Security Research",
        "→ API Security Research",
        "→ Red Team Labs",
        "→ Security Tools"
      ].join("\n");

    },


    iletisim: () => {

      return [
        "İletişim:",
        "",
        "GitHub   : github.com/burakcanbalta",
        "LinkedIn : linkedin.com/in/burak-balta-976a64261",
        "YouTube  : youtube.com/@SiberPortal",
        "Email    : burakcanbalta@proton.me"
      ].join("\n");

    },


    temizle: () => {

      return "__CLEAR__";

    }

  };


  // ==========================================================
  // ESCAPE
  // ==========================================================

  function escapeHtml(value) {

    return String(value).replace(
      /[&<>"']/g,
      character => {

        const map = {

          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"

        };

        return map[character];

      }
    );

  }


  // ==========================================================
  // PRINT LINE
  // ==========================================================

  function printLine(text, html = false) {

    const line = document.createElement("p");

    line.className = "term-line";


    if (html) {

      line.innerHTML = text;

    } else {

      line.textContent = text;

    }


    const inputRow = body.querySelector(".term-input-row");


    if (inputRow) {

      body.insertBefore(line, inputRow);

    } else {

      body.appendChild(line);

    }

  }


  // ==========================================================
  // RUN COMMAND
  // ==========================================================

  function runCommand(rawCommand) {

    const raw = String(rawCommand || "");

    const command = raw.trim().toLowerCase();


    // Print entered command

    printLine(
      `<span class="p">burak@sibersec:~$</span> <span class="out">${escapeHtml(raw)}</span>`,
      true
    );


    if (!command) {

      return;

    }


    if (!commands[command]) {

      printLine(
        `komut bulunamadı: ${escapeHtml(command)} — "help" yaz.`,
        true
      );

      return;

    }


    const output = commands[command]();


    if (output === "__CLEAR__") {

      body
        .querySelectorAll(".term-line:not(.term-input-row)")
        .forEach(line => line.remove());

      return;

    }


    printLine(
      escapeHtml(output).replace(/\n/g, "<br>"),
      true
    );

  }


  // ==========================================================
  // ENTER
  // ==========================================================

  input.addEventListener("keydown", event => {

    if (event.key !== "Enter") {

      return;

    }


    event.preventDefault();


    runCommand(input.value);


    input.value = "";


    body.scrollTop = body.scrollHeight;

  });


  // ==========================================================
  // TERMINAL CLICK = FOCUS
  // ==========================================================

  terminal.addEventListener("click", () => {

    input.focus();

  });


  // Initial focus

  setTimeout(() => {

    input.focus();

  }, 100);

}
