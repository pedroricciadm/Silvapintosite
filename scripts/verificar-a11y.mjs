#!/usr/bin/env node
/**
 * VERIFICAÇÃO DE ACESSIBILIDADE — teclado, semântica e contraste do site.
 *
 * O que ele protege (revisão de 28/09/2026): o botão do menu mobile era um
 * <span> que o Tab não alcançava; o template zerava o contorno de foco de todo
 * link; ícones do rodapé, cards da home e campos do Contato não tinham nome
 * para leitor de tela; o dourado de acento como texto pequeno ficava abaixo de
 * 4,5:1 na areia. Consertado uma vez, isso volta sem ninguém notar na próxima
 * página copiada do template. Este script falha antes.
 *
 * Estático e sem dependências: lê os .html da raiz, o CSS do esquema e o JS do
 * menu, sem navegador e sem rede. Não substitui passar a página no teclado.
 *
 * Uso:
 *   node scripts/verificar-a11y.mjs      # sai com código 1 se algo regrediu
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ESQUEMA = join(RAIZ, "css", "colors", "scheme-arejado.css");
const SCRIPT_MENU = join(RAIZ, "js", "designesia.js");

const falhas = [];
const falha = (onde, msg) => falhas.push(`${onde}: ${msg}`);

function attr(tag, nome) {
  const m = tag.match(new RegExp(`\\s${nome}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return m ? m[2] : null;
}

function texto(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Nome acessível aproximado: aria-label/labelledby/title, texto ou alt de imagem interna. */
function temNome(tag, interno) {
  if (attr(tag, "aria-label")?.trim() || attr(tag, "aria-labelledby")?.trim() || attr(tag, "title")?.trim()) return true;
  if (texto(interno)) return true;
  return [...interno.matchAll(/<img\b[^>]*>/gi)].some((m) => attr(m[0], "alt")?.trim());
}

// ------------------------------------------------------------------ páginas

let conferidas = 0;
for (const pagina of readdirSync(RAIZ).filter((f) => f.endsWith(".html")).sort()) {
  const bruto = readFileSync(join(RAIZ, pagina), "utf8");
  // os blog-*.html são só redirecionamentos para o blog externo
  if (/http-equiv=["']refresh["']/i.test(bruto)) continue;
  conferidas++;

  const html = bruto.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const ids = new Set([...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));

  if (!attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang")) falha(pagina, "<html> sem lang");

  const mains = html.match(/<main\b[^>]*>/gi) ?? [];
  if (mains.length !== 1) falha(pagina, `${mains.length} <main> (esperado 1)`);
  const h1s = (html.match(/<h1\b/gi) ?? []).length;
  if (h1s !== 1) falha(pagina, `${h1s} <h1> (esperado 1)`);

  // o primeiro Tab da página é o "pular para o conteúdo", e ele leva ao <main>
  const corpo = html.slice(Math.max(0, html.search(/<body\b/i)));
  const primeiro = corpo.match(/<(a|button|input|select|textarea)\b[^>]*>/i)?.[0] ?? "";
  if (!/\bskip-link\b/.test(attr(primeiro, "class") ?? "")) {
    falha(pagina, "o primeiro elemento focável não é o link .skip-link");
  } else {
    const alvo = (attr(primeiro, "href") ?? "").replace(/^#/, "");
    if (!alvo || !mains[0] || attr(mains[0], "id") !== alvo) falha(pagina, `.skip-link aponta para "#${alvo}", que não é o id do <main>`);
  }

  // botão do menu mobile: alcançável por Tab e anunciando o estado
  const btn = html.match(/<[a-z]+\b[^>]*\sid=["']menu-btn["'][^>]*>/i)?.[0];
  if (!btn) {
    falha(pagina, "sem #menu-btn");
  } else {
    if (!/^<button\b/i.test(btn)) falha(pagina, "#menu-btn não é <button> (o Tab não chega nele)");
    if (attr(btn, "type") !== "button") falha(pagina, '#menu-btn sem type="button"');
    if (!attr(btn, "aria-label")?.trim()) falha(pagina, "#menu-btn sem aria-label");
    if (attr(btn, "aria-expanded") !== "false") falha(pagina, '#menu-btn deve começar com aria-expanded="false"');
    const controla = attr(btn, "aria-controls");
    if (!controla || !ids.has(controla)) falha(pagina, `#menu-btn aria-controls="${controla}" não aponta para um id da página`);
  }

  // #mainmenu dentro de um marco de navegação, no <header>
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? "";
  const iMenu = header.search(/\sid=["']mainmenu["']/i);
  const iNav = header.search(/<nav\b|\srole=["']navigation["']/i);
  if (iMenu < 0) falha(pagina, "#mainmenu fora do <header>");
  else if (iNav < 0 || iNav > iMenu) falha(pagina, '#mainmenu sem <nav> ou role="navigation" em volta');

  // todo link e botão com nome para leitor de tela
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    if (!temNome(`<${m[1]}${m[2]}>`, m[3])) {
      falha(pagina, `<${m[1]}> sem nome acessível: ${m[0].replace(/\s+/g, " ").slice(0, 100)}…`);
    }
  }

  // imagens com alt (alt="" vale: é a marcação de decorativa)
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (attr(m[0], "alt") === null) falha(pagina, `<img> sem alt: ${attr(m[0], "src")}`);
  }

  // campos de formulário com rótulo (placeholder some ao digitar, não conta)
  const rotulados = new Set([...html.matchAll(/<label\b[^>]*>/gi)].map((m) => attr(m[0], "for")).filter(Boolean));
  for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tipo = (attr(m[0], "type") ?? "").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(tipo)) continue;
    const id = attr(m[0], "id");
    if (attr(m[0], "aria-label")?.trim() || attr(m[0], "aria-labelledby") || (id && rotulados.has(id))) continue;
    falha(pagina, `<${m[1]}> sem rótulo: name="${attr(m[0], "name")}"`);
  }
}
if (conferidas === 0) falha("raiz", "nenhuma página conferida");

// ------------------------------------------------------------------ foco e contraste

function luminancia(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// as cores vêm do próprio esquema: se a paleta mudar, a conta muda junto
const css = readFileSync(ESQUEMA, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const HEX = "(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\\b";
const achar = (re) => css.match(re)?.[1];
const cor = {
  corpo: achar(new RegExp(`--body-font-color\\s*:\\s*${HEX}`, "i")),
  bgDefault: achar(new RegExp(`--bg-default\\s*:\\s*${HEX}`, "i")),
  bgLight: achar(new RegExp(`--bg-light\\s*:\\s*${HEX}`, "i")),
  bgGrey: achar(new RegExp(`--bg-grey\\s*:\\s*${HEX}`, "i")),
  bgDark: achar(new RegExp(`--bg-dark-1\\s*:\\s*${HEX}`, "i")),
  rodape: achar(new RegExp(`footer\\s*\\{\\s*background\\s*:\\s*${HEX}`, "i")),
  idColor: achar(new RegExp(`\\.id-color\\s*,\\s*a\\.id-color\\s*\\{\\s*color\\s*:\\s*${HEX}`, "i")),
  // o template zera outline em todo link: sem !important o anel não aparece
  foco: achar(new RegExp(`(?:^|\\})\\s*:focus-visible\\s*\\{[^}]*outline\\s*:\\s*\\d+px\\s+solid\\s+${HEX}\\s*!important`, "i")),
  focoEscuro: achar(new RegExp(`:focus-visible\\s*\\{\\s*outline-color\\s*:\\s*${HEX}\\s*!important`, "i")),
};
const ausentes = Object.entries(cor).filter(([, v]) => !v).map(([k]) => k);
if (ausentes.length) falha("scheme-arejado.css", `não encontrei no CSS: ${ausentes.join(", ")}`);

const claros = { "--bg-default": cor.bgDefault, "--bg-light": cor.bgLight, "--bg-grey": cor.bgGrey, branco: "#ffffff" };
const escuros = { "--bg-dark-1": cor.bgDark, rodapé: cor.rodape };
const exigencias = [
  // [o quê, cor, fundos, mínimo WCAG]
  ["texto do corpo", cor.corpo, claros, 4.5],
  ["texto .id-color", cor.idColor, claros, 4.5],
  ["anel de foco", cor.foco, claros, 3],
  ["anel de foco em bloco escuro", cor.focoEscuro, escuros, 3],
  ["link .skip-link (branco)", "#ffffff", { "--bg-dark-1": cor.bgDark }, 4.5],
];
console.log("contraste:");
for (const [oque, frente, fundos, minimo] of exigencias) {
  if (!frente) continue;
  for (const [nome, fundo] of Object.entries(fundos)) {
    if (!fundo) continue;
    const r = contraste(frente, fundo);
    const ok = r >= minimo;
    console.log(`  ${ok ? "ok  " : "FALHA"} ${oque} ${frente} sobre ${nome} ${fundo}: ${r.toFixed(2)}:1 (mín. ${minimo})`);
    if (!ok) falha("scheme-arejado.css", `${oque} ${frente} sobre ${nome} ${fundo} dá ${r.toFixed(2)}:1, abaixo de ${minimo}:1`);
  }
}

// ------------------------------------------------------------------ menu mobile (JS)

const js = readFileSync(SCRIPT_MENU, "utf8");
if (!/function setMenuMobile\(/.test(js) || !/attr\('aria-expanded'/.test(js)) {
  falha("js/designesia.js", "o menu mobile não atualiza aria-expanded (setMenuMobile)");
}
if (!/e\.key === "Escape"/.test(js)) falha("js/designesia.js", "Esc não fecha o menu mobile");

// ------------------------------------------------------------------ resultado

console.log(`\npáginas conferidas: ${conferidas} (redirecionamentos para o blog ignorados)`);
if (falhas.length) {
  console.error(`\n${falhas.length} problema(s) de acessibilidade:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("acessibilidade: nenhuma regressão encontrada.");
