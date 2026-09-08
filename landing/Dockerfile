# Build context must be the repo root (workspace root), e.g.:
#   docker build -f landing/Dockerfile -t madrasha-landing .
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY landing/package.json landing/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY landing landing
RUN npm run build --workspace=landing

FROM nginx:1.27-alpine AS production
COPY --from=build /app/landing/dist /usr/share/nginx/html
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
