FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Debian (not Alpine) for both stages - the PDF export feature launches a
# real Chromium via Playwright, and Playwright's Chromium build needs glibc
# (doesn't run reliably on Alpine's musl libc). Both stages must share the
# same OS/libc family since the production stage below copies the build
# stage's already-generated Prisma engine binary rather than regenerating it.
FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# Installs the Chromium binary AND the OS packages it needs (fonts, libnss3,
# etc.) in one step. Adds ~500-700MB to the image - the necessary cost of
# reliable, pixel-perfect PDF rendering (see report-export.service.ts).
RUN npx playwright install --with-deps chromium
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 5000
CMD ["node", "dist/core/server.js"]
