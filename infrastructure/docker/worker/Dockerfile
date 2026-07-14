FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/worker/package.json apps/worker/package.json
RUN npm ci --ignore-scripts
COPY apps/worker apps/worker
USER node
CMD ["npm", "run", "dev:worker"]
