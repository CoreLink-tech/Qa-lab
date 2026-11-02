# Build context: repository root
#   docker build -f qa-lab-backend/Dockerfile --target api -t qa-lab-api .
#   docker build -f qa-lab-backend/Dockerfile --target worker -t qa-lab-worker .
FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY qa-lab-backend/package.json qa-lab-backend/package-lock.json qa-lab-backend/.npmrc ./
# Production node_modules only. Skip lifecycle scripts (postinstall needs prisma CLI).
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY qa-lab-backend/package.json qa-lab-backend/package-lock.json qa-lab-backend/.npmrc ./
# Skip postinstall during ci; generate Prisma client after sources are copied.
RUN npm ci --ignore-scripts
COPY qa-lab-backend/ ./
ENV DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime-base
RUN addgroup -S qalab && adduser -S qalab -G qalab
WORKDIR /app
COPY src /app/scanner
COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/package.json /app/backend/
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/src/generated /app/backend/src/generated
# Nest compiles imports of ../generated to dist/generated relative to dist modules
COPY --from=build /app/backend/src/generated /app/backend/dist/generated
ENV NODE_ENV=production
ENV QA_LAB_SCANNER_ROOT=/app/scanner/lib
WORKDIR /app/backend
USER qalab

FROM runtime-base AS api
ENV RUN_MODE=api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM runtime-base AS worker
ENV RUN_MODE=worker
CMD ["node", "dist/main.worker.js"]
