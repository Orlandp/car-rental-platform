# --- build the static bundle ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Left empty on purpose: with nginx.conf proxying /api and /static to the backend
# service, the frontend can use same-origin relative requests instead of a
# hardcoded absolute URL. Override with --build-arg VITE_API_URL=... to point
# the built bundle at a different backend instead.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- serve it ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
