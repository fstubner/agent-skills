FROM node:22-slim
WORKDIR /app

# No configuration here. The same image runs in every environment; the
# environment supplies its own values at deploy time.
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
