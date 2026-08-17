// ============ shared behaviors ============
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.navtoggle');
  const nav = document.querySelector('.nav');
  if (navToggle) navToggle.addEventListener('click', () => nav.classList.toggle('open'));

  document.querySelectorAll('.footer-year').forEach(el => el.textContent = new Date().getFullYear());

  initTerminal();
});

// ============ interactive hero/about terminal (signature element) ============
function initTerminal() {
  const term = document.querySelector('[data-terminal]');
  if (!term) return;

  const body = term.querySelector('.term-body');
  const input = term.querySelector('.term-input');

  const CMDS = {
    help: () => `Kullanılabilir komutlar: help, whoami, skills, certs, projeler, iletisim, temizle`,
    whoami: () => `burakcanbalta — Siber Güvenlik Araştırmacısı & Pentester\nOdak: Web App Sec, Red Team, Zafiyet Araştırması`,
    skills: () => `OWASP Top 10 · Active Directory Pentest · Python/Bash Scripting\nBurp Suite · Metasploit · Nmap · Wireshark · Linux Internals`,
    certs: () => `→ Sertifikalar sayfası için "hakkimda.html#sertifikalar" adresine git.`,
    projeler: () => `→ Makaleler ve writeup'lar için "makaleler.html" sayfasına bak.`,
    iletisim: () => `mail: contact@burakcanbalta.dev  ·  github: github.com/burakcanbalta`,
    temizle: () => '__CLEAR__',
  };

  function printLine(text, cls) {
    const p = document.createElement('p');
    p.className = 'term-line';
    if (cls) p.innerHTML = text;
    else p.textContent = text;
    body.insertBefore(p, body.querySelector('.term-input-row'));
  }

  function runCommand(raw) {
    const cmd = raw.trim().toLowerCase();
    printLine(`<span class="p">burak@sibersec:~$</span> <span class="out">${escapeHtml(raw)}</span>`, true);
    if (!cmd) return;
    if (CMDS[cmd]) {
      const out = CMDS[cmd]();
      if (out === '__CLEAR__') {
        body.querySelectorAll('.term-line').forEach(l => l.remove());
        return;
      }
      printLine(out.split('\n').map(escapeHtml).join('<br>'), true);
    } else {
      printLine(`komut bulunamadı: ${escapeHtml(cmd)} — "help" yaz.`);
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        runCommand(input.value);
        input.value = '';
        body.scrollTop = body.scrollHeight;
      }
    });
  }

  // click anywhere in terminal focuses input
  term.addEventListener('click', () => input && input.focus());
}
