# Build context must be frontend/ (the workspace root), e.g.:
#   docker build -f apps/super-admin/Dockerfile -t madrasha-super-admin frontend/
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY apps/super-admin/package.json apps/super-admin/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY apps/super-admin apps/super-admin
RUN npm run build --workspace=apps/super-admin

FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/super-admin/dist /usr/share/nginx/html
COPY apps/super-admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
