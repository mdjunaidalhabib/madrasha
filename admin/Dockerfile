# Build context must be the repo root (workspace root), e.g.:
#   docker build -f admin/Dockerfile -t madrasha-admin .
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY admin/package.json admin/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY admin admin
ARG VITE_API_URL
RUN npm run build --workspace=admin

FROM node:20-alpine AS production
WORKDIR /app/admin
ENV NODE_ENV=production PORT=80
COPY --from=build /app/admin/dist ./dist
COPY admin/server ./server
EXPOSE 80
CMD ["node", "server/index.mjs"]
