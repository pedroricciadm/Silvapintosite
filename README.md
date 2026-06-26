# Site Institucional — Silva Pinto Sociedade de Advogados

Site estático (HTML/CSS/JS) do escritório, servido por **Nginx** em container.

## Deploy (Coolify / VPS)
- **Tipo:** Dockerfile (Nginx servindo `/usr/share/nginx/html`).
- **Domínio:** `silvapintoadv.com.br` (+ `www`) → HTTPS automático (Let's Encrypt).
- **Porta interna:** 80.
- Atualizações: `git push` → Coolify rebuild.

## Estrutura
- `index.html` + páginas (`about`, `areas`, `area-*`, `socias`, `blog*`, `faq`, `contact`).
- `css/`, `js/`, `images/`, `fonts/`.
- `sitemap.xml`, `robots.txt`, `llms.txt`.

## Local (dev)
Servir a pasta com qualquer servidor estático, ex.:
`python -m http.server 3002`

> Marca, conteúdo e conformidade OAB conforme o projeto Silva Pinto. Imagens e textos otimizados para SEO/GEO/LLM.
