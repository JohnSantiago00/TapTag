FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 4000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/livez').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "./src/server.mjs"]
