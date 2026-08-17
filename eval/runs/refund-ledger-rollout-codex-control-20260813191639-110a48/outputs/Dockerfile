FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
CMD ["node", "src/server.js"]
