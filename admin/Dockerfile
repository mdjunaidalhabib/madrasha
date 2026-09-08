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
RUN npm run build --workspace=admin

FROM nginx:1.27-alpine AS production
COPY --from=build /app/admin/dist /usr/share/nginx/html
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
