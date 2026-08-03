FROM mcr.microsoft.com/playwright:v1.55.1-noble
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/playwright-runner/package.json apps/playwright-runner/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/test-support/package.json packages/test-support/package.json
RUN npm ci --ignore-scripts --include=dev
COPY prisma.config.ts ./
COPY database/prisma database/prisma
COPY scripts/database scripts/database
RUN npm run db:generate
COPY apps/playwright-runner apps/playwright-runner
COPY packages packages
RUN mkdir -p /test-runtime/node_modules/@playwright && \
    cp -a node_modules/@playwright/test /test-runtime/node_modules/@playwright/test && \
    cp -a node_modules/playwright /test-runtime/node_modules/playwright && \
    cp -a node_modules/playwright-core /test-runtime/node_modules/playwright-core && \
    find /test-runtime -type d -exec chmod 0555 {} \; && \
    find /test-runtime -type f -exec chmod 0444 {} \; && \
    chmod 0700 /app
# The supervisor creates root-owned read-only sources, then launches the test
# subprocess as the image's unprivileged pwuser (uid/gid 1001).
USER root
CMD ["node", "apps/playwright-runner/src/runtime.mjs"]
