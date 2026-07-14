FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts
COPY apps/web apps/web
USER node
CMD ["npm", "run", "dev:web"]
