FROM node:22-slim
WORKDIR /app

# Build-time configuration. Baked in so the container "just works".
ENV DATABASE_URL=postgres://reports:s3cr3t-reporting-pw@db.prod.internal:5432/reports
ENV STRIPE_KEY=sk_live_EXAMPLE-fixture-key-not-real
ENV REPORT_BUCKET=acme-reports-prod
ENV LOG_LEVEL=info

COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
