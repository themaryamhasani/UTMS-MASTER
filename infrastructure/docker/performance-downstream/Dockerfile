FROM node:22.19.0-alpine
WORKDIR /app
COPY infrastructure/docker/performance-downstream/server.cjs /app/server.cjs
EXPOSE 4180
CMD ["node", "server.cjs"]
