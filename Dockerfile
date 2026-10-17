FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_COMMIT
ARG RAILWAY_GIT_COMMIT_SHA
ARG MIGRATION_BYTE_PROFILE=production
RUN node scripts/package-migrations.mjs --profile "$MIGRATION_BYTE_PROFILE"
RUN npm run build
RUN mkdir -p .next/cache/images && chown -R node:node .next/cache
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["npm", "start"]
