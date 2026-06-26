# Site institucional estático — Silva Pinto Sociedade de Advogados
# Servido por Nginx (gzip, cache de assets, headers de segurança).
FROM nginx:1.27-alpine

# Config do servidor
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Conteúdo do site (o .dockerignore exclui Dockerfile/nginx.conf/README/.git)
COPY . /usr/share/nginx/html

EXPOSE 80
