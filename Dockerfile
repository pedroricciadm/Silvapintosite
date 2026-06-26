# Site institucional estático — Silva Pinto Sociedade de Advogados
# Servido por Nginx (gzip, cache de assets, headers de segurança).
FROM nginx:1.27-alpine

# Config do servidor
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Conteúdo do site
COPY . /usr/share/nginx/html

# Remove arquivos de infra que não devem ser servidos
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/README.md \
          /usr/share/nginx/html/DEPLOY.md \
          /usr/share/nginx/html/.gitignore \
          /usr/share/nginx/html/.dockerignore

EXPOSE 80
