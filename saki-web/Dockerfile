# ---- build ---------------------------------------------------------------
FROM node:22.20.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Same-origin build: nginx below proxies /api and /ws to the backend.
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM nginx:1.27.5-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
