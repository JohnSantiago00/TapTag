FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json ./
COPY tapTag/package.json tapTag/package.json
COPY tapTag/package-lock.json tapTag/package-lock.json

RUN npm install

COPY . .

FROM deps AS web-builder
WORKDIR /app/tapTag
ENV CI=1

RUN npx expo export --platform web

FROM nginx:1.27-alpine AS web-runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/tapTag/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
