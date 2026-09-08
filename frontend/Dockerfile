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
RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine AS production
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
