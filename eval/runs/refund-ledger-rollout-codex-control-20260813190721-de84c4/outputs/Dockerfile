FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
