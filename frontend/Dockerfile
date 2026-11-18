# Build context must be the repo root (workspace root), e.g.:
#   docker build -f frontend/Dockerfile -t madrasha-frontend .
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY frontend frontend
# Vite embeds this URL during compilation. Runtime container variables cannot
# change the API URL in the generated JavaScript.
ARG VITE_API_URL
ARG VITE_PLATFORM_ROOT_HOST
RUN npm run build --workspace=frontend

FROM node:20-alpine AS production
WORKDIR /app/frontend
ENV NODE_ENV=production PORT=80
COPY --from=build /app/frontend/dist ./dist
COPY frontend/server ./server
EXPOSE 80
CMD ["node", "server/index.mjs"]
