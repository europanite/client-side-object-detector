FROM node:22-bookworm-slim

WORKDIR /app

COPY app/package*.json ./
RUN npm install --legacy-peer-deps

COPY app/ ./
RUN npm run typecheck
RUN npm run build:web

EXPOSE 8081
CMD ["node", "server.mjs"]
