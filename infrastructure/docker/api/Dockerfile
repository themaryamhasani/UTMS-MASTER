FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --ignore-scripts
COPY apps/api apps/api
USER node
CMD ["npm", "run", "dev:api"]
