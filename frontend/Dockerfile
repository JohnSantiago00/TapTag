FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development \
    EXPO_NO_TELEMETRY=1 \
    CHOKIDAR_USEPOLLING=1 \
    WATCHPACK_POLLING=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8081 19000 19001 19002

CMD ["npm", "start", "--", "--lan"]
