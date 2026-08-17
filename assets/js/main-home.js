const menuBtn = document.querySelector(".menu");
const navLinks = document.querySelector(".nav-links");
if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    const open = navLinks.style.display === "flex";
    navLinks.style.display = open ? "none" : "flex";
    navLinks.style.flexDirection = "column";
    navLinks.style.position = "absolute";
    navLinks.style.top = "66px";
    navLinks.style.left = "0";
    navLinks.style.right = "0";
    navLinks.style.background = "#030605";
    navLinks.style.padding = "14px 20px";
    navLinks.style.borderBottom = "1px solid var(--line)";
  });
}

const toggle = document.querySelector(".terminal-toggle");
const terminal = document.querySelector(".terminal");
const close = document.querySelector(".terminal-head button");
const input = document.querySelector(".prompt-line input");
const body = document.querySelector(".terminal-body");

toggle.addEventListener("click", () => {
  terminal.hidden = !terminal.hidden;
  if (!terminal.hidden) input.focus();
});
close.addEventListener("click", () => terminal.hidden = true);

input.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const cmd = input.value.trim().toLowerCase();
  const out = document.createElement("div");
  const prompt = document.createElement("div");
  prompt.innerHTML = `<span style="color:#00ff66">burak@security:~$</span> ${input.value}`;
  body.insertBefore(prompt, document.querySelector(".prompt-line"));

  if (cmd === "help") out.textContent = "about  writeups  cve  youtube  github  clear";
  else if (cmd === "about") out.textContent = "Cybersecurity student | Pentesting | Web/API | Active Directory";
  else if (cmd === "writeups") out.textContent = "Writeup sistemi bir sonraki adımda geliyor.";
  else if (cmd === "cve") out.textContent = "CVE dashboard bir sonraki adımda geliyor.";
  else if (cmd === "youtube") window.open("https://www.youtube.com/", "_blank");
  else if (cmd === "github") window.open("https://github.com/burakcanbalta", "_blank");
  else if (cmd === "clear") {
    [...body.children].forEach(el => { if (el !== document.querySelector(".prompt-line")) el.remove(); });
    input.value = "";
    return;
  } else if (cmd) out.textContent = `command not found: ${cmd}`;

  body.insertBefore(out, document.querySelector(".prompt-line"));
  input.value = "";
});
