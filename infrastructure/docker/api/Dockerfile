FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/playwright-runner/package.json apps/playwright-runner/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/test-support/package.json packages/test-support/package.json
RUN npm ci --ignore-scripts && mkdir -p runtime/api-console && chown -R node:node /app
COPY --chown=node:node apps/api apps/api
COPY --chown=node:node packages packages
USER node
EXPOSE 4174
CMD ["npm", "run", "dev:api"]
