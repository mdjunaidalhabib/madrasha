# Build context must be the repo root (workspace root), e.g.:
#   docker build -f super-admin/Dockerfile -t madrasha-super-admin .
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY super-admin/package.json super-admin/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY super-admin super-admin
RUN npm run build --workspace=super-admin

FROM nginx:1.27-alpine AS production
COPY --from=build /app/super-admin/dist /usr/share/nginx/html
COPY super-admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
