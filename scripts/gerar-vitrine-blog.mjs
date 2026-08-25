#!/usr/bin/env node
/**
 * VITRINE DO BLOG — regenera os cards de blog.html a partir do blog de verdade.
 *
 * O problema que ele resolve (25/08/2026): o blog tinha 72 artigos publicados e
 * esta página mostrava 3, os mesmos desde junho, com links no formato antigo.
 * Vitrine de loja com a roupa da estação passada.
 *
 * Por que um script e não uma geração no build do Docker: o site é estático de
 * propósito, e é essa a sua virtude — ele fica de pé sem depender de nada. Ir à
 * rede durante o `docker build` transformaria o blog fora do ar em deploy
 * quebrado. Aqui a rede é usada na hora de AUTORAR: roda-se o script, confere-se
 * o diff, commita-se HTML puro.
 *
 * Uso:
 *   node scripts/gerar-vitrine-blog.mjs           # regrava blog.html
 *   node scripts/gerar-vitrine-blog.mjs --dry     # só mostra o que faria
 *   node scripts/gerar-vitrine-blog.mjs --n=12    # muda a quantidade de cards
 *
 * Falha em silêncio nunca: se a rede cair, se o sitemap mudar de forma ou se
 * vierem menos artigos do que o pedido, o script sai com erro e NÃO escreve.
 * Página que perde os cards sem ninguém notar seria pior que a página velha.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOG = "https://blog.silvapintoadv.com.br";
const ARQUIVO = join(RAIZ, "blog.html");
const MARCA_INICIO = "<!-- VITRINE-BLOG:INICIO";
const MARCA_FIM = "<!-- VITRINE-BLOG:FIM -->";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const QUANTOS = Number(args.find((a) => a.startsWith("--n="))?.slice(4) ?? 9);
// buscamos mais do que mostramos: `lastmod` é edição, `datePublished` é publicação,
// e as duas ordens não coincidem quando um artigo antigo é corrigido.
const BUSCAR = QUANTOS + 6;

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function dataBR(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function escapar(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function pegar(url) {
  const r = await fetch(url, { headers: { "user-agent": "silva-pinto-site/gerar-vitrine" } });
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
  return r.text();
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([\s\S]*?)["']/i)?.[1]?.trim() ?? null;
}

/** O título do artigo vem com o sufixo da marca; na vitrine ele é ruído repetido. */
function tituloLimpo(t) {
  return t.replace(/\s*\|\s*Silva Pinto.*$/i, "").trim();
}

async function main() {
  const sitemap = await pegar(`${BLOG}/sitemap.xml`);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u !== `${BLOG}/` && u !== BLOG);
  if (urls.length < QUANTOS) throw new Error(`sitemap trouxe ${urls.length} artigos, menos que os ${QUANTOS} pedidos`);
  console.log(`sitemap: ${urls.length} artigos publicados`);

  const alvo = urls.slice(0, BUSCAR);
  const artigos = [];
  for (const url of alvo) {
    try {
      const html = await pegar(url);
      const titulo = meta(html, "og:title");
      const imagem = meta(html, "og:image");
      if (!titulo || !imagem) throw new Error("sem og:title ou og:image");
      artigos.push({
        url: meta(html, "og:url") ?? url,
        titulo: tituloLimpo(titulo),
        resumo: meta(html, "og:description") ?? "",
        imagem,
        secao: html.match(/"articleSection":"([^"]+)"/)?.[1] ?? "Artigo",
        publicado: html.match(/"datePublished":"([^"]+)"/)?.[1] ?? null,
      });
    } catch (e) {
      console.warn(`  ignorado ${url}: ${e.message}`);
    }
  }

  artigos.sort((a, b) => String(b.publicado ?? "").localeCompare(String(a.publicado ?? "")));
  const mostrar = artigos.slice(0, QUANTOS);
  if (mostrar.length < QUANTOS) {
    throw new Error(`só ${mostrar.length} artigos utilizáveis dos ${QUANTOS} pedidos — nada foi escrito`);
  }

  const cards = mostrar
    .map(
      (a) => `
                        <div class="col-lg-4 col-md-6">
                            <div class="hover">
                                <div class="relative overflow-hidden rounded-1">
                                    <div class="wow scaleIn">
                                        <img width="1200" height="630" loading="lazy" src="${escapar(a.imagem)}" class="w-100 hover-scale-1-1 wow" alt="${escapar(a.titulo)}">
                                    </div>
                                    <a href="${escapar(a.url)}" class="d-block abs w-100 h-100 top-0 start-0" aria-label="${escapar(a.titulo)}"></a>
                                </div>
                                <div class="pt-4">
                                    <div class="fs-12 fw-600 id-color mb-1 text-uppercase">${escapar(a.secao)}</div>
                                    <h3><a class="text-dark" href="${escapar(a.url)}">${escapar(a.titulo)}</a></h3>
                                    <p class="mb-3">${escapar(a.resumo)}</p>
                                    <div class="fs-14"><i class="icofont-ui-calendar id-color me-2"></i><span>${a.publicado ? dataBR(a.publicado) : ""}</span></div>
                                </div>
                            </div>
                        </div>`,
    )
    .join("\n");

  const original = readFileSync(ARQUIVO, "utf8");
  const i = original.indexOf(MARCA_INICIO);
  const f = original.indexOf(MARCA_FIM);
  if (i < 0 || f < 0) throw new Error("marcadores VITRINE-BLOG não encontrados em blog.html");
  const fimLinha = original.indexOf("\n", i);
  const novo = original.slice(0, fimLinha + 1) + cards + "\n\n" + original.slice(f);

  console.log(`\nvitrine com ${mostrar.length} artigos:`);
  for (const a of mostrar) console.log(`  ${a.publicado?.slice(0, 10)}  ${a.secao.padEnd(24)} ${a.titulo}`);

  if (DRY) {
    console.log("\n--dry: nada foi escrito.");
    return;
  }
  writeFileSync(ARQUIVO, novo, "utf8");
  console.log(`\nblog.html regravado (${novo.length - original.length >= 0 ? "+" : ""}${novo.length - original.length} bytes).`);
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  console.error("blog.html NÃO foi alterado.");
  process.exit(1);
});
