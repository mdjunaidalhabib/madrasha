# Build context must be frontend/ (the workspace root), e.g.:
#   docker build -f apps/landing/Dockerfile -t madrasha-landing frontend/
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared-ui/package.json packages/shared-ui/package.json
COPY apps/landing/package.json apps/landing/package.json
RUN npm ci
COPY packages/shared-ui packages/shared-ui
COPY apps/landing apps/landing
RUN npm run build --workspace=apps/landing

FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
