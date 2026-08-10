FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/test-support/package.json packages/test-support/package.json
RUN npm ci --ignore-scripts
COPY prisma.config.ts ./
COPY database/prisma database/prisma
COPY scripts/database scripts/database
RUN npm run db:generate && mkdir -p runtime/api-console && chown -R node:node /app
COPY --chown=node:node apps/api apps/api
# The transitional Domain RPC server bundles the backend-facing services from
# apps/web/src at runtime. Keep that source in the API image until those
# services are moved into backend-owned modules.
COPY --chown=node:node apps/web apps/web
COPY --chown=node:node packages packages
USER node
EXPOSE 4174
CMD ["npm", "run", "dev:api"]
