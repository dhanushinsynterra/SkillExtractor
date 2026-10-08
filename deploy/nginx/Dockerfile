# Builds the web app and serves it with Nginx, proxying /api and /ws to the app.
FROM node:22-alpine AS web
WORKDIR /src
COPY shared ./shared
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --ignore-scripts && npm rebuild esbuild
COPY web ./web
RUN cd web && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/docker.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/synterra.common.conf /etc/nginx/snippets/synterra.common.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/synterra-security-headers.conf
COPY deploy/nginx/proxy.conf /etc/nginx/snippets/synterra-proxy.conf
COPY --from=web /src/web/dist /usr/share/nginx/html
