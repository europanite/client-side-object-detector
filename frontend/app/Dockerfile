FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run typecheck
RUN npm run build:web

EXPOSE 8080
CMD ["node", "server.mjs"]
