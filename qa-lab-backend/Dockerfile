# Build context must be repository root:
#   docker build -f qa-lab-backend/Dockerfile .
FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY qa-lab-backend/package.json qa-lab-backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY qa-lab-backend/package.json qa-lab-backend/package-lock.json ./
RUN npm ci
COPY qa-lab-backend/ ./
ENV DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public
RUN npx prisma generate && npm run build

FROM node:22-alpine
RUN addgroup -S qalab && adduser -S qalab -G qalab
WORKDIR /app
COPY src /app/scanner
COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/package.json /app/backend/
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/src/generated /app/backend/src/generated
ENV NODE_ENV=production
ENV QA_LAB_SCANNER_ROOT=/app/scanner/lib
WORKDIR /app/backend
USER qalab
EXPOSE 3000
# Migrations must be run as a one-shot job, not on every replica start.
CMD ["node", "dist/main.js"]
