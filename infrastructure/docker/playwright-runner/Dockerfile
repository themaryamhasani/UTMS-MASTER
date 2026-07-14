FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/playwright-runner/package.json apps/playwright-runner/package.json
RUN npm ci --ignore-scripts
COPY apps/playwright-runner apps/playwright-runner
USER node
CMD ["npm", "run", "dev:runner"]
