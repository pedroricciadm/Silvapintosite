# Deploy — Site Silva Pinto (Coolify + GitHub + registro.br)

VPS: **187.77.32.17** (Hostinger/Coolify) · Domínio: **silvapintoadv.com.br**

## Rollout SEM downtime (recomendado)
O site antigo (54.158.202.31) continua no ar até o DNS mudar. Então:
1) sobe na VPS e testa por domínio temporário; 2) só depois aponta o DNS.

---

## Passo A — GitHub (subir o código)
1. Criar repositório **privado** no GitHub, ex.: `pedroricciadm/silva-pinto-site` (sem README/license, vazio).
2. No `C:\dev\silva-pinto-site`:
   ```
   git remote add origin https://github.com/<usuario>/silva-pinto-site.git
   git push -u origin main
   ```

## Passo B — Coolify (deploy na VPS) — Claude do navegador / Victor
1. Coolify → projeto **HubRicciProducao** → **+ New Resource** → **Public/Private Repository** → escolher `silva-pinto-site` (branch `main`).
2. **Build Pack: Dockerfile** (o repo já tem `Dockerfile` + `nginx.conf`). Porta: **80**.
3. **Deploy** e validar pelo domínio temporário do Coolify (ex.: `*.sslip.io`) ou um subdomínio de teste → conferir o site no ar na VPS.
4. **Domains:** adicionar `https://silvapintoadv.com.br` e `https://www.silvapintoadv.com.br`. Ativar **HTTPS (Let's Encrypt)** — o certificado só emite DEPOIS que o DNS (passo C) apontar para a VPS.

## Passo C — DNS no registro.br — Victor
1. Entrar no **registro.br** → domínio **silvapintoadv.com.br** → **DNS**.
2. Trocar os **nameservers**: de `dns1–4.yooserver01.com.br` → **usar o DNS do próprio registro.br** ("Usar os servidores DNS do Registro.br").
3. Em **Editar zona**, criar os registros:
   ```
   A    @     187.77.32.17
   A    www   187.77.32.17
   ```
4. Salvar. Propagação ~1–4h (pode levar até 24h).
5. Quando propagar, no Coolify reemitir o **Let's Encrypt** (HTTPS) para os domínios.

## Pós-deploy
- Redirect `www` ↔ apex (definir o canônico; os schemas/sitemap usam `silvapintoadv.com.br` sem www).
- Confirmar `sitemap.xml`, `robots.txt`, `llms.txt` acessíveis.
- Testar todas as páginas + formulário de contato (hoje via WhatsApp/Gmail/Mapa; `contact.php` foi removido pois static não roda PHP).

## Atualizações futuras
`git push` no `main` → Coolify faz rebuild automático.
